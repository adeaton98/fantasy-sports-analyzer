'use client';
import { useMemo, useState } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { useLeagueHistoryStore } from '@/store/useLeagueHistoryStore';
import { computeAuctionValues, totalDraftPool, computeValueEfficiency, computeValueRanges, applyBatterPitcherSkew } from '@/utils/auctionCalc';
import { applyTeamBoost } from '@/utils/rankings';
import { BASEBALL_POSITIONS, matchesPositionFilter, PITCHING_CATS, BATTING_CATS } from '@/utils/constants';
import { computeAvgDraftPrices, lookupHistPrice } from '@/utils/leagueHistoryParser';
import StatTable from '@/components/shared/StatTable';
import DataModeToggle from '@/components/shared/DataModeToggle';
import PlayerTypeToggle from '@/components/shared/PlayerTypeToggle';
import type { RankedPlayer } from '@/types';
import type { BaseballCategory } from '@/types';

const BATTER_POS_AUCTION = new Set(['C', '1B', '2B', '3B', 'SS', 'OF', 'DH']);
const PITCHER_POS_AUCTION = new Set(['SP', 'RP', 'P']);

export default function AuctionCalculator() {
  const {
    players, selectedCategories, leagueSettings,
    categoryWeights,
    positionFilter, setPositionFilter,
    dataMode, setDataMode, pastPlayers, projectionPlayers,
    inflationScale, deflationScale,
    batterPitcherSkew,
    flaggedPlayerIds, flagPlayer, unflagPlayer,
    avoidedPlayerIds, avoidPlayer, unavoidPlayer,
    clearPlayers,
    playerTypeFilter, setPlayerTypeFilter,
    teamRankings, teamRankWeight, teamRankEnabled,
  } = useBaseballStore();

  const { draftRecaps } = useLeagueHistoryStore();

  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showRange, setShowRange] = useState(false);
  const [lockedValues, setLockedValues] = useState<Map<string, number>>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'by-position'>('all');
  const [posTabPos, setPosTabPos] = useState('C');

  const poolSize = totalDraftPool(leagueSettings);
  const flaggedSet = useMemo(() => new Set(flaggedPlayerIds), [flaggedPlayerIds]);
  const avoidedSet = useMemo(() => new Set(avoidedPlayerIds), [avoidedPlayerIds]);

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

  // Base computed values (unmodified)
  const valued = useMemo(() => {
    if (typeFilteredPlayers.length === 0 || !leagueSettings.isAuction) return [];
    const skewedWeights = applyBatterPitcherSkew(categoryWeights, batterPitcherSkew);
    const auctionValued = computeAuctionValues(typeFilteredPlayers, activeCats, skewedWeights, leagueSettings, inflationScale, deflationScale);
    if (!teamRankEnabled || teamRankings.length === 0 || teamRankWeight <= 1) return auctionValued;
    return applyTeamBoost(auctionValued, teamRankings, teamRankWeight);
  }, [typeFilteredPlayers, activeCats, categoryWeights, batterPitcherSkew, leagueSettings, inflationScale, deflationScale, teamRankEnabled, teamRankings, teamRankWeight]);

  // Locked + redistributed values
  const adjustedValued = useMemo(() => {
    if (lockedValues.size === 0) return valued;
    const baseTotal = valued.reduce((s, p) => s + (p.auctionValue ?? 1), 0);
    const lockedSum = [...lockedValues.values()].reduce((s, v) => s + v, 0);
    const unlockedPlayers = valued.filter(p => !lockedValues.has(p.id));
    const unlockedBaseSum = unlockedPlayers.reduce((s, p) => s + (p.auctionValue ?? 1), 0);
    // Ensure unlocked players get at least $1 each
    const remainingForUnlocked = Math.max(unlockedPlayers.length, baseTotal - lockedSum);
    const scaleFactor = unlockedBaseSum > 0 ? remainingForUnlocked / unlockedBaseSum : 1;
    return valued.map(p => ({
      ...p,
      auctionValue: lockedValues.has(p.id)
        ? lockedValues.get(p.id)!
        : Math.max(1, Math.round((p.auctionValue ?? 1) * scaleFactor)),
    }));
  }, [valued, lockedValues]);

  const efficiencyMap = useMemo(() => {
    if (!showSuggestions) return new Map<string, 'under' | 'over' | 'fair'>();
    return computeValueEfficiency(adjustedValued);
  }, [adjustedValued, showSuggestions]);

  const rangesMap = useMemo(() => {
    if (!showRange) return new Map<string, { low: number; high: number }>();
    return computeValueRanges(adjustedValued);
  }, [adjustedValued, showRange]);

  const filtered = useMemo(() => {
    let list = adjustedValued;
    if (positionFilter !== 'ALL') {
      list = list.filter((p) => matchesPositionFilter(p.positions, positionFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [adjustedValued, positionFilter, search]);

  const totalMoney = leagueSettings.numTeams * leagueSettings.budget;
  const assignedMoney = adjustedValued.reduce((s, p) => s + (p.auctionValue ?? 0), 0);

  const avgPriceMap = useMemo(() => computeAvgDraftPrices(draftRecaps), [draftRecaps]);

  const histPriceById = useMemo(() => {
    const map = new Map<string, number>();
    if (draftRecaps.length === 0) return map;
    for (const p of adjustedValued) {
      const v = lookupHistPrice(p.name, avgPriceMap);
      if (v !== null) map.set(p.id, v);
    }
    return map;
  }, [adjustedValued, avgPriceMap, draftRecaps.length]);

  const POS_TAB_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'SP', 'RP'];

  const positionBreakdown = useMemo(() => {
    const result = new Map<string, { players: RankedPlayer[]; avg: number; avgHist: number | null }>();
    for (const pos of POS_TAB_POSITIONS) {
      const top30 = adjustedValued
        .filter(p => matchesPositionFilter(p.positions, pos))
        .slice(0, 30);
      const avg = top30.length > 0
        ? Math.round(top30.reduce((s, p) => s + (p.auctionValue ?? 1), 0) / top30.length)
        : 0;
      const histPrices = top30.map(p => histPriceById.get(p.id)).filter((v): v is number => v != null);
      const avgHist = histPrices.length > 0
        ? Math.round(histPrices.reduce((s, v) => s + v, 0) / histPrices.length)
        : null;
      result.set(pos, { players: top30, avg, avgHist });
    }
    return result;
  }, [adjustedValued, histPriceById]);

  const handleLockValue = (playerId: string, value: number) => {
    setLockedValues(prev => new Map(prev).set(playerId, value));
  };

  const handleUnlockValue = (playerId: string) => {
    setLockedValues(prev => {
      const next = new Map(prev);
      next.delete(playerId);
      return next;
    });
  };

  const handleFlag = (player: RankedPlayer) => {
    if (flaggedSet.has(player.id)) unflagPlayer(player.id);
    else flagPlayer(player.id);
  };

  const handleAvoid = (player: RankedPlayer) => {
    if (avoidedSet.has(player.id)) unavoidPlayer(player.id);
    else avoidPlayer(player.id);
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
        if (range) return <span className="font-mono font-bold text-[var(--gold)]">${range.low}–${range.high}</span>;
      }
      const isLocked = lockedValues.has(p.id);
      const currentValue = p.auctionValue ?? 1;
      if (editingId === p.id) {
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <span className="text-[var(--text-dim)] text-xs">$</span>
            <input
              autoFocus
              type="number" min={1} max={leagueSettings.budget}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => {
                const v = parseInt(editValue);
                if (!isNaN(v) && v >= 1) handleLockValue(p.id, v);
                setEditingId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = parseInt(editValue);
                  if (!isNaN(v) && v >= 1) handleLockValue(p.id, v);
                  setEditingId(null);
                }
                if (e.key === 'Escape') setEditingId(null);
              }}
              className="w-14 bg-[var(--navy-2)] border border-[var(--accent)] rounded px-1.5 py-0.5 text-sm text-[var(--gold)] text-center outline-none"
            />
          </div>
        );
      }
      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {isLocked && (
            <button
              onClick={() => handleUnlockValue(p.id)}
              title="Unlock value"
              className="text-[10px] text-[var(--accent)] opacity-70 hover:opacity-100 leading-none"
            >
              ⚿
            </button>
          )}
          <span
            title={isLocked ? 'Locked — click to edit, click ⚿ to unlock' : 'Click to edit'}
            onClick={() => { setEditingId(p.id); setEditValue(String(currentValue)); }}
            className={`font-mono font-bold cursor-pointer select-none transition-colors ${
              isLocked
                ? 'text-[var(--accent)]'
                : 'text-[var(--gold)] hover:text-[var(--accent)]'
            }`}
          >
            ${currentValue}
          </span>
        </div>
      );
    }},
    ...(draftRecaps.length > 0 ? [{
      key: 'histPrice', label: 'Hist. $', format: (_: unknown, p: RankedPlayer) => {
        const v = histPriceById.get(p.id);
        return v != null
          ? <span className="font-mono text-xs text-[var(--text-dim)]">${v}</span>
          : <span className="text-[var(--text-dim)]">—</span>;
      },
    }] : []),
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
  ], [selectedCategories, showRange, rangesMap, draftRecaps.length, histPriceById,
      lockedValues, editingId, editValue, leagueSettings.budget]);

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
        <a href="/baseball/settings" className="mt-4 text-sm accent-text hover:underline">Update league settings in Settings →</a>
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

  const posData = positionBreakdown.get(posTabPos);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-5xl tracking-widest text-[var(--text)]">AUCTION VALUES</h1>
          <div className="flex items-center gap-4 mt-2 flex-wrap text-sm">
            <span className="text-[var(--text-dim)]">
              {leagueSettings.numTeams} teams ·{' '}
              <span className="text-[var(--gold)]">${leagueSettings.budget}</span> budget ·{' '}
              {poolSize} player pool
              <a href="/baseball/settings" className="ml-2 text-xs text-[var(--text-dim)] hover:accent-text hover:underline">(edit in Settings)</a>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <DataModeToggle mode={dataMode} onChange={setDataMode} pastCount={pastPlayers.length} projCount={projectionPlayers.length} />
          {lockedValues.size > 0 && (
            <button
              onClick={() => setLockedValues(new Map())}
              className="text-xs border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] px-3 py-1.5 rounded-lg transition-colors"
            >
              Reset {lockedValues.size} lock{lockedValues.size !== 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={() => { if (window.confirm('Clear all player data?')) clearPlayers(); }}
            className="text-xs border border-red-500/50 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors"
          >
            Reset Data
          </button>
          <div className="text-right">
            <div className="text-xs text-[var(--text-dim)] font-mono">Total Assigned</div>
            <div className="font-mono font-bold text-xl text-[var(--gold)]">${assignedMoney.toLocaleString()}</div>
            <div className="text-xs text-[var(--text-dim)] font-mono">of ${totalMoney.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] pb-0">
        {(['all', 'by-position'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab
                ? 'accent-text border-[var(--accent)]'
                : 'text-[var(--text-dim)] border-transparent hover:text-[var(--text)]'
            }`}
          >
            {tab === 'all' ? 'All Players' : 'Value by Position'}
          </button>
        ))}
      </div>

      {/* All Players tab */}
      {activeTab === 'all' && (
        <div className="space-y-3">
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

          {lockedValues.size > 0 && (
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-dim)]">
              <span className="text-[var(--accent)] opacity-70">⚿</span>
              <span>{lockedValues.size} value{lockedValues.size !== 1 ? 's' : ''} locked — other values redistributed proportionally. Click ⚿ to unlock individually.</span>
            </div>
          )}

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
            avoidedIds={avoidedSet}
            onAvoid={handleAvoid}
          />
        </div>
      )}

      {/* Value by Position tab */}
      {activeTab === 'by-position' && (
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-dim)]">
            Top 30 players at each position by global auction value. Values are from the full player pool — not position-filtered.
          </p>
          {/* Position selector */}
          <div className="flex flex-wrap gap-2">
            {POS_TAB_POSITIONS.map((pos) => {
              const d = positionBreakdown.get(pos);
              return (
                <button
                  key={pos}
                  onClick={() => setPosTabPos(pos)}
                  className={`flex flex-col items-center px-3 py-2 rounded-lg border text-xs transition-all ${
                    posTabPos === pos
                      ? 'accent-bg text-[var(--navy)] border-transparent'
                      : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent)]/40'
                  }`}
                >
                  <span className="font-mono font-bold">{pos}</span>
                  {d && d.avg > 0 && (
                    <span className={`font-mono text-[10px] mt-0.5 ${posTabPos === pos ? 'text-[var(--navy)]/70' : 'text-[var(--gold)]'}`}>
                      ${d.avg}
                    </span>
                  )}
                  {d && d.avgHist != null && (
                    <span className={`font-mono text-[10px] ${posTabPos === pos ? 'text-[var(--navy)]/50' : 'text-[var(--text-dim)]'}`}>
                      hist ${d.avgHist}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Position table */}
          {posData && posData.players.length > 0 ? (
            <div>
              <div className="flex items-center gap-4 mb-3">
                <span className="font-display text-2xl tracking-wider accent-text">{posTabPos}</span>
                <div className="text-xs text-[var(--text-dim)]">
                  {posData.players.length} players ·{' '}
                  <span className="text-[var(--gold)] font-mono">avg ${posData.avg}</span>{' '}
                  across top {posData.players.length}
                </div>
              </div>
              <div className="rounded-xl overflow-hidden border border-[var(--border)]">
                <div className="overflow-auto max-h-[560px]">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '52px' }}>#</th>
                        <th>Player</th>
                        <th>Team</th>
                        <th>Pos</th>
                        <th style={{ width: '90px' }}>Value ($)</th>
                        {draftRecaps.length > 0 && <th style={{ width: '80px' }}>Hist. $</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {posData.players.map((p, i) => (
                        <tr key={p.id} className={avoidedSet.has(p.id) ? 'opacity-40' : ''}>
                          <td><span className="text-xs font-mono text-[var(--text-dim)]">#{p.rank}</span></td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-[var(--text)]">{p.name}</span>
                              {i === 0 && <span className="text-[10px] font-mono text-[var(--gold)]">top</span>}
                            </div>
                          </td>
                          <td><span className="font-mono text-xs text-[var(--text-dim)]">{p.team}</span></td>
                          <td><span className="text-xs accent-text font-mono">{p.positions.join(', ')}</span></td>
                          <td>
                            <span className="font-mono font-bold text-[var(--gold)]">${p.auctionValue ?? 1}</span>
                          </td>
                          {draftRecaps.length > 0 && (
                            <td>
                              {histPriceById.get(p.id) != null
                                ? <span className="font-mono text-xs text-[var(--text-dim)]">${histPriceById.get(p.id)}</span>
                                : <span className="text-[var(--text-dim)]">—</span>}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-[var(--text-dim)] text-sm">No players found for {posTabPos}.</div>
          )}
        </div>
      )}
    </div>
  );
}
