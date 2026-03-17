'use client';
import React, { useState, useMemo } from 'react';
import type { RankedPlayer } from '@/types';
import RankBadge from './RankBadge';

interface Column {
  key: string;
  label: string;
  format?: (v: unknown, row: RankedPlayer) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface StatTableProps {
  players: RankedPlayer[];
  columns: Column[];
  draftedIds?: Set<string>;
  onDraft?: (player: RankedPlayer) => void;
  showRank?: boolean;
  maxHeight?: string;
  onRowClick?: (player: RankedPlayer) => void;
  rowHighlight?: (player: RankedPlayer) => 'yellow' | 'red' | undefined;
  flaggedIds?: Set<string>;
  onFlag?: (player: RankedPlayer) => void;
  avoidedIds?: Set<string>;
  onAvoid?: (player: RankedPlayer) => void;
}

export default function StatTable({
  players, columns, draftedIds, onDraft, showRank = true, maxHeight = '600px', onRowClick,
  rowHighlight, flaggedIds, onFlag, avoidedIds, onAvoid,
}: StatTableProps) {
  const [sortKey, setSortKey] = useState<string>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return players;
    return [...players].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === 'rank') { av = a.rank; bv = b.rank; }
      else if (sortKey.startsWith('stats.')) {
        const stat = sortKey.slice(6);
        av = a.stats[stat] ?? -Infinity;
        bv = b.stats[stat] ?? -Infinity;
      } else {
        av = (a as unknown as Record<string, unknown>)[sortKey] as number | string ?? 0;
        bv = (b as unknown as Record<string, unknown>)[sortKey] as number | string ?? 0;
      }
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [players, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'rank' ? 'asc' : 'desc');
    }
  };

  const sortIndicator = (key: string) => {
    if (sortKey !== key) return <span className="opacity-20 ml-1">↕</span>;
    return <span className="ml-1 accent-text">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-[var(--border)]" style={{ maxHeight }}>
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="data-table">
          <thead>
            <tr>
              {showRank && (
                <th onClick={() => handleSort('rank')} style={{ width: '60px' }}>
                  # {sortIndicator('rank')}
                </th>
              )}
              {(onFlag || onAvoid) && <th style={{ width: onFlag && onAvoid ? '52px' : '30px' }} />}
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{ width: col.width }}
                >
                  {col.label} {col.sortable !== false && sortIndicator(col.key)}
                </th>
              ))}
              {onDraft && <th style={{ width: '90px' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((player) => {
              const drafted = draftedIds?.has(player.id);
              const avoided = avoidedIds?.has(player.id);
              const highlight = rowHighlight?.(player);
              return (
                <tr
                  key={player.id}
                  className={`${drafted ? 'drafted' : ''} ${avoided ? 'opacity-40' : ''} ${highlight === 'yellow' ? 'bg-yellow-900/20' : highlight === 'red' ? 'bg-red-900/20' : ''}`}
                  onClick={() => onRowClick?.(player)}
                  style={{ cursor: onRowClick ? 'pointer' : undefined }}
                >
                  {showRank && (
                    <td>
                      <RankBadge rank={player.rank} size="sm" />
                    </td>
                  )}
                  {(onFlag || onAvoid) && (
                    <td>
                      <div className="flex items-center gap-0.5">
                        {onFlag && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onFlag(player); }}
                            className={`text-sm leading-none ${flaggedIds?.has(player.id) ? 'text-yellow-400' : 'text-[var(--text-dim)] hover:text-yellow-400'}`}
                            title={flaggedIds?.has(player.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                          >
                            {flaggedIds?.has(player.id) ? '★' : '☆'}
                          </button>
                        )}
                        {onAvoid && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onAvoid(player); }}
                            className={`text-sm leading-none font-bold ${avoidedIds?.has(player.id) ? 'text-red-400' : 'text-[var(--text-dim)] hover:text-red-400'}`}
                            title={avoidedIds?.has(player.id) ? 'Remove from avoid list' : 'Add to avoid list'}
                          >
                            {avoidedIds?.has(player.id) ? '−' : '−'}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                  {columns.map((col) => {
                    const raw = col.key.startsWith('stats.')
                      ? player.stats[col.key.slice(6)]
                      : player[col.key as keyof RankedPlayer];
                    return (
                      <td key={col.key} className="text-[var(--text)]">
                        {col.format
                          ? col.format(raw, player)
                          : (raw !== undefined && raw !== null ? String(raw) : '—')}
                      </td>
                    );
                  })}
                  {onDraft && (
                    <td>
                      <button
                        disabled={drafted}
                        onClick={(e) => { e.stopPropagation(); onDraft(player); }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          drafted
                            ? 'bg-[var(--border)] text-[var(--text-dim)] cursor-not-allowed'
                            : 'accent-bg text-[var(--navy)] hover:opacity-90'
                        }`}
                      >
                        {drafted ? 'Drafted' : 'Draft'}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length + (showRank ? 1 : 0) + (onDraft ? 1 : 0) + (onFlag || onAvoid ? 1 : 0)}
                  className="text-center text-[var(--text-dim)] py-12">
                  No players found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
