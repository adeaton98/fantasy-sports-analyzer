'use client';
import React, { useMemo, useState } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { computePuntAdjustedValues, totalDraftPool, totalRosterSpots, computeValueEfficiency, computeValueRanges } from '@/utils/auctionCalc';
import { computeRankings, applyTeamBoost } from '@/utils/rankings';
import { BASEBALL_POSITIONS, BASEBALL_CATEGORIES, BASEBALL_CATEGORY_LABELS, matchesPositionFilter, PITCHING_CATS, BATTING_CATS } from '@/utils/constants';
import StatTable from '@/components/shared/StatTable';
import GlowCard from '@/components/shared/GlowCard';
import ProgressBar from '@/components/shared/ProgressBar';
import DataModeToggle from '@/components/shared/DataModeToggle';
import PlayerTypeToggle from '@/components/shared/PlayerTypeToggle';
import TeamRankingPanel from '@/components/shared/TeamRankingPanel';
import type { RankedPlayer } from '@/types';
import type { BaseballCategory } from '@/types';

const ROSTER_KEYS_BASE = ['C', '1B', '2B', '2B/SS', '1B/3B', '3B', 'SS', 'OF', 'UTIL', 'BN', 'IL'] as const;
const PITCHER_KEYS = ['SP', 'RP'] as const;
const PITCHER_KEY_NoPD = ['P'] as const;

function MarketScaleSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-[var(--text-dim)]">{label}</span>
        <span className="text-xs font-mono accent-text">{value.toFixed(1)}x</span>
      </div>
      <input type="range" min={1} max={3} step={0.1} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: 'var(--accent)' }} />
    </div>
  );
}

const BATTER_POS_DRAFT = new Set(['C', '1B', '2B', '3B', 'SS', 'OF', 'DH']);
const PITCHER_POS_DRAFT = new Set(['SP', 'RP', 'P']);

export default function MyDraft() {
  const {
    players, myTeam, draftPlayer, undoLastPick, resetDraft,
    remainingBudget, leagueSettings, updateLeagueSettings,
    selectedCategories, categoryWeights,
    positionFilter, setPositionFilter,
    dataMode, setDataMode, pastPlayers, projectionPlayers,
    inflationScale, deflationScale, setInflationScale, setDeflationScale,
    puntCategories, togglePuntCategory, clearPuntCategories,
    positionOverrides, setPositionOverride,
    flaggedPlayerIds, flagPlayer, unflagPlayer,
    savedDraft, saveDraft,
    playerTypeFilter, setPlayerTypeFilter,
    teamRankings, teamRankWeight, teamRankEnabled,
  } = useBaseballStore();

  const [search, setSearch] = useState('');
  const [playerPrices, setPlayerPrices] = useState<Record<string, number>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showRange, setShowRange] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);

  const myTeamPlayers = myTeam.map((p) => p.player);
  const draftedIds = new Set(myTeamPlayers.map((p) => p.id));

  const requiredSlots = useMemo(() => {
    const slots = { ...leagueSettings.rosterSlots };
    const total = Object.values(slots).reduce((a: number, b: number | unknown) => a + (b as number), 0);
    return total - (leagueSettings.rosterSlots.IL ?? 0);
  }, [leagueSettings.rosterSlots]);
  const isDraftComplete = myTeam.length >= requiredSlots && requiredSlots > 0;
  const isSaved = savedDraft.length > 0 && savedDraft.every(p => myTeam.some(m => m.player.id === p.player.id));
  const poolSize = totalDraftPool(leagueSettings);
  const noPD = leagueSettings.noPitcherDesignation ?? false;
  const flaggedSet = useMemo(() => new Set(flaggedPlayerIds), [flaggedPlayerIds]);

  const availablePlayers = useMemo(
    () => players.filter((p) => !draftedIds.has(p.id)),
    [players, myTeam]
  );

  const typeFilteredAvailablePlayers = useMemo(() => {
    if (playerTypeFilter === 'pitchers') return availablePlayers.filter(p => p.positions.some(pos => PITCHER_POS_DRAFT.has(pos)));
    if (playerTypeFilter === 'batters') return availablePlayers.filter(p => p.positions.some(pos => BATTER_POS_DRAFT.has(pos)));
    return availablePlayers;
  }, [availablePlayers, playerTypeFilter]);

  const activeCats = useMemo(() => {
    const typeCats = playerTypeFilter === 'pitchers'
      ? selectedCategories.filter(c => PITCHING_CATS.includes(c as BaseballCategory))
      : playerTypeFilter === 'batters'
      ? selectedCategories.filter(c => BATTING_CATS.includes(c as BaseballCategory))
      : selectedCategories;
    return typeCats.filter(c => !puntCategories.includes(c as BaseballCategory));
  }, [selectedCategories, playerTypeFilter, puntCategories]);

  const ranked = useMemo(() => {
    if (typeFilteredAvailablePlayers.length === 0) return [];
    if (leagueSettings.isAuction) {
      const puntAdjusted = computePuntAdjustedValues(
        typeFilteredAvailablePlayers, myTeamPlayers, players,
        activeCats, categoryWeights, leagueSettings,
        puntCategories, inflationScale, deflationScale
      );
      if (!teamRankEnabled || teamRankings.length === 0 || teamRankWeight <= 1) return puntAdjusted;
      return applyTeamBoost(puntAdjusted, teamRankings, teamRankWeight);
    }
    const activeWeights = { ...categoryWeights };
    for (const cat of puntCategories) activeWeights[cat] = 0;
    const baseRanked = computeRankings(typeFilteredAvailablePlayers, activeCats, activeWeights, 'baseball');
    if (!teamRankEnabled || teamRankings.length === 0 || teamRankWeight <= 1) return baseRanked;
    return applyTeamBoost(baseRanked, teamRankings, teamRankWeight);
  }, [typeFilteredAvailablePlayers, myTeamPlayers, players, activeCats, categoryWeights, leagueSettings, puntCategories, inflationScale, deflationScale, teamRankEnabled, teamRankings, teamRankWeight]);

  const efficiencyMap = useMemo(() => {
    if (!showSuggestions) return new Map<string, 'under' | 'over' | 'fair'>();
    return computeValueEfficiency(ranked);
  }, [ranked, showSuggestions]);

  // Build position scarcity map for value ranges
  const positionScarcityMap = useMemo(() => {
    const scarcity = new Map<string, number>();
    for (const pos of BASEBALL_POSITIONS) {
      const total = players.filter((p) => matchesPositionFilter(p.positions, pos)).length;
      const drafted = myTeamPlayers.filter((p) => matchesPositionFilter(p.positions, pos)).length;
      if (total > 0) scarcity.set(pos, drafted / total);
    }
    return scarcity;
  }, [players, myTeamPlayers]);

  const rangesMap = useMemo(() => {
    if (!showRange) return new Map<string, { low: number; high: number }>();
    return computeValueRanges(ranked, positionScarcityMap);
  }, [ranked, showRange, positionScarcityMap]);

  const filtered = useMemo(() => {
    let list = ranked;
    if (positionFilter !== 'ALL') {
      list = list.filter((p) => matchesPositionFilter(p.positions, positionFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [ranked, positionFilter, search]);

  // Pool-based category coverage
  const teamCatProjections = useMemo(() => {
    if (myTeamPlayers.length === 0 || players.length === 0) return [];
    const allRanked = computeRankings(players, selectedCategories, categoryWeights, 'baseball');
    const topN = allRanked.slice(0, poolSize);

    return selectedCategories.filter((c) => !puntCategories.includes(c)).map((cat) => {
      const myTotal = myTeamPlayers.reduce((s, p) => s + (p.stats[cat] ?? 0), 0);
      const myAvg = myTeamPlayers.length > 0 ? myTotal / myTeamPlayers.length : 0;
      const poolTotal = topN.reduce((s, p) => s + (p.stats[cat] ?? 0), 0);
      const poolAvg = topN.length > 0 ? poolTotal / topN.length : 1;
      return { cat, myAvg, poolAvg, pct: poolAvg > 0 ? (myAvg / poolAvg) * 100 : 0 };
    });
  }, [myTeamPlayers, players, selectedCategories, categoryWeights, poolSize, puntCategories]);

  const handleDraft = (player: RankedPlayer) => {
    const price = leagueSettings.isAuction ? (playerPrices[player.id] ?? player.auctionValue ?? 1) : 0;
    draftPlayer(player, price);
    setPlayerPrices((prev) => { const n = { ...prev }; delete n[player.id]; return n; });
  };

  const handleFlag = (player: RankedPlayer) => {
    if (flaggedSet.has(player.id)) {
      unflagPlayer(player.id);
    } else {
      flagPlayer(player.id);
    }
  };

  const rowHighlight = useMemo(() => {
    if (!showSuggestions) return undefined;
    return (player: RankedPlayer): 'yellow' | 'red' | undefined => {
      const eff = efficiencyMap.get(player.id);
      if (eff === 'under') return 'yellow';
      if (eff === 'over') return 'red';
      return undefined;
    };
  }, [showSuggestions, efficiencyMap]);

  const columns = useMemo((): { key: string; label: string; sortable?: boolean; format?: (_: unknown, p: RankedPlayer) => React.ReactNode }[] => {
    const base: { key: string; label: string; sortable?: boolean; format?: (_: unknown, p: RankedPlayer) => React.ReactNode }[] = [
      { key: 'name', label: 'Player', format: (_: unknown, p: RankedPlayer) =>
        <span className="font-medium text-[var(--text)]">{p.name}</span> },
      // Draft button column between name and positions
      { key: '_draft', label: '', sortable: false, format: (_: unknown, p: RankedPlayer) => (
        <button onClick={(e) => { e.stopPropagation(); handleDraft(p); }}
          className="px-2 py-1 rounded text-xs font-semibold accent-bg text-[var(--navy)] hover:opacity-90 whitespace-nowrap">
          Draft
        </button>
      )},
      { key: 'positions', label: 'Pos', format: (_: unknown, p: RankedPlayer) =>
        <span className="text-xs accent-text font-mono">{p.positions.join(', ')}</span> },
    ];
    if (leagueSettings.isAuction) {
      base.push({ key: 'auctionValue', label: 'Suggested $',
        format: (_: unknown, p: RankedPlayer) => {
          if (showRange) {
            const range = rangesMap.get(p.id);
            if (range) {
              return <span className="font-mono font-bold text-[var(--gold)] text-xs">${range.low}–${range.high}</span>;
            }
          }
          return (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <span className="text-[var(--text-dim)] text-xs">$</span>
              <input type="number" min={1} max={remainingBudget}
                value={playerPrices[p.id] ?? p.auctionValue ?? 1}
                onChange={(e) => setPlayerPrices((prev) => ({ ...prev, [p.id]: parseInt(e.target.value) || 1 }))}
                className="w-14 bg-[var(--navy-2)] border border-[var(--border)] rounded px-1.5 py-0.5 text-sm text-[var(--gold)] text-center outline-none focus:border-[var(--accent)]" />
            </div>
          );
        },
      });
    }
    activeCats.forEach((cat) => {
      base.push({ key: `stats.${cat}`, label: cat,
        format: (_: unknown, p: RankedPlayer) => {
          const v = p.stats[cat];
          return v !== undefined ? (['ERA', 'WHIP', 'OBP'].includes(cat) ? v.toFixed(3) : v.toFixed(0)) : '—';
        },
      });
    });
    base.push({ key: 'stats.IP', label: 'IP', sortable: true,
      format: (_: unknown, p: RankedPlayer) => {
        const v = p.stats.IP;
        return v !== undefined ? <span className="font-mono text-xs text-[var(--text-dim)]">{v.toFixed(1)}</span> : <span className="text-[var(--text-dim)]">—</span>;
      },
    });
    base.push({ key: 'stats.AB', label: 'AB', sortable: true,
      format: (_: unknown, p: RankedPlayer) => {
        const v = p.stats.AB;
        return v !== undefined ? <span className="font-mono text-xs text-[var(--text-dim)]">{v.toFixed(0)}</span> : <span className="text-[var(--text-dim)]">—</span>;
      },
    });
    return base;
  }, [activeCats, leagueSettings.isAuction, playerPrices, remainingBudget, puntCategories, showRange, rangesMap]);

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-[var(--text-dim)]">Upload player data first.</p>
        <a href="/upload" className="mt-3 text-sm accent-text hover:underline">Upload →</a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header stats row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-3 flex-wrap">
          <GlowCard padding={false} hover={false} className="p-4">
            <div className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">Drafted</div>
            <div className="text-2xl font-display tracking-wider mt-1 accent-text">{myTeam.length}</div>
          </GlowCard>
          {leagueSettings.isAuction && (
            <>
              <GlowCard padding={false} hover={false} className="p-4">
                <div className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">Budget Left</div>
                <div className={`text-2xl font-display tracking-wider mt-1 ${remainingBudget < 20 ? 'text-[var(--danger)]' : 'accent-text'}`}>
                  ${remainingBudget}
                </div>
              </GlowCard>
              <GlowCard padding={false} hover={false} className="p-4">
                <div className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">$/Player</div>
                <div className="text-2xl font-display tracking-wider mt-1 text-[var(--gold)]">
                  ${(leagueSettings.draftRounds - myTeam.length) > 0
                    ? Math.round(remainingBudget / (leagueSettings.draftRounds - myTeam.length))
                    : 0}
                </div>
              </GlowCard>
              <GlowCard padding={false} hover={false} className="p-4">
                <div className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">Base Budget</div>
                {editingBudget ? (
                  <input type="number" min={50} max={10000} autoFocus defaultValue={leagueSettings.budget}
                    onBlur={(e) => { updateLeagueSettings({ budget: parseInt(e.target.value) || leagueSettings.budget }); setEditingBudget(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingBudget(false); }}
                    className="w-20 bg-[var(--navy-2)] border border-[var(--accent)] rounded px-2 py-0.5 text-sm text-[var(--gold)] outline-none font-mono mt-1" />
                ) : (
                  <button onClick={() => setEditingBudget(true)} className="text-2xl font-display tracking-wider mt-1 text-[var(--gold)] hover:underline cursor-text">
                    ${leagueSettings.budget}<span className="text-[9px] text-[var(--text-dim)] ml-1">✎</span>
                  </button>
                )}
              </GlowCard>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DataModeToggle mode={dataMode} onChange={setDataMode} pastCount={pastPlayers.length} projCount={projectionPlayers.length} />
          <button
            onClick={() => setShowSuggestions((v) => !v)}
            className={`text-xs border px-3 py-1.5 rounded-lg transition-colors ${showSuggestions ? 'accent-bg text-[var(--navy)] border-transparent' : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]'}`}
          >
            Suggestions
          </button>
          <button
            onClick={() => setShowRange((v) => !v)}
            className={`text-xs border px-3 py-1.5 rounded-lg transition-colors ${showRange ? 'accent-bg text-[var(--navy)] border-transparent' : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]'}`}
          >
            Show Range
          </button>
          <button onClick={() => setShowSettings(!showSettings)}
            className={`text-xs border px-3 py-1.5 rounded-lg transition-colors ${showSettings ? 'accent-bg text-[var(--navy)] border-transparent' : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]'}`}>
            ⚙ Settings
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <GlowCard className="space-y-5" hover={false}>
          {/* Punt categories */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Punt Categories</h3>
              {puntCategories.length > 0 && (
                <button onClick={clearPuntCategories} className="text-xs text-[var(--danger)] hover:underline">Clear punts</button>
              )}
            </div>
            <p className="text-[10px] text-[var(--text-dim)] mb-3">
              Punted categories are excluded from rankings. Pick players who dominate your target cats instead.
            </p>
            <div className="flex flex-wrap gap-2">
              {BASEBALL_CATEGORIES.map((cat) => {
                const punted = puntCategories.includes(cat);
                return (
                  <button key={cat} onClick={() => togglePuntCategory(cat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all ${
                      punted
                        ? 'bg-[var(--danger)] bg-opacity-20 text-[var(--danger)] border-[var(--danger)] border-opacity-50'
                        : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent)]'
                    }`}>
                    {punted ? '✕' : '+'} {cat}
                    <span className="text-[9px] opacity-60">{BASEBALL_CATEGORY_LABELS[cat as BaseballCategory]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-[var(--border)]">
            {/* Market Scales */}
            {leagueSettings.isAuction && (
              <div className="space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Market Scales</h3>
                <MarketScaleSlider label="Inflation (elite players go for more)" value={inflationScale} onChange={setInflationScale} />
                <MarketScaleSlider label="Deflation (late players go cheaper)" value={deflationScale} onChange={setDeflationScale} />
              </div>
            )}

            {/* Roster Slots */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                Roster Slots <span className="text-[var(--text-dim)] normal-case font-normal">(pool: {poolSize})</span>
              </h3>
              {/* NoPitcherDesignation toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={noPD}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const sp = (leagueSettings.rosterSlots as Record<string, number>).SP ?? 0;
                    const rp = (leagueSettings.rosterSlots as Record<string, number>).RP ?? 0;
                    const p = (leagueSettings.rosterSlots as Record<string, number>).P ?? 0;
                    if (checked) {
                      updateLeagueSettings({
                        noPitcherDesignation: true,
                        rosterSlots: { ...leagueSettings.rosterSlots, SP: 0, RP: 0, P: sp + rp || p || 4 },
                      });
                    } else {
                      updateLeagueSettings({
                        noPitcherDesignation: false,
                        rosterSlots: { ...leagueSettings.rosterSlots, P: 0, SP: Math.floor(p / 2) || 2, RP: Math.ceil(p / 2) || 2 },
                      });
                    }
                  }}
                  className="w-3.5 h-3.5 accent-[var(--accent)]"
                />
                <span className="text-xs text-[var(--text-dim)]">No pitcher designation (SP/RP → P)</span>
              </label>

              <div className="grid grid-cols-4 gap-2">
                {ROSTER_KEYS_BASE.map((key) => (
                  <div key={key} className="text-center">
                    <div className="text-[10px] font-mono text-[var(--text-dim)] mb-0.5">{key}</div>
                    <input type="number" min={0} max={20}
                      value={(leagueSettings.rosterSlots as Record<string, number>)[key] ?? 0}
                      onChange={(e) => updateLeagueSettings({ rosterSlots: { ...leagueSettings.rosterSlots, [key]: parseInt(e.target.value) || 0 } })}
                      className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded px-1 py-1 text-xs text-center text-[var(--text)] outline-none focus:border-[var(--accent)]" />
                  </div>
                ))}
                {/* Pitcher slots: SP+RP or P */}
                {noPD ? (
                  <div className="text-center col-span-1">
                    <div className="text-[10px] font-mono text-[var(--accent)] mb-0.5">P</div>
                    <input type="number" min={0} max={20}
                      value={(leagueSettings.rosterSlots as Record<string, number>).P ?? 0}
                      onChange={(e) => updateLeagueSettings({ rosterSlots: { ...leagueSettings.rosterSlots, P: parseInt(e.target.value) || 0 } })}
                      className="w-full bg-[var(--navy-2)] border border-[var(--accent)] border-opacity-50 rounded px-1 py-1 text-xs text-center text-[var(--text)] outline-none focus:border-[var(--accent)]" />
                  </div>
                ) : (
                  <>
                    {PITCHER_KEYS.map((key) => (
                      <div key={key} className="text-center">
                        <div className="text-[10px] font-mono text-[var(--text-dim)] mb-0.5">{key}</div>
                        <input type="number" min={0} max={20}
                          value={(leagueSettings.rosterSlots as Record<string, number>)[key] ?? 0}
                          onChange={(e) => updateLeagueSettings({ rosterSlots: { ...leagueSettings.rosterSlots, [key]: parseInt(e.target.value) || 0 } })}
                          className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded px-1 py-1 text-xs text-center text-[var(--text)] outline-none focus:border-[var(--accent)]" />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </GlowCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* My team + category bars */}
        <div className="space-y-4">
          <GlowCard className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">My Team</h3>
                <button
                  onClick={() => { if (window.confirm('Reset all draft picks?')) resetDraft(); }}
                  className="border border-red-500/50 text-red-400 text-xs px-2 py-0.5 rounded hover:bg-red-900/20">
                  Reset Draft
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={undoLastPick} className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] hover:underline">Undo</button>
                {isDraftComplete && (
                  <button
                    onClick={saveDraft}
                    className="text-xs px-3 py-1 rounded font-semibold accent-bg text-[var(--navy)] hover:opacity-90">
                    {isSaved ? '✓ Saved' : 'Save Draft'}
                  </button>
                )}
              </div>
            </div>
            {myTeam.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)] text-center py-4">No players drafted yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {myTeam.map(({ player, price: p }, i) => {
                  return (
                    <div key={player.id} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0 gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-mono text-[var(--text-dim)] mr-2">{i + 1}.</span>
                        <span className="text-sm text-[var(--text)]">{player.name}</span>
                      </div>
                      {/* Position override dropdown */}
                      <select
                        value={positionOverrides[player.id] ?? player.positions[0] ?? 'UTIL'}
                        onChange={(e) => setPositionOverride(player.id, e.target.value)}
                        title="Override position"
                        className="bg-[var(--navy-2)] border border-[var(--border)] rounded px-1 py-0.5 text-xs text-[var(--accent)] outline-none focus:border-[var(--accent)] shrink-0"
                      >
                        {BASEBALL_POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                        <option value="UTIL">UTIL</option>
                        <option value="BN">BN</option>
                      </select>
                      {leagueSettings.isAuction && (
                        <span className="text-sm font-mono text-[var(--gold)] shrink-0">${p}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </GlowCard>

          {/* Category coverage vs draft pool */}
          {teamCatProjections.length > 0 && (
            <GlowCard className="space-y-3">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Category Coverage</h3>
                <p className="text-[10px] text-[var(--text-dim)] mt-0.5">vs. avg of top {poolSize} draft pool players</p>
              </div>
              {teamCatProjections.map(({ cat, pct }) => (
                <ProgressBar key={cat} label={cat} value={pct} max={150} winning={pct >= 100}
                  format={(v) => `${v.toFixed(0)}% of pool avg`} />
              ))}
              {puntCategories.length > 0 && (
                <p className="text-[10px] text-[var(--danger)]">Punting: {puntCategories.join(', ')}</p>
              )}
            </GlowCard>
          )}
        </div>

        {/* Available players */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <input type="text" placeholder="Search available players..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]" />
            <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}
              className="bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
              <option value="ALL">All Positions</option>
              {BASEBALL_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <PlayerTypeToggle value={playerTypeFilter} onChange={setPlayerTypeFilter} />
            <TeamRankingPanel />
          </div>
          {showSuggestions && (
            <div className="flex items-center gap-3 text-[10px] text-[var(--text-dim)]">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-yellow-900/40 border border-yellow-700/40" /> Undervalued</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-900/40 border border-red-700/40" /> Overvalued</span>
            </div>
          )}
          <StatTable
            players={filtered}
            columns={columns}
            draftedIds={draftedIds}
            showRank
            maxHeight="520px"
            rowHighlight={rowHighlight}
            flaggedIds={flaggedSet}
            onFlag={handleFlag}
          />
        </div>
      </div>
    </div>
  );
}
