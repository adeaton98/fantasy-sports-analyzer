'use client';
import React, { useMemo } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { computeAuctionValues } from '@/utils/auctionCalc';
import { computeRankings } from '@/utils/rankings';
import { BASEBALL_CATEGORIES } from '@/utils/constants';
import StatTable from '@/components/shared/StatTable';
import DataModeToggle from '@/components/shared/DataModeToggle';
import type { RankedPlayer } from '@/types';

export default function Avoidlist() {
  const {
    players, selectedCategories, categoryWeights, leagueSettings,
    inflationScale, deflationScale,
    dataMode, setDataMode, pastPlayers, projectionPlayers,
    avoidedPlayerIds, unavoidPlayer, clearAvoided,
  } = useBaseballStore();

  const avoidedSet = useMemo(() => new Set(avoidedPlayerIds), [avoidedPlayerIds]);

  const allRanked = useMemo(() => {
    if (players.length === 0) return [];
    if (leagueSettings.isAuction) {
      return computeAuctionValues(players, selectedCategories, categoryWeights, leagueSettings, inflationScale, deflationScale);
    }
    return computeRankings(players, selectedCategories, categoryWeights, 'baseball');
  }, [players, selectedCategories, categoryWeights, leagueSettings, inflationScale, deflationScale]);

  const avoidedPlayers = useMemo(
    () => allRanked.filter((p) => avoidedSet.has(p.id)),
    [allRanked, avoidedSet]
  );

  const handleUnavoid = (player: RankedPlayer) => {
    unavoidPlayer(player.id);
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
          <h1 className="font-display text-5xl tracking-widest text-[var(--text)]">AVOID LIST</h1>
          <p className="text-[var(--text-dim)] text-sm mt-1">
            {avoidedPlayers.length} player{avoidedPlayers.length !== 1 ? 's' : ''} avoided
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DataModeToggle mode={dataMode} onChange={setDataMode} pastCount={pastPlayers.length} projCount={projectionPlayers.length} />
          {avoidedPlayers.length > 0 && (
            <button
              onClick={() => { if (window.confirm('Clear avoid list?')) clearAvoided(); }}
              className="text-xs text-[var(--danger)] hover:underline border border-[var(--danger)] border-opacity-40 px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--danger)] hover:bg-opacity-10"
            >
              Clear Avoid List
            </button>
          )}
        </div>
      </div>

      {avoidedPlayers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">−</div>
          <h2 className="text-xl font-semibold text-[var(--text)] mb-2">No Players Avoided</h2>
          <p className="text-[var(--text-dim)] text-sm max-w-sm">
            Use the − button on any player in Analysis, Auction, or Draft pages to add them to your avoid list.
          </p>
        </div>
      ) : (
        <StatTable
          players={avoidedPlayers}
          columns={columns}
          showRank
          maxHeight="700px"
          avoidedIds={avoidedSet}
          onAvoid={handleUnavoid}
        />
      )}
    </div>
  );
}
