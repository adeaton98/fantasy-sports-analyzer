'use client';
import { useMemo, useState } from 'react';
import { useBasketballStore } from '@/store/useBasketballStore';
import { computeRankings } from '@/utils/rankings';
import { BASKETBALL_CATEGORIES, BASKETBALL_CATEGORY_LABELS, BASKETBALL_POSITIONS, matchesPositionFilter } from '@/utils/constants';
import StatTable from '@/components/shared/StatTable';
import GlowCard from '@/components/shared/GlowCard';
import type { RankedPlayer, BasketballCategory } from '@/types';

export default function BasketballPlayerAnalysis() {
  const {
    players, clearPlayers, selectedCategories, toggleCategory,
    positionFilter, setPositionFilter, categoryWeights,
  } = useBasketballStore();

  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const ranked = useMemo(() => {
    if (players.length === 0) return [];
    return computeRankings(players, selectedCategories, categoryWeights, 'basketball');
  }, [players, selectedCategories, categoryWeights]);

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

  const columns = useMemo(() => {
    const base = [
      { key: 'name', label: 'Player', format: (_: unknown, p: RankedPlayer) =>
        <span className="font-medium text-[var(--text)]">{p.name}</span> },
      { key: 'team', label: 'Team', format: (_: unknown, p: RankedPlayer) =>
        <span className="text-[var(--text-dim)] font-mono text-xs">{p.team}</span> },
      { key: 'positions', label: 'Pos', format: (_: unknown, p: RankedPlayer) =>
        <span className="text-xs accent-text font-mono">{p.positions.join(', ')}</span> },
    ];

    const statCols = selectedCategories.map((cat) => ({
      key: `stats.${cat}`,
      label: cat,
      format: (_: unknown, p: RankedPlayer) => {
        const v = p.stats[cat];
        if (v === undefined) return '—';
        if (['FG%', 'FT%'].includes(cat)) {
          const vol = cat === 'FG%' ? p.stats.FGA : p.stats.FTA;
          const lowVol = vol !== undefined && vol < 3;
          return (
            <span className={lowVol ? 'text-[var(--warning)]' : ''}>
              {(v * 100).toFixed(1)}%{lowVol ? ' ⚠' : ''}
            </span>
          );
        }
        return v.toFixed(['PTS','REB','AST','STL','BLK','3PM','TOV'].includes(cat) ? 1 : 1);
      },
    }));

    const extra = [
      { key: 'stats.MIN', label: 'MIN', format: (_: unknown, p: RankedPlayer) => p.stats.MIN?.toFixed(1) ?? '—' },
      { key: 'stats.GP', label: 'GP', format: (_: unknown, p: RankedPlayer) => p.stats.GP?.toFixed(0) ?? '—' },
      { key: 'stats.FGA', label: 'FGA', format: (_: unknown, p: RankedPlayer) => p.stats.FGA?.toFixed(1) ?? '—' },
      { key: 'stats.FTA', label: 'FTA', format: (_: unknown, p: RankedPlayer) => p.stats.FTA?.toFixed(1) ?? '—' },
      { key: 'compositeScore', label: 'Score', format: (_: unknown, p: RankedPlayer) =>
        <span className="font-mono text-xs accent-text">{p.compositeScore.toFixed(3)}</span> },
      { key: 'sourcesIncluded', label: 'Src', format: (_: unknown, p: RankedPlayer) =>
        <span className="text-xs text-[var(--text-dim)]">{p.sourcesIncluded ?? 1}</span> },
    ];

    return [...base, ...statCols, ...extra];
  }, [selectedCategories]);

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">🏀</div>
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
          <p className="text-[var(--text-dim)] text-sm mt-1">
            {filtered.length} of {players.length} players · Basketball
            <span className="ml-2 text-[var(--warning)]">⚠ = low volume (&lt;3 att/game)</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {confirmClear ? (
            <>
              <span className="text-xs text-[var(--text-dim)]">Clear all player data?</span>
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

      <GlowCard className="space-y-4" hover={false}>
        <div>
          <div className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-2">Categories</div>
          <div className="flex flex-wrap gap-2">
            {BASKETBALL_CATEGORIES.map((cat) => {
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
                  <span className="text-[9px] opacity-60">{BASKETBALL_CATEGORY_LABELS[cat as BasketballCategory]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text" placeholder="Search players..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
          />
          <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}
            className="bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]">
            <option value="ALL">All Positions</option>
            {BASKETBALL_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </GlowCard>

      <StatTable players={filtered} columns={columns} showRank maxHeight="580px" />
    </div>
  );
}
