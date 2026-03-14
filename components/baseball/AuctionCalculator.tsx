'use client';
import { useMemo, useState } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { computeAuctionValues, totalDraftPool, computeValueEfficiency, computeValueRanges } from '@/utils/auctionCalc';
import { applyTeamBoost } from '@/utils/rankings';
import { BASEBALL_CATEGORIES, BASEBALL_CATEGORY_LABELS, BASEBALL_POSITIONS, matchesPositionFilter, PITCHING_CATS, BATTING_CATS } from '@/utils/constants';
import CategorySlider from '@/components/shared/CategorySlider';
import StatTable from '@/components/shared/StatTable';
import GlowCard from '@/components/shared/GlowCard';
import DataModeToggle from '@/components/shared/DataModeToggle';
import PlayerTypeToggle from '@/components/shared/PlayerTypeToggle';
import TeamRankingPanel from '@/components/shared/TeamRankingPanel';
import type { RankedPlayer } from '@/types';
import type { BaseballCategory } from '@/types';

const ROSTER_KEYS_BASE = ['C', '1B', '2B', '2B/SS', '1B/3B', '3B', 'SS', 'OF', 'UTIL', 'BN', 'IL'] as const;
const PITCHER_KEYS = ['SP', 'RP'] as const;

function MarketScaleSlider({ label, desc, value, onChange }: {
  label: string; desc: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-[var(--text)]">{label}</div>
          <div className="text-[10px] text-[var(--text-dim)]">{desc}</div>
        </div>
        <span className="text-sm font-mono accent-text">{value.toFixed(1)}x</span>
      </div>
      <input
        type="range" min={1} max={3} step={0.1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: 'var(--accent)' }}
      />
      <div className="flex justify-between text-[9px] text-[var(--text-dim)] font-mono">
        <span>1x (neutral)</span><span>2x</span><span>3x</span>
      </div>
    </div>
  );
}

const BATTER_POS_AUCTION = new Set(['C', '1B', '2B', '3B', 'SS', 'OF', 'DH']);
const PITCHER_POS_AUCTION = new Set(['SP', 'RP', 'P']);

export default function AuctionCalculator() {
  const {
    players, selectedCategories, leagueSettings, updateLeagueSettings,
    categoryWeights, setCategoryWeight, resetWeights,
    positionFilter, setPositionFilter,
    dataMode, setDataMode, pastPlayers, projectionPlayers,
    inflationScale, deflationScale, setInflationScale, setDeflationScale,
    flaggedPlayerIds, flagPlayer, unflagPlayer,
    clearPlayers,
    playerTypeFilter, setPlayerTypeFilter,
    teamRankings, teamRankWeight, teamRankEnabled,
  } = useBaseballStore();

  const [search, setSearch] = useState('');
  const [editingBudget, setEditingBudget] = useState(false);
  const [editingTeams, setEditingTeams] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showRange, setShowRange] = useState(false);

  const noPD = leagueSettings.noPitcherDesignation ?? false;
  const poolSize = totalDraftPool(leagueSettings);
  const flaggedSet = useMemo(() => new Set(flaggedPlayerIds), [flaggedPlayerIds]);

  const typeFilteredPlayers = useMemo(() => {
    if (playerTypeFilter === 'pitchers') return players.filter(p => p.positions.some(pos => PITCHER_POS_AUCTION.has(pos)));
    if (playerTypeFilter === 'batters') return players.filter(p => p.positions.some(pos => BATTER_POS_AUCTION.has(pos)));
    return players;
  }, [players, playerTypeFilter]);

  const activeCats = useMemo(() => {
    const typeCats = playerTypeFilter === 'pitchers'
      ? selectedCategories.filter(c => PITCHING_CATS.includes(c as BaseballCategory))
      : playerTypeFilter === 'batters'
      ? selectedCategories.filter(c => BATTING_CATS.includes(c as BaseballCategory))
      : selectedCategories;
    return typeCats;
  }, [selectedCategories, playerTypeFilter]);

  const valued = useMemo(() => {
    if (typeFilteredPlayers.length === 0 || !leagueSettings.isAuction) return [];
    const auctionValued = computeAuctionValues(typeFilteredPlayers, activeCats, categoryWeights, leagueSettings, inflationScale, deflationScale);
    if (!teamRankEnabled || teamRankings.length === 0 || teamRankWeight <= 1) return auctionValued;
    return applyTeamBoost(auctionValued, teamRankings, teamRankWeight);
  }, [typeFilteredPlayers, activeCats, categoryWeights, leagueSettings, inflationScale, deflationScale, teamRankEnabled, teamRankings, teamRankWeight]);

  const efficiencyMap = useMemo(() => {
    if (!showSuggestions) return new Map<string, 'under' | 'over' | 'fair'>();
    return computeValueEfficiency(valued);
  }, [valued, showSuggestions]);

  const rangesMap = useMemo(() => {
    if (!showRange) return new Map<string, { low: number; high: number }>();
    return computeValueRanges(valued);
  }, [valued, showRange]);

  const filtered = useMemo(() => {
    let list = valued;
    if (positionFilter !== 'ALL') {
      list = list.filter((p) => matchesPositionFilter(p.positions, positionFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [valued, positionFilter, search]);

  const totalMoney = leagueSettings.numTeams * leagueSettings.budget;
  const assignedMoney = valued.reduce((s, p) => s + (p.auctionValue ?? 0), 0);

  const handleFlag = (player: RankedPlayer) => {
    if (flaggedSet.has(player.id)) {
      unflagPlayer(player.id);
    } else {
      flagPlayer(player.id);
    }
  };

  const columns = useMemo(() => [
    { key: 'name', label: 'Player', format: (_: unknown, p: RankedPlayer) =>
      <span className="font-medium text-[var(--text)]">{p.name}</span> },
    { key: 'compositeScore', label: 'Score', format: (_: unknown, p: RankedPlayer) =>
      <span className="font-mono text-xs accent-text">{p.compositeScore.toFixed(3)}</span> },
    { key: 'team', label: 'Team', format: (_: unknown, p: RankedPlayer) =>
      <span className="text-[var(--text-dim)] font-mono text-xs">{p.team}</span> },
    { key: 'positions', label: 'Pos', format: (_: unknown, p: RankedPlayer) =>
      <span className="text-xs accent-text font-mono">{p.positions.join(', ')}</span> },
    { key: 'auctionValue', label: 'Value ($)', format: (_: unknown, p: RankedPlayer) => {
      if (showRange) {
        const range = rangesMap.get(p.id);
        if (range) {
          return <span className="font-mono font-bold text-[var(--gold)]">${range.low}–${range.high}</span>;
        }
      }
      return <span className="font-mono font-bold text-[var(--gold)]">${p.auctionValue ?? 1}</span>;
    }},
    { key: 'valueAboveReplacement', label: 'VAR', format: (_: unknown, p: RankedPlayer) =>
      <span className="font-mono text-xs accent-text">{(p.valueAboveReplacement ?? 0).toFixed(3)}</span> },
    { key: 'stats.IP', label: 'IP', sortable: true,
      format: (_: unknown, p: RankedPlayer) => {
        const v = p.stats.IP;
        return v !== undefined ? <span className="font-mono text-xs text-[var(--text-dim)]">{v.toFixed(1)}</span> : <span className="text-[var(--text-dim)]">—</span>;
      }
    },
    { key: 'stats.AB', label: 'AB', sortable: true,
      format: (_: unknown, p: RankedPlayer) => {
        const v = p.stats.AB;
        return v !== undefined ? <span className="font-mono text-xs text-[var(--text-dim)]">{v.toFixed(0)}</span> : <span className="text-[var(--text-dim)]">—</span>;
      }
    },
    ...selectedCategories.map((cat) => ({
      key: `stats.${cat}`,
      label: cat,
      format: (_: unknown, p: RankedPlayer) => {
        const v = p.stats[cat];
        if (v === undefined) return '—';
        return ['ERA', 'WHIP', 'OBP'].includes(cat) ? v.toFixed(3) : v.toFixed(0);
      },
    })),
  ], [selectedCategories, showRange, rangesMap]);

  const rowHighlight = useMemo(() => {
    if (!showSuggestions) return undefined;
    return (player: RankedPlayer): 'yellow' | 'red' | undefined => {
      const eff = efficiencyMap.get(player.id);
      if (eff === 'under') return 'yellow';
      if (eff === 'over') return 'red';
      return undefined;
    };
  }, [showSuggestions, efficiencyMap]);

  if (!leagueSettings.isAuction) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h2 className="text-xl font-semibold text-[var(--text)] mb-2">Snake Draft Mode</h2>
        <p className="text-[var(--text-dim)] text-sm">Your league uses a snake draft. Auction values are only available for auction leagues.</p>
        <a href="/baseball/setup" className="mt-4 text-sm accent-text hover:underline">Update league settings →</a>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-xl font-semibold text-[var(--text)] mb-2">No Player Data</h2>
        <a href="/upload" className="mt-2 px-6 py-2.5 rounded-xl accent-bg text-[var(--navy)] font-semibold text-sm">Upload Data →</a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl tracking-widest text-[var(--text)]">AUCTION VALUES</h1>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-dim)]">Teams:</span>
              {editingTeams ? (
                <input type="number" min={2} max={30} autoFocus defaultValue={leagueSettings.numTeams}
                  onBlur={(e) => { updateLeagueSettings({ numTeams: parseInt(e.target.value) || leagueSettings.numTeams }); setEditingTeams(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingTeams(false); }}
                  className="w-16 bg-[var(--navy-2)] border border-[var(--accent)] rounded px-2 py-0.5 text-sm text-[var(--text)] outline-none font-mono" />
              ) : (
                <button onClick={() => setEditingTeams(true)} className="text-sm font-mono accent-text hover:underline cursor-text">
                  {leagueSettings.numTeams} <span className="text-[9px] text-[var(--text-dim)]">✎</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-dim)]">Budget:</span>
              {editingBudget ? (
                <input type="number" min={50} max={10000} autoFocus defaultValue={leagueSettings.budget}
                  onBlur={(e) => { updateLeagueSettings({ budget: parseInt(e.target.value) || leagueSettings.budget }); setEditingBudget(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingBudget(false); }}
                  className="w-20 bg-[var(--navy-2)] border border-[var(--accent)] rounded px-2 py-0.5 text-sm text-[var(--gold)] outline-none font-mono" />
              ) : (
                <button onClick={() => setEditingBudget(true)} className="text-sm font-mono text-[var(--gold)] hover:underline cursor-text">
                  ${leagueSettings.budget} <span className="text-[9px] text-[var(--text-dim)]">✎</span>
                </button>
              )}
            </div>
            <button onClick={() => setShowRoster(!showRoster)}
              className="text-xs text-[var(--text-dim)] hover:accent-text border border-[var(--border)] px-2.5 py-1 rounded-lg transition-colors">
              {showRoster ? '▲' : '▼'} Roster Slots
            </button>
            <span className="text-xs text-[var(--text-dim)]">Draft pool: {poolSize} players</span>
          </div>

          {/* Inline roster slots */}
          {showRoster && (
            <div className="mt-3 p-3 rounded-xl bg-[var(--navy-2)] border border-[var(--border)]">
              {/* NoPitcherDesignation toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none mb-3">
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
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
                {ROSTER_KEYS_BASE.map((key) => (
                  <div key={key} className="text-center">
                    <div className="text-[10px] font-mono text-[var(--text-dim)] mb-0.5">{key}</div>
                    <input
                      type="number" min={0} max={20}
                      value={(leagueSettings.rosterSlots as Record<string, number>)[key] ?? 0}
                      onChange={(e) => updateLeagueSettings({
                        rosterSlots: { ...leagueSettings.rosterSlots, [key]: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded px-1 py-1 text-sm text-center text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                ))}
                {noPD ? (
                  <div className="text-center">
                    <div className="text-[10px] font-mono text-[var(--accent)] mb-0.5">P</div>
                    <input
                      type="number" min={0} max={20}
                      value={(leagueSettings.rosterSlots as Record<string, number>).P ?? 0}
                      onChange={(e) => updateLeagueSettings({
                        rosterSlots: { ...leagueSettings.rosterSlots, P: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full bg-[var(--card)] border border-[var(--accent)] border-opacity-50 rounded px-1 py-1 text-sm text-center text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                ) : (
                  <>
                    {PITCHER_KEYS.map((key) => (
                      <div key={key} className="text-center">
                        <div className="text-[10px] font-mono text-[var(--text-dim)] mb-0.5">{key}</div>
                        <input
                          type="number" min={0} max={20}
                          value={(leagueSettings.rosterSlots as Record<string, number>)[key] ?? 0}
                          onChange={(e) => updateLeagueSettings({
                            rosterSlots: { ...leagueSettings.rosterSlots, [key]: parseInt(e.target.value) || 0 }
                          })}
                          className="w-full bg-[var(--card)] border border-[var(--border)] rounded px-1 py-1 text-sm text-center text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <DataModeToggle mode={dataMode} onChange={setDataMode} pastCount={pastPlayers.length} projCount={projectionPlayers.length} />
          <button
            onClick={() => { if (window.confirm('Clear all player data?')) clearPlayers(); }}
            className="text-xs border border-red-500/50 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors">
            Reset Data
          </button>
          <div className="text-right">
            <div className="text-xs text-[var(--text-dim)] font-mono">Total Assigned</div>
            <div className="font-mono font-bold text-xl text-[var(--gold)]">${assignedMoney.toLocaleString()}</div>
            <div className="text-xs text-[var(--text-dim)] font-mono">of ${totalMoney.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left panel: weights + market scales */}
        <GlowCard className="space-y-5 self-start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Category Weights</h2>
              <button onClick={resetWeights} className="text-xs text-[var(--text-dim)] hover:accent-text hover:underline">Reset</button>
            </div>
            <div className="space-y-4">
              {BASEBALL_CATEGORIES.map((cat) => (
                <CategorySlider key={cat} category={cat} label={BASEBALL_CATEGORY_LABELS[cat as BaseballCategory]}
                  value={categoryWeights[cat] ?? 1} onChange={(v) => setCategoryWeight(cat, v)} />
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border)] space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Market Scales</h2>
            <MarketScaleSlider
              label="Inflation Scale"
              desc={`Top 100 players overvalued — boosts their suggested bids`}
              value={inflationScale}
              onChange={setInflationScale}
            />
            <MarketScaleSlider
              label="Deflation Scale"
              desc={`Bottom ${Math.min(100, poolSize)} players undervalued — reduces their suggested bids`}
              value={deflationScale}
              onChange={setDeflationScale}
            />
            <p className="text-[10px] text-[var(--text-dim)]">
              Adjust to match your league's bidding tendencies. Inflation = elite players go for more; deflation = late-round players are cheap.
            </p>
          </div>
        </GlowCard>

        {/* Table */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <input type="text" placeholder="Search players..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]" />
            <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}
              className="bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
              <option value="ALL">All Positions</option>
              {BASEBALL_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <PlayerTypeToggle value={playerTypeFilter} onChange={setPlayerTypeFilter} />
            <TeamRankingPanel />
            <button
              onClick={() => setShowSuggestions((v) => !v)}
              className={`text-xs border px-3 py-2 rounded-lg transition-colors ${showSuggestions ? 'accent-bg text-[var(--navy)] border-transparent' : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]'}`}
            >
              Suggestions
            </button>
            <button
              onClick={() => setShowRange((v) => !v)}
              className={`text-xs border px-3 py-2 rounded-lg transition-colors ${showRange ? 'accent-bg text-[var(--navy)] border-transparent' : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]'}`}
            >
              Show Range
            </button>
          </div>
          {showSuggestions && (
            <div className="flex items-center gap-3 text-[10px] text-[var(--text-dim)]">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-yellow-900/40 border border-yellow-700/40" /> Undervalued (high VAR/price)</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-900/40 border border-red-700/40" /> Overvalued (low VAR/price)</span>
            </div>
          )}
          <StatTable
            players={filtered}
            columns={columns}
            showRank
            maxHeight="600px"
            rowHighlight={rowHighlight}
            flaggedIds={flaggedSet}
            onFlag={handleFlag}
          />
        </div>
      </div>
    </div>
  );
}
