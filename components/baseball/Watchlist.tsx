'use client';
import React, { useMemo } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { computeAuctionValues } from '@/utils/auctionCalc';
import { computeRankings } from '@/utils/rankings';
import { BASEBALL_CATEGORIES } from '@/utils/constants';
import StatTable from '@/components/shared/StatTable';
import DataModeToggle from '@/components/shared/DataModeToggle';
import type { RankedPlayer } from '@/types';

export default function Watchlist() {
  const {
    players, selectedCategories, categoryWeights, leagueSettings,
    inflationScale, deflationScale,
    dataMode, setDataMode, pastPlayers, projectionPlayers,
    flaggedPlayerIds, unflagPlayer, clearFlags,
  } = useBaseballStore();

  const flaggedSet = useMemo(() => new Set(flaggedPlayerIds), [flaggedPlayerIds]);

  const allRanked = useMemo(() => {
    if (players.length === 0) return [];
    if (leagueSettings.isAuction) {
      return computeAuctionValues(players, selectedCategories, categoryWeights, leagueSettings, inflationScale, deflationScale);
    }
    return computeRankings(players, selectedCategories, categoryWeights, 'baseball');
  }, [players, selectedCategories, categoryWeights, leagueSettings, inflationScale, deflationScale]);

  const flaggedPlayers = useMemo(
    () => allRanked.filter((p) => flaggedSet.has(p.id)),
    [allRanked, flaggedSet]
  );

  const handleUnflag = (player: RankedPlayer) => {
    unflagPlayer(player.id);
  };

  const columns = useMemo(() => [
    { key: 'name', label: 'Player', format: (_: unknown, p: RankedPlayer) =>
      <span className="font-medium text-[var(--text)]">{p.name}</span> },
    { key: 'positions', label: 'Pos', format: (_: unknown, p: RankedPlayer) =>
      <span className="text-xs accent-text font-mono">{p.positions.join(', ')}</span> },
    { key: 'team', label: 'Team', format: (_: unknown, p: RankedPlayer) =>
      <span className="text-[var(--text-dim)] font-mono text-xs">{p.team}</span> },
    { key: 'compositeScore', label: 'Score', format: (_: unknown, p: RankedPlayer) =>
      <span className="font-mono text-xs accent-text">{p.compositeScore.toFixed(3)}</span> },
    ...(leagueSettings.isAuction ? [{
      key: 'auctionValue', label: 'Value ($)', format: (_: unknown, p: RankedPlayer) =>
        <span className="font-mono font-bold text-[var(--gold)]">${p.auctionValue ?? 1}</span>,
    }] : []),
    ...BASEBALL_CATEGORIES.map((cat) => ({
      key: `stats.${cat}`,
      label: cat,
      format: (_: unknown, p: RankedPlayer) => {
        const v = p.stats[cat];
        if (v === undefined) return <span className="text-[var(--text-dim)]">—</span>;
        return <span className="font-mono text-xs">{['ERA', 'WHIP', 'OBP'].includes(cat) ? v.toFixed(3) : v.toFixed(0)}</span>;
      },
    })),
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
  ], [leagueSettings.isAuction]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-5xl tracking-widest text-[var(--text)]">WATCHLIST</h1>
          <p className="text-[var(--text-dim)] text-sm mt-1">
            {flaggedPlayers.length} player{flaggedPlayers.length !== 1 ? 's' : ''} flagged
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DataModeToggle mode={dataMode} onChange={setDataMode} pastCount={pastPlayers.length} projCount={projectionPlayers.length} />
          {flaggedPlayers.length > 0 && (
            <button
              onClick={() => { if (window.confirm('Reset watchlist?')) clearFlags(); }}
              className="text-xs text-[var(--danger)] hover:underline border border-[var(--danger)] border-opacity-40 px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--danger)] hover:bg-opacity-10"
            >
              Reset Watchlist
            </button>
          )}
        </div>
      </div>

      {flaggedPlayers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">☆</div>
          <h2 className="text-xl font-semibold text-[var(--text)] mb-2">No Players Flagged</h2>
          <p className="text-[var(--text-dim)] text-sm max-w-sm">
            Use the ★ button on any player in Analysis, Auction, or Draft pages to add them to your watchlist.
          </p>
        </div>
      ) : (
        <StatTable
          players={flaggedPlayers}
          columns={columns}
          showRank
          maxHeight="700px"
          flaggedIds={flaggedSet}
          onFlag={handleUnflag}
        />
      )}
    </div>
  );
}
