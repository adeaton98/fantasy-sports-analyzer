'use client';
import { useMemo, useState } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { computeRankings, applyTeamBoost } from '@/utils/rankings';
import { BASEBALL_CATEGORIES, BASEBALL_CATEGORY_LABELS, BASEBALL_POSITIONS, matchesPositionFilter, PITCHING_CATS, BATTING_CATS } from '@/utils/constants';
import StatTable from '@/components/shared/StatTable';
import GlowCard from '@/components/shared/GlowCard';
import DataModeToggle from '@/components/shared/DataModeToggle';
import PlayerTypeToggle from '@/components/shared/PlayerTypeToggle';
import TeamRankingPanel from '@/components/shared/TeamRankingPanel';
import type { RankedPlayer } from '@/types';
import type { BaseballCategory } from '@/types';

const BATTER_POS = new Set(['C', '1B', '2B', '3B', 'SS', 'OF', 'DH']);
const PITCHER_POS = new Set(['SP', 'RP', 'P']);

export default function BaseballPlayerAnalysis() {
  const {
    players, clearPlayers, selectedCategories, toggleCategory,
    positionFilter, setPositionFilter, categoryWeights,
    dataMode, setDataMode, pastPlayers, projectionPlayers,
    playerTypeFilter, setPlayerTypeFilter,
    teamRankings, teamRankWeight, teamRankEnabled,
  } = useBaseballStore();

  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const typeFilteredPlayers = useMemo(() => {
    if (playerTypeFilter === 'pitchers') return players.filter(p => p.positions.some(pos => PITCHER_POS.has(pos)));
    if (playerTypeFilter === 'batters') return players.filter(p => p.positions.some(pos => BATTER_POS.has(pos)));
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
    return computeRankings(typeFilteredPlayers, activeCats, categoryWeights, 'baseball');
  }, [typeFilteredPlayers, activeCats, categoryWeights]);

  const boosted = useMemo(() => {
    if (!teamRankEnabled || teamRankings.length === 0 || teamRankWeight <= 1) return ranked;
    return applyTeamBoost(ranked, teamRankings, teamRankWeight);
  }, [ranked, teamRankEnabled, teamRankings, teamRankWeight]);

  const filtered = useMemo(() => {
    let list = boosted;
    if (positionFilter !== 'ALL') {
      list = list.filter((p) => matchesPositionFilter(p.positions, positionFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
    }
    return list;
  }, [boosted, positionFilter, search]);

  const columns = useMemo(() => {
    const base = [
      { key: 'name', label: 'Player', format: (_: unknown, p: RankedPlayer) =>
        <span className="font-medium text-[var(--text)]">{p.name}</span> },
      { key: 'compositeScore', label: 'Score', format: (_: unknown, p: RankedPlayer) =>
        <span className="font-mono text-xs accent-text">{p.compositeScore.toFixed(3)}</span>,
        sortable: true },
      { key: 'team', label: 'Team', format: (_: unknown, p: RankedPlayer) =>
        <span className="text-[var(--text-dim)] font-mono text-xs">{p.team}</span> },
      { key: 'positions', label: 'Pos', format: (_: unknown, p: RankedPlayer) =>
        <span className="text-xs accent-text font-mono">{p.positions.join(', ')}</span> },
      { key: 'stats.IP', label: 'IP', sortable: true,
        format: (_: unknown, p: RankedPlayer) => {
          const v = p.stats.IP;
          return v !== undefined ? <span className="font-mono text-xs text-[var(--text-dim)]">{v.toFixed(1)}</span> : <span className="text-[var(--text-dim)]">—</span>;
        }
      },
    ];

    const statCols = selectedCategories.map((cat) => ({
      key: `stats.${cat}`,
      label: cat,
      format: (_: unknown, p: RankedPlayer) => {
        const v = p.stats[cat];
        if (v === undefined) return '—';
        return ['ERA', 'WHIP', 'OBP'].includes(cat)
          ? v.toFixed(3)
          : v.toFixed(['HR', 'R', 'RBI', 'SB', 'K', 'SV', 'W'].includes(cat) ? 0 : 1);
      },
    }));

    const extraCols = [
      { key: 'stats.BB', label: 'BB', format: (_: unknown, p: RankedPlayer) => p.stats.BB?.toFixed(0) ?? '—' },
      { key: 'stats.G', label: 'G', format: (_: unknown, p: RankedPlayer) => p.stats.G?.toFixed(0) ?? '—' },
      { key: 'stats.AB', label: 'AB', format: (_: unknown, p: RankedPlayer) => p.stats.AB?.toFixed(0) ?? '—' },
      { key: 'stats.AVG', label: 'AVG', format: (_: unknown, p: RankedPlayer) => p.stats.AVG?.toFixed(3) ?? '—' },
      { key: 'stats.STATUS', label: 'Status', format: (_: unknown, p: RankedPlayer) => {
        const s = String(p.stats.STATUS ?? '');
        if (!s || s === '0') return <span className="text-[var(--neon)] text-xs">Active</span>;
        return <span className="text-[var(--danger)] text-xs">{s}</span>;
      }},
      { key: 'sourcesIncluded', label: 'Src', format: (_: unknown, p: RankedPlayer) =>
        <span className="text-xs text-[var(--text-dim)]">{p.sourcesIncluded ?? 1}</span> },
    ];

    return [...base, ...statCols, ...extraCols];
  }, [selectedCategories]);

  if (players.length === 0 && pastPlayers.length === 0 && projectionPlayers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-xl font-semibold text-[var(--text)] mb-2">No Player Data Loaded</h2>
        <p className="text-[var(--text-dim)] text-sm mb-6">Upload a CSV or Excel file to start analyzing players.</p>
        <a href="/upload" className="px-6 py-2.5 rounded-xl accent-bg text-[var(--navy)] font-semibold text-sm hover:opacity-90">
          Upload Data →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl tracking-widest text-[var(--text)]">PLAYER ANALYSIS</h1>
          <p className="text-[var(--text-dim)] text-sm mt-1">{filtered.length} of {players.length} players · Baseball</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DataModeToggle
            mode={dataMode}
            onChange={setDataMode}
            pastCount={pastPlayers.length}
            projCount={projectionPlayers.length}
          />
          {confirmClear ? (
            <>
              <span className="text-xs text-[var(--text-dim)]">Clear all?</span>
              <button
                onClick={() => { clearPlayers(); setConfirmClear(false); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--danger)] text-white hover:opacity-90 transition-opacity"
              >
                Yes, clear
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors"
            >
              <span>⊘</span> Clear Data
            </button>
          )}
          <a
            href="/upload"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs accent-dim-bg accent-text border border-[var(--accent)] border-opacity-30 hover:opacity-90 transition-opacity"
          >
            <span>↑</span> Upload New
          </a>
        </div>
      </div>

      {/* Controls */}
      <GlowCard className="space-y-4" hover={false}>
        {/* Category toggles */}
        <div>
          <div className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-2">Categories (select to rank by)</div>
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
                  <span className="text-[9px] opacity-60">{BASEBALL_CATEGORY_LABELS[cat]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1">
            <input
              type="text" placeholder="Search players..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
            />
          </div>
          <select
            value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}
            className="bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="ALL">All Positions</option>
            {BASEBALL_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <PlayerTypeToggle value={playerTypeFilter} onChange={setPlayerTypeFilter} />
          <TeamRankingPanel />
        </div>
      </GlowCard>

      {/* Table */}
      <StatTable
        players={filtered}
        columns={columns}
        showRank
        maxHeight="580px"
      />
    </div>
  );
}
