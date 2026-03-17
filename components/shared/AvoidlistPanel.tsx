'use client';
import React, { useMemo, useEffect } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { computeAuctionValues } from '@/utils/auctionCalc';
import { computeRankings } from '@/utils/rankings';
import { BASEBALL_CATEGORIES } from '@/utils/constants';
import type { RankedPlayer } from '@/types';

interface AvoidlistPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AvoidlistPanel({ isOpen, onClose }: AvoidlistPanelProps) {
  const {
    players, selectedCategories, categoryWeights, leagueSettings,
    inflationScale, deflationScale,
    avoidedPlayerIds, unavoidPlayer,
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

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-md bg-[var(--card)] border-l border-[var(--border)] shadow-2xl flex flex-col animate-fade-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="font-display text-2xl tracking-widest text-red-400">AVOID LIST</h2>
            <p className="text-xs text-[var(--text-dim)] mt-0.5">
              {avoidedPlayers.length} player{avoidedPlayers.length !== 1 ? 's' : ''} avoided
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/baseball/avoidlist"
              onClick={onClose}
              className="text-xs text-red-400 hover:underline border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 rounded-lg"
            >
              Full page →
            </a>
            <button
              onClick={onClose}
              className="text-[var(--text-dim)] hover:text-[var(--text)] font-mono text-lg w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--navy-2)]"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {avoidedPlayers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 space-y-3">
              <div className="text-4xl">−</div>
              <h3 className="text-lg font-semibold text-[var(--text)]">No Players Avoided</h3>
              <p className="text-sm text-[var(--text-dim)]">
                Use the − button on any player in Analysis, Auction, or Draft pages to add them here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {avoidedPlayers.map((p: RankedPlayer) => (
                <div key={p.id} className="flex items-start gap-3 px-5 py-3 hover:bg-[var(--navy-2)] transition-colors">
                  <div className="shrink-0 w-8 text-center">
                    <span className="text-xs font-mono text-[var(--text-dim)]">#{p.rank}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text)] text-sm truncate">{p.name}</span>
                      <span className="text-[10px] font-mono accent-text shrink-0">{p.positions.join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-[var(--text-dim)] flex-wrap">
                      <span className="font-mono">{p.team}</span>
                      <span className="font-mono accent-text">Score: {p.compositeScore.toFixed(3)}</span>
                      {leagueSettings.isAuction && p.auctionValue !== undefined && (
                        <span className="font-mono text-[var(--gold)]">${p.auctionValue}</span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {BASEBALL_CATEGORIES.slice(0, 5).map(cat => {
                        const v = p.stats[cat];
                        if (v === undefined) return null;
                        return (
                          <span key={cat} className="text-[10px] font-mono text-[var(--text-dim)]">
                            {cat}: <span className="text-[var(--text)]">
                              {['ERA', 'WHIP', 'OBP'].includes(cat) ? v.toFixed(3) : v.toFixed(0)}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => unavoidPlayer(p.id)}
                    className="shrink-0 text-red-400 hover:text-[var(--text-dim)] text-lg leading-none font-bold"
                    title="Remove from avoid list"
                  >
                    −
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {avoidedPlayers.length > 0 && (
          <div className="px-5 py-3 border-t border-[var(--border)]">
            <a
              href="/baseball/avoidlist"
              onClick={onClose}
              className="block w-full text-center py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 font-semibold text-sm hover:bg-red-500/30"
            >
              View Full Avoid List
            </a>
          </div>
        )}
      </div>
    </>
  );
}
