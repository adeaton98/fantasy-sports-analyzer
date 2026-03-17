'use client';
import React, { useMemo, useState } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { computePuntAdjustedValues, totalDraftPool, totalRosterSpots, computeValueEfficiency, computeValueRanges, applyBatterPitcherSkew } from '@/utils/auctionCalc';
import { computeRankings, applyTeamBoost } from '@/utils/rankings';
import { BASEBALL_POSITIONS, BASEBALL_CATEGORIES, BASEBALL_CATEGORY_LABELS, matchesPositionFilter, PITCHING_CATS, BATTING_CATS } from '@/utils/constants';
import { fillRosterSlots } from '@/utils/rosterUtils';
import StatTable from '@/components/shared/StatTable';
import GlowCard from '@/components/shared/GlowCard';
import ProgressBar from '@/components/shared/ProgressBar';
import DataModeToggle from '@/components/shared/DataModeToggle';
import PlayerTypeToggle from '@/components/shared/PlayerTypeToggle';
import type { RankedPlayer, DraftPick } from '@/types';
import type { BaseballCategory } from '@/types';
import { useLeagueHistoryStore } from '@/store/useLeagueHistoryStore';
import { computeLeagueAvgBenchmark, computeAvgDraftPrices, lookupHistPrice } from '@/utils/leagueHistoryParser';

const BATTER_POS_DRAFT = new Set(['C', '1B', '2B', '3B', 'SS', 'OF', 'DH']);
const PITCHER_POS_DRAFT = new Set(['SP', 'RP', 'P']);

// Roster Template — shows all slots filled/empty
function RosterTemplate({ picks, reserves, rosterSlots, positionOverrides, noPD }: {
  picks: DraftPick[];
  reserves: DraftPick[];
  rosterSlots: Record<string, number>;
  positionOverrides: Record<string, string>;
  noPD: boolean;
}) {
  const slots = fillRosterSlots(picks, rosterSlots, positionOverrides, noPD);
  return (
    <div className="space-y-1">
      {slots.map(({ slot, pick }, i) => (
        <div key={slot + i} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${pick ? 'bg-[var(--navy-2)]' : 'border border-dashed border-[var(--border)]'}`}>
          <span className={`font-mono w-10 shrink-0 text-[10px] ${pick ? 'accent-text' : 'text-[var(--text-dim)]'}`}>{slot}</span>
          {pick ? (
            <span className="text-[var(--text)] truncate">{pick.player.name}</span>
          ) : (
            <span className="text-[var(--text-dim)] italic">empty</span>
          )}
          {pick?.price !== undefined && pick.price > 0 && (
            <span className="ml-auto font-mono text-[var(--gold)] text-[10px] shrink-0">${pick.price}</span>
          )}
        </div>
      ))}
      {reserves.length > 0 && (
        <>
          <div className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider pt-2 pb-0.5 border-t border-[var(--border)]">
            Reserves ({reserves.length}/15)
          </div>
          {reserves.map((r, i) => (
            <div key={r.player.id + i} className="flex items-center gap-2 px-2 py-1 rounded text-xs bg-[var(--navy-2)] opacity-70">
              <span className="font-mono w-10 shrink-0 text-[10px] text-[var(--text-dim)]">RES</span>
              <span className="text-[var(--text)] truncate">{r.player.name}</span>
              {r.price !== undefined && r.price > 0 && (
                <span className="ml-auto font-mono text-[var(--gold)] text-[10px] shrink-0">${r.price}</span>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function MyDraft({ onSaveToBank }: { onSaveToBank?: () => void } = {}) {
  const {
    players, myTeam, myTeamReserves, draftPlayer, draftPlayerAsReserve, undoLastPick, resetDraft,
    leagueSettings,
    selectedCategories, categoryWeights,
    positionFilter, setPositionFilter,
    dataMode, setDataMode, pastPlayers, projectionPlayers,
    inflationScale, deflationScale,
    batterPitcherSkew,
    puntCategories, togglePuntCategory, clearPuntCategories,
    positionOverrides, setPositionOverride,
    flaggedPlayerIds, flagPlayer, unflagPlayer,
    avoidedPlayerIds, avoidPlayer, unavoidPlayer,
    savedDraft, saveDraft,
    playerTypeFilter, setPlayerTypeFilter,
    teamRankings, teamRankWeight, teamRankEnabled,
  } = useBaseballStore();

  const [search, setSearch] = useState('');
  const [playerPrices, setPlayerPrices] = useState<Record<string, number>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showRange, setShowRange] = useState(false);

  const myTeamPlayers = myTeam.map((p) => p.player);
  const draftedIds = new Set(myTeamPlayers.map((p) => p.id));

  const totalRequired = useMemo(() => totalRosterSpots(leagueSettings), [leagueSettings]);
  const rosterFull = myTeam.length >= totalRequired;
  const allDraftedIds = useMemo(
    () => new Set([...myTeamPlayers.map((p) => p.id), ...myTeamReserves.map((r) => r.player.id)]),
    [myTeamPlayers, myTeamReserves]
  );

  const isDraftComplete = myTeam.length >= totalRequired && totalRequired > 0;
  const isSaved = savedDraft.length > 0 && savedDraft.every(p => myTeam.some(m => m.player.id === p.player.id));
  const poolSize = totalDraftPool(leagueSettings);
  const noPD = leagueSettings.noPitcherDesignation ?? false;
  const flaggedSet = useMemo(() => new Set(flaggedPlayerIds), [flaggedPlayerIds]);
  const avoidedSet = useMemo(() => new Set(avoidedPlayerIds), [avoidedPlayerIds]);

  const { categoryHistory, draftRecaps } = useLeagueHistoryStore();
  const historyBenchmark = useMemo(
    () => categoryHistory.length > 0 ? computeLeagueAvgBenchmark(categoryHistory) : null,
    [categoryHistory]
  );

  const avgPriceMap = useMemo(() => computeAvgDraftPrices(draftRecaps), [draftRecaps]);
  const histPriceById = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of players) {
      const v = lookupHistPrice(p.name, avgPriceMap);
      if (v != null) map.set(p.id, v);
    }
    return map;
  }, [players, avgPriceMap]);

  const availablePlayers = useMemo(
    () => players.filter((p) => !allDraftedIds.has(p.id)),
    [players, allDraftedIds]
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
    const skewedWeights = applyBatterPitcherSkew(categoryWeights, batterPitcherSkew);
    if (leagueSettings.isAuction) {
      const puntAdjusted = computePuntAdjustedValues(
        typeFilteredAvailablePlayers, myTeamPlayers, players,
        activeCats, skewedWeights, leagueSettings,
        puntCategories, inflationScale, deflationScale
      );
      if (!teamRankEnabled || teamRankings.length === 0 || teamRankWeight <= 1) return puntAdjusted;
      return applyTeamBoost(puntAdjusted, teamRankings, teamRankWeight);
    }
    const activeWeights = { ...skewedWeights };
    for (const cat of puntCategories) activeWeights[cat] = 0;
    const baseRanked = computeRankings(typeFilteredAvailablePlayers, activeCats, activeWeights, 'baseball');
    if (!teamRankEnabled || teamRankings.length === 0 || teamRankWeight <= 1) return baseRanked;
    return applyTeamBoost(baseRanked, teamRankings, teamRankWeight);
  }, [typeFilteredAvailablePlayers, myTeamPlayers, players, activeCats, categoryWeights, batterPitcherSkew, leagueSettings, puntCategories, inflationScale, deflationScale, teamRankEnabled, teamRankings, teamRankWeight]);

  const efficiencyMap = useMemo(() => {
    if (!showSuggestions) return new Map<string, 'under' | 'over' | 'fair'>();
    return computeValueEfficiency(ranked);
  }, [ranked, showSuggestions]);

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
    if (positionFilter === 'BATTERS') {
      list = list.filter((p) => p.positions.some(pos => BATTER_POS_DRAFT.has(pos)));
    } else if (positionFilter === 'PITCHERS') {
      list = list.filter((p) => p.positions.some(pos => PITCHER_POS_DRAFT.has(pos)));
    } else if (positionFilter !== 'ALL') {
      list = list.filter((p) => matchesPositionFilter(p.positions, positionFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [ranked, positionFilter, search]);

  // Active roster slots = total slots minus IL (IL players don't contribute to categories)
  const activeRosterSlots = useMemo(() => {
    const ilSlots = (leagueSettings.rosterSlots as Record<string, number>).IL ?? 0;
    return Math.max(1, totalRequired - ilSlots);
  }, [leagueSettings.rosterSlots, totalRequired]);

  // Rate stats are team-level averages; counting stats are team-season totals
  const RATE_CATS = new Set(['OBP', 'ERA', 'WHIP']);

  // Category coverage — per-player-slot comparison so it scales as you add picks
  const teamCatProjections = useMemo(() => {
    if (myTeamPlayers.length === 0 || players.length === 0) return [];
    const activeCovCats = selectedCategories.filter((c) => !puntCategories.includes(c));

    if (historyBenchmark && Object.keys(historyBenchmark).length > 0) {
      return activeCovCats.map((cat) => {
        const myTotal = myTeamPlayers.reduce((s, p) => s + (p.stats[cat] ?? 0), 0);
        const myAvg = myTotal / myTeamPlayers.length;
        // Counting stat benchmarks are full-team totals — divide by active slots for per-player target
        const rawBenchmark = historyBenchmark[cat] ?? 1;
        const perPlayerBenchmark = RATE_CATS.has(cat) ? rawBenchmark : rawBenchmark / activeRosterSlots;
        return { cat, myAvg, poolAvg: perPlayerBenchmark, pct: perPlayerBenchmark > 0 ? (myAvg / perPlayerBenchmark) * 100 : 0 };
      });
    }

    const allRanked = computeRankings(players, selectedCategories, categoryWeights, 'baseball');
    const topN = allRanked.slice(0, poolSize);
    return activeCovCats.map((cat) => {
      const myTotal = myTeamPlayers.reduce((s, p) => s + (p.stats[cat] ?? 0), 0);
      const myAvg = myTeamPlayers.length > 0 ? myTotal / myTeamPlayers.length : 0;
      const poolTotal = topN.reduce((s, p) => s + (p.stats[cat] ?? 0), 0);
      const poolAvg = topN.length > 0 ? poolTotal / topN.length : 1;
      return { cat, myAvg, poolAvg, pct: poolAvg > 0 ? (myAvg / poolAvg) * 100 : 0 };
    });
  }, [myTeamPlayers, players, selectedCategories, categoryWeights, poolSize, puntCategories, historyBenchmark, activeRosterSlots]);

  // Pearson correlation between each pair of selected categories across the player pool
  const correlations = useMemo(() => {
    if (players.length < 5 || selectedCategories.length < 2) return new Map<string, number>();
    const result = new Map<string, number>();
    for (let i = 0; i < selectedCategories.length; i++) {
      for (let j = i + 1; j < selectedCategories.length; j++) {
        const cat1 = selectedCategories[i];
        const cat2 = selectedCategories[j];
        const pairs = players
          .filter((p) => p.stats[cat1] != null && p.stats[cat2] != null)
          .map((p) => [p.stats[cat1]!, p.stats[cat2]!] as [number, number]);
        if (pairs.length < 5) continue;
        const xs = pairs.map((p) => p[0]);
        const ys = pairs.map((p) => p[1]);
        const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
        const yMean = ys.reduce((a, b) => a + b, 0) / ys.length;
        const num = xs.reduce((s, x, k) => s + (x - xMean) * (ys[k] - yMean), 0);
        const xStd = Math.sqrt(xs.reduce((s, x) => s + (x - xMean) ** 2, 0));
        const yStd = Math.sqrt(ys.reduce((s, y) => s + (y - yMean) ** 2, 0));
        if (xStd === 0 || yStd === 0) continue;
        const r = num / (xStd * yStd);
        result.set(`${cat1}::${cat2}`, r);
        result.set(`${cat2}::${cat1}`, r);
      }
    }
    return result;
  }, [players, selectedCategories]);

  // Draft strategy: which categories to target to reach 6/10 wins
  const draftStrategy = useMemo(() => {
    if (teamCatProjections.length === 0) return null;
    const numCats = teamCatProjections.length;
    const targetWins = Math.ceil(numCats * 0.6);
    const winning = teamCatProjections.filter((c) => c.pct >= 100);
    const losing = teamCatProjections.filter((c) => c.pct < 100);
    const winsNeeded = Math.max(0, targetWins - winning.length);
    // Closest-to-winning categories first
    const suggestions = losing
      .slice()
      .sort((a, b) => b.pct - a.pct)
      .slice(0, Math.max(winsNeeded, 2))
      .map((s) => {
        const corrs = selectedCategories
          .filter((c) => c !== s.cat)
          .map((c) => ({ cat: c, r: correlations.get(`${s.cat}::${c}`) ?? 0 }))
          .filter((c) => Math.abs(c.r) > 0.3)
          .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
          .slice(0, 3);
        return { ...s, corrs };
      });
    return { targetWins, numCats, winning, losing, winsNeeded, suggestions };
  }, [teamCatProjections, correlations, selectedCategories]);

  const handleDraft = (player: RankedPlayer) => {
    const price = leagueSettings.isAuction ? (playerPrices[player.id] ?? player.auctionValue ?? 1) : 0;
    if (rosterFull) draftPlayerAsReserve(player, price);
    else draftPlayer(player, price);
    setPlayerPrices((prev) => { const n = { ...prev }; delete n[player.id]; return n; });
  };

  const handleFlag = (player: RankedPlayer) => {
    if (flaggedSet.has(player.id)) unflagPlayer(player.id);
    else flagPlayer(player.id);
  };

  const handleAvoid = (player: RankedPlayer) => {
    if (avoidedSet.has(player.id)) unavoidPlayer(player.id);
    else avoidPlayer(player.id);
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
      { key: '_draft', label: '', sortable: false, format: (_: unknown, p: RankedPlayer) => (
        <button onClick={(e) => { e.stopPropagation(); handleDraft(p); }}
          className={`px-2 py-1 rounded text-xs font-semibold hover:opacity-90 whitespace-nowrap ${
            rosterFull ? 'bg-[var(--gold)] text-[var(--navy)]' : 'accent-bg text-[var(--navy)]'
          }`}>
          {rosterFull ? 'Reserve' : 'Draft'}
        </button>
      )},
      { key: 'positions', label: 'Pos', format: (_: unknown, p: RankedPlayer) =>
        <span className="text-xs accent-text font-mono">{p.positions.join(', ')}</span> },
      { key: 'team', label: 'Team', format: (_: unknown, p: RankedPlayer) =>
        <span className="text-xs font-mono text-[var(--text-dim)]">{p.team || '—'}</span> },
    ];
    if (draftRecaps.length > 0) {
      base.push({ key: 'histPrice', label: 'Hist. $', sortable: false,
        format: (_: unknown, p: RankedPlayer) => {
          const v = histPriceById.get(p.id);
          return v != null
            ? <span className="font-mono text-xs text-[var(--text-dim)]">${v}</span>
            : <span className="text-[var(--text-dim)]">—</span>;
        },
      });
    }
    if (leagueSettings.isAuction) {
      base.push({ key: 'auctionValue', label: 'Suggested $',
        format: (_: unknown, p: RankedPlayer) => {
          if (showRange) {
            const range = rangesMap.get(p.id);
            if (range) return <span className="font-mono font-bold text-[var(--gold)] text-xs">${range.low}–${range.high}</span>;
          }
          return (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <span className="text-[var(--text-dim)] text-xs">$</span>
              <input type="number" min={1} max={leagueSettings.budget}
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
  }, [activeCats, leagueSettings.isAuction, leagueSettings.budget, playerPrices, puntCategories, showRange, rangesMap, rosterFull, draftRecaps.length, histPriceById]);

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
            <GlowCard padding={false} hover={false} className="p-4">
              <div className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">Budget</div>
              <div className="text-2xl font-display tracking-wider mt-1 text-[var(--gold)]">
                ${leagueSettings.budget}
              </div>
              <div className="text-[9px] text-[var(--text-dim)] font-mono mt-0.5">
                <a href="/baseball/settings" className="hover:accent-text hover:underline">edit in Settings</a>
              </div>
            </GlowCard>
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
        </div>
      </div>

      {/* Punt categories — always visible, compact */}
      <GlowCard className="space-y-3" hover={false}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Punt Categories</h3>
          {puntCategories.length > 0 && (
            <button onClick={clearPuntCategories} className="text-xs text-[var(--danger)] hover:underline">Clear punts</button>
          )}
        </div>
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
      </GlowCard>

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
                  Reset
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={undoLastPick} className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] hover:underline">Undo</button>
                {onSaveToBank && myTeam.length > 0 && (
                  <button
                    onClick={onSaveToBank}
                    className="accent-bg text-[var(--navy)] text-xs px-3 py-1.5 rounded font-semibold hover:opacity-90">
                    💾 Save to Bank
                  </button>
                )}
                {isDraftComplete && (
                  <button
                    onClick={saveDraft}
                    className="text-xs px-3 py-1 rounded font-semibold accent-bg text-[var(--navy)] hover:opacity-90">
                    {isSaved ? '✓ Saved' : 'Save Draft'}
                  </button>
                )}
              </div>
            </div>
            {rosterFull && (
              <div className={`text-[10px] font-mono px-2 py-1 rounded ${myTeamReserves.length >= 15 ? 'text-[var(--danger)] bg-[var(--danger)]/10' : 'text-[var(--gold)] bg-[var(--gold)]/10'}`}>
                {myTeamReserves.length >= 15 ? 'Reserves full (15/15)' : 'Roster full — drafting to reserves'}
              </div>
            )}
            {myTeam.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)] text-center py-4">No players drafted yet.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <RosterTemplate
                  picks={myTeam}
                  reserves={myTeamReserves}
                  rosterSlots={leagueSettings.rosterSlots as Record<string, number>}
                  positionOverrides={positionOverrides}
                  noPD={noPD}
                />
              </div>
            )}
            {myTeam.length > 0 && (
              <details className="mt-1">
                <summary className="text-[10px] font-mono text-[var(--text-dim)] cursor-pointer hover:text-[var(--text)]">Override positions</summary>
                <div className="space-y-1.5 mt-2 max-h-48 overflow-y-auto">
                  {myTeam.map(({ player }) => (
                    <div key={player.id} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="text-xs text-[var(--text)] truncate">{player.name}</span>
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
                    </div>
                  ))}
                </div>
              </details>
            )}
          </GlowCard>

          {/* Category coverage vs draft pool */}
          {teamCatProjections.length > 0 && (
            <GlowCard className="space-y-3">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Category Coverage</h3>
                <p className="text-[10px] text-[var(--text-dim)] mt-0.5">
                  {historyBenchmark ? 'vs. league history avg' : `vs. avg of top ${poolSize} draft pool players`}
                </p>
              </div>
              {teamCatProjections.map(({ cat, pct }) => (
                <ProgressBar key={cat} label={cat} value={pct} max={150} winning={pct >= 100}
                  format={(v) => `${v.toFixed(0)}% of avg per slot`} />
              ))}
              {puntCategories.length > 0 && (
                <p className="text-[10px] text-[var(--danger)]">Punting: {puntCategories.join(', ')}</p>
              )}
            </GlowCard>
          )}

          {/* Draft Strategy */}
          {draftStrategy && (
            <GlowCard className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Draft Strategy</h3>
                <span className="text-[10px] font-mono text-[var(--text-dim)]">
                  Target: {draftStrategy.targetWins}/{draftStrategy.numCats} wins
                </span>
              </div>

              {/* Category win/loss chips */}
              <div className="flex flex-wrap gap-1.5">
                {teamCatProjections.map(({ cat, pct }) => (
                  <span key={cat} className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                    pct >= 100
                      ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/40'
                      : pct >= 75
                      ? 'bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30'
                      : 'bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/25'
                  }`}>
                    {cat} {pct >= 100 ? '✓' : `${pct.toFixed(0)}%`}
                  </span>
                ))}
              </div>

              {/* Win count summary */}
              <div className="text-xs">
                {draftStrategy.winning.length >= draftStrategy.targetWins ? (
                  <span className="accent-text">On pace for {draftStrategy.winning.length}/{draftStrategy.numCats} wins — target met</span>
                ) : (
                  <span className="text-[var(--text-dim)]">
                    Winning <span className="text-[var(--text)]">{draftStrategy.winning.length}/{draftStrategy.numCats}</span>
                    {draftStrategy.winsNeeded > 0 && <> — <span className="text-[var(--gold)]">{draftStrategy.winsNeeded} more needed</span></>}
                  </span>
                )}
              </div>

              {/* Suggested target categories */}
              {draftStrategy.winsNeeded > 0 && draftStrategy.suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Draft for:</p>
                  {draftStrategy.suggestions.map((s) => (
                    <div key={s.cat} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono accent-text w-10 shrink-0">{s.cat}</span>
                        <div className="flex-1 bg-[var(--navy-2)] rounded-full h-1">
                          <div className="h-1 rounded-full bg-[var(--gold)]" style={{ width: `${Math.min(s.pct, 100)}%` }} />
                        </div>
                        <span className="text-[9px] font-mono text-[var(--gold)] w-8 text-right">{s.pct.toFixed(0)}%</span>
                      </div>
                      {s.corrs.length > 0 && (
                        <div className="flex flex-wrap gap-1 pl-12">
                          {s.corrs.map((c) => (
                            <span key={c.cat} className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                              c.r > 0 ? 'border-[var(--accent)]/25 text-[var(--text-dim)]' : 'border-[var(--danger)]/25 text-[var(--danger)]'
                            }`}>
                              {c.r > 0 ? '↑' : '↓'} {c.cat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Collapsible correlation matrix */}
              {selectedCategories.length >= 2 && correlations.size > 0 && (
                <details>
                  <summary className="text-[10px] font-mono text-[var(--text-dim)] cursor-pointer hover:text-[var(--text)] select-none">
                    Stat Correlations
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="text-[8px] font-mono border-collapse w-full">
                      <thead>
                        <tr>
                          <th className="p-0.5 w-8"></th>
                          {selectedCategories.map((c) => (
                            <th key={c} className="p-0.5 text-center text-[var(--text-dim)] font-normal">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCategories.map((cat1) => (
                          <tr key={cat1}>
                            <td className="p-0.5 text-right text-[var(--text-dim)] font-semibold pr-1">{cat1}</td>
                            {selectedCategories.map((cat2) => {
                              if (cat1 === cat2) return (
                                <td key={cat2} className="p-0.5 text-center text-[var(--text-dim)] bg-[var(--navy-2)]">—</td>
                              );
                              const r = correlations.get(`${cat1}::${cat2}`) ?? 0;
                              const absR = Math.abs(r);
                              const color = absR < 0.3 ? 'text-[var(--text-dim)]' : r > 0 ? 'text-[var(--accent)]' : 'text-[var(--danger)]';
                              const bg = absR < 0.3 ? '' : r > 0 ? 'bg-[var(--accent)]/10' : 'bg-[var(--danger)]/10';
                              return (
                                <td key={cat2} className={`p-0.5 text-center ${color} ${bg}`}>
                                  {r.toFixed(2)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
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
              <option value="BATTERS">Batters</option>
              <option value="PITCHERS">Pitchers</option>
              {BASEBALL_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <PlayerTypeToggle value={playerTypeFilter} onChange={setPlayerTypeFilter} />
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
            avoidedIds={avoidedSet}
            onAvoid={handleAvoid}
          />
        </div>
      </div>
    </div>
  );
}
