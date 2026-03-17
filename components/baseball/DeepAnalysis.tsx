'use client';
import { useMemo, useState } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { computeRankings, applyTeamBoost } from '@/utils/rankings';
import {
  BASEBALL_CATEGORIES, BASEBALL_CATEGORY_LABELS, BASEBALL_POSITIONS,
  BASEBALL_CATEGORY_CORRELATIONS, matchesPositionFilter, PITCHING_CATS, BATTING_CATS,
} from '@/utils/constants';
import StatTable from '@/components/shared/StatTable';
import GlowCard from '@/components/shared/GlowCard';
import DataModeToggle from '@/components/shared/DataModeToggle';
import PlayerTypeToggle from '@/components/shared/PlayerTypeToggle';
import type { RankedPlayer } from '@/types';
import type { BaseballCategory } from '@/types';

const BATTER_POS_DEEP = new Set(['C', '1B', '2B', '3B', 'SS', 'OF', 'DH']);
const PITCHER_POS_DEEP = new Set(['SP', 'RP', 'P']);

export default function BaseballDeepAnalysis() {
  const {
    players, positionFilter, setPositionFilter,
    dataMode, setDataMode, pastPlayers, projectionPlayers,
    selectedCategories, toggleCategory,
    categoryWeights,
    playerTypeFilter, setPlayerTypeFilter,
    teamRankings, teamRankWeight, teamRankEnabled,
    flaggedPlayerIds, flagPlayer, unflagPlayer,
    avoidedPlayerIds, avoidPlayer, unavoidPlayer,
  } = useBaseballStore();

  const [search, setSearch] = useState('');

  const flaggedSet = useMemo(() => new Set(flaggedPlayerIds), [flaggedPlayerIds]);
  const avoidedSet = useMemo(() => new Set(avoidedPlayerIds), [avoidedPlayerIds]);

  const handleFlag = (player: RankedPlayer) => {
    if (flaggedSet.has(player.id)) unflagPlayer(player.id);
    else flagPlayer(player.id);
  };

  const handleAvoid = (player: RankedPlayer) => {
    if (avoidedSet.has(player.id)) unavoidPlayer(player.id);
    else avoidPlayer(player.id);
  };

  const typeFilteredPlayers = useMemo(() => {
    if (playerTypeFilter === 'pitchers') return players.filter(p => p.positions.some(pos => PITCHER_POS_DEEP.has(pos)));
    if (playerTypeFilter === 'batters') return players.filter(p => p.positions.some(pos => BATTER_POS_DEEP.has(pos)));
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

  const ranked = useMemo(() => {
    if (typeFilteredPlayers.length === 0) return [];
    const baseRanked = computeRankings(typeFilteredPlayers, activeCats, categoryWeights, 'baseball');
    if (!teamRankEnabled || teamRankings.length === 0 || teamRankWeight <= 1) return baseRanked;
    return applyTeamBoost(baseRanked, teamRankings, teamRankWeight);
  }, [typeFilteredPlayers, activeCats, categoryWeights, teamRankEnabled, teamRankings, teamRankWeight]);

  const filtered = useMemo(() => {
    let list = ranked;
    if (positionFilter !== 'ALL') {
      list = list.filter((p) => matchesPositionFilter(p.positions, positionFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
    }
    return list;
  }, [ranked, positionFilter, search]);

  const columns = useMemo(() => [
    { key: 'name', label: 'Player', format: (_: unknown, p: RankedPlayer) =>
      <span className="font-medium text-[var(--text)]">{p.name}</span> },
    { key: 'compositeScore', label: 'Score', format: (_: unknown, p: RankedPlayer) =>
      <span className="font-mono text-xs accent-text">{p.compositeScore.toFixed(3)}</span>, sortable: true },
    { key: 'team', label: 'Team', format: (_: unknown, p: RankedPlayer) =>
      <span className="text-[var(--text-dim)] font-mono text-xs">{p.team}</span> },
    { key: 'positions', label: 'Pos', format: (_: unknown, p: RankedPlayer) =>
      <span className="text-xs accent-text font-mono">{p.positions.join(', ')}</span> },
    ...BASEBALL_CATEGORIES.map((cat) => ({
      key: `stats.${cat}`, label: cat,
      format: (_: unknown, p: RankedPlayer) => {
        const v = p.stats[cat];
        if (v === undefined) return '—';
        return ['ERA', 'WHIP', 'OBP'].includes(cat) ? v.toFixed(3)
          : ['HR', 'R', 'RBI', 'SB', 'K', 'SV', 'W'].includes(cat) ? v.toFixed(0)
          : v.toFixed(1);
      },
    })),
    { key: 'stats.AVG', label: 'AVG', format: (_: unknown, p: RankedPlayer) => p.stats.AVG?.toFixed(3) ?? '—' },
    { key: 'stats.BB', label: 'BB', format: (_: unknown, p: RankedPlayer) => p.stats.BB?.toFixed(0) ?? '—' },
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
  ], []);

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">🔬</div>
        <h2 className="text-xl font-semibold text-[var(--text)] mb-2">No Player Data</h2>
        <a href="/upload" className="px-6 py-2.5 rounded-xl accent-bg text-[var(--navy)] font-semibold text-sm">Upload Data →</a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl tracking-widest text-[var(--text)]">DEEP ANALYSIS</h1>
          <p className="text-[var(--text-dim)] text-sm mt-1">
            Rank by selected categories. Adjust weights and team boost in Settings.
          </p>
        </div>
        <DataModeToggle mode={dataMode} onChange={setDataMode} pastCount={pastPlayers.length} projCount={projectionPlayers.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: category toggles + correlations */}
        <div className="space-y-4">
          {/* Category toggles */}
          <GlowCard className="space-y-4" hover={false}>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Categories</h2>
              <a href="/baseball/settings" className="text-xs text-[var(--text-dim)] hover:accent-text hover:underline">
                Weights in Settings →
              </a>
            </div>
            <div className="flex flex-wrap gap-2">
              {BASEBALL_CATEGORIES.map((cat) => {
                const active = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-medium border transition-all ${
                      active
                        ? 'accent-bg text-[var(--navy)] border-transparent'
                        : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent)]'
                    }`}
                  >
                    {active && <span>✓</span>}
                    {cat}
                    <span className="text-[9px] opacity-60">{BASEBALL_CATEGORY_LABELS[cat as BaseballCategory]}</span>
                  </button>
                );
              })}
            </div>
          </GlowCard>

          {/* Correlation map */}
          <GlowCard className="space-y-3" hover={false}>
            <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Stat Correlations</h2>
            <div className="space-y-2">
              {BASEBALL_CATEGORIES.map((cat) => {
                const corrs = BASEBALL_CATEGORY_CORRELATIONS[cat] ?? [];
                if (corrs.length === 0) return null;
                return (
                  <div key={cat} className="flex items-start gap-2">
                    <span className="text-xs font-mono text-[var(--text)] w-10 shrink-0 pt-0.5">{cat}</span>
                    <div className="flex flex-wrap gap-1">
                      {corrs.map(({ cat: c, strength }) => (
                        <span key={c} className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${strength > 0 ? 'border-[var(--neon)] border-opacity-30 text-[var(--neon)]' : 'border-[var(--danger)] border-opacity-30 text-[var(--danger)]'}`}>
                          {c} {strength > 0 ? '+' : ''}{(strength * 100).toFixed(0)}%
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlowCard>
        </div>

        {/* Right: table */}
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
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            {filtered.length} players · Category weights set in{' '}
            <a href="/baseball/settings" className="accent-text hover:underline">Settings</a>.
          </p>
          <StatTable
            players={filtered}
            columns={columns}
            showRank
            maxHeight="640px"
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
