'use client';
import React, { useMemo, useState } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { computeRankings } from '@/utils/rankings';
import { BASEBALL_CATEGORY_LABELS } from '@/utils/constants';
import GlowCard from '@/components/shared/GlowCard';
import type { BaseballCategory } from '@/types';

export default function MyLeague() {
  const { savedAllTeams, allTeams, teamNames, leagueSettings, players, selectedCategories, categoryWeights } = useBaseballStore();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  // Use savedAllTeams if available, otherwise live allTeams
  const teamsToShow = Object.keys(savedAllTeams).length > 0 ? savedAllTeams : allTeams;
  const displayTeams = teamNames.length > 0 ? teamNames : Object.keys(teamsToShow);

  const ranked = useMemo(() => {
    if (players.length === 0) return [];
    return computeRankings(players, selectedCategories, categoryWeights, 'baseball');
  }, [players, selectedCategories, categoryWeights]);

  // Keep ranked in scope for future use
  void ranked;

  // Category coverage for selected team
  const teamCoverage = useMemo(() => {
    if (!selectedTeam) return [];
    const picks = teamsToShow[selectedTeam] ?? [];
    const teamPlayers = picks.map(p => p.player);
    if (teamPlayers.length === 0 || players.length === 0) return [];

    return selectedCategories.map(cat => {
      const myTotal = teamPlayers.reduce((s, p) => s + (p.stats[cat] ?? 0), 0);
      const myAvg = teamPlayers.length > 0 ? myTotal / teamPlayers.length : 0;
      const poolTotal = players.reduce((s, p) => s + (p.stats[cat] ?? 0), 0);
      const poolAvg = players.length > 0 ? poolTotal / players.length : 1;
      return { cat, myAvg, poolAvg, pct: poolAvg > 0 ? (myAvg / poolAvg) * 100 : 0 };
    });
  }, [selectedTeam, teamsToShow, players, selectedCategories]);

  if (displayTeams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div className="text-6xl">🏆</div>
        <h2 className="font-display text-3xl tracking-wider text-[var(--text)]">MY LEAGUE</h2>
        <p className="text-[var(--text-dim)] max-w-md">
          No league data yet. Use Track Draft to record picks, then save when all rosters are complete.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-wider accent-text">MY LEAGUE</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            {displayTeams.length} teams · Click a team to see category coverage
            {Object.keys(savedAllTeams).length > 0 ? ' · Showing saved draft' : ' · Showing live draft'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team list */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayTeams.map(teamName => {
            const picks = teamsToShow[teamName] ?? [];
            const totalSpent = picks.reduce((s, p) => s + (p.price ?? 0), 0);
            const isSelected = selectedTeam === teamName;
            return (
              <GlowCard
                key={teamName}
                onClick={() => setSelectedTeam(isSelected ? null : teamName)}
                className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-[var(--accent)]' : 'hover:border-[var(--accent)]/40'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display tracking-wider text-lg accent-text">{teamName}</span>
                  <div className="text-right">
                    <div className="text-xs text-[var(--text-dim)]">Spent</div>
                    <div className="text-sm font-mono font-bold text-[var(--gold)]">${totalSpent}</div>
                  </div>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {picks.length === 0 ? (
                    <p className="text-xs text-[var(--text-dim)] text-center py-2">No picks</p>
                  ) : picks.map((pick, i) => (
                    <div key={pick.player.id + i} className="flex items-center justify-between text-xs py-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[var(--accent)] font-mono shrink-0">{pick.player.positions.join('/')}</span>
                        <span className="text-[var(--text)] truncate">{pick.player.name}</span>
                      </div>
                      {pick.price !== undefined && pick.price > 0 && (
                        <span className="font-mono text-[var(--gold)] shrink-0 ml-2">${pick.price}</span>
                      )}
                    </div>
                  ))}
                </div>
              </GlowCard>
            );
          })}
        </div>

        {/* Category coverage sidebar */}
        <div className="lg:col-span-1">
          {selectedTeam ? (
            <GlowCard className="sticky top-24">
              <div className="font-display tracking-wider text-lg accent-text mb-4">{selectedTeam} — Coverage</div>
              <div className="space-y-2">
                {teamCoverage.map(({ cat, pct }) => {
                  const isNeg = ['ERA', 'WHIP'].includes(cat);
                  const score = isNeg ? (200 - pct) : pct;
                  const color = score >= 110 ? 'var(--accent)' : score >= 80 ? 'var(--gold)' : '#ef4444';
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[var(--text-dim)]">{BASEBALL_CATEGORY_LABELS[cat as BaseballCategory] ?? cat}</span>
                        <span className="font-mono" style={{ color }}>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-[var(--navy-2)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(150, pct)}%`, background: color, maxWidth: '100%' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlowCard>
          ) : (
            <GlowCard className="text-center py-8">
              <div className="text-3xl mb-2">👈</div>
              <p className="text-sm text-[var(--text-dim)]">Click a team to see their category coverage</p>
            </GlowCard>
          )}
        </div>
      </div>
    </div>
  );
}
