import type { Player, RankedPlayer, Sport, BasketballLeagueSettings } from '@/types';
import { computeRankings, computePuntAdjustedWeights, computeTeamProjections } from './rankings';
import { BASKETBALL_CATEGORIES, BASKETBALL_CATEGORY_LABELS } from './constants';

// ── Snake draft order ─────────────────────────────────────────────────────────
// Returns array of team indices (0-based) in snake draft order
export function buildSnakeDraftOrder(numTeams: number, numRounds: number): number[] {
  const order: number[] = [];
  for (let round = 0; round < numRounds; round++) {
    const roundOrder = Array.from({ length: numTeams }, (_, i) =>
      round % 2 === 0 ? i : numTeams - 1 - i
    );
    order.push(...roundOrder);
  }
  return order;
}

// ── NBA Next Best Available ───────────────────────────────────────────────────
export interface NBARec {
  player: RankedPlayer;
  projectedWins: number;
  delta: number; // win count delta vs current team
  categoryImpacts: { category: string; label: string; impact: 'improves' | 'hurts' | 'neutral' }[];
  fgPctDelta?: number;
  ftPctDelta?: number;
}

export function getNextBestAvailable(
  myTeam: Player[],
  availablePlayers: Player[],
  selectedCategories: string[],
  weights: Record<string, number>,
  allPlayers: Player[],
  count = 5
): NBARec[] {
  if (availablePlayers.length === 0) return [];

  // Punt-adjusted weights based on current team
  const adjustedWeights = computePuntAdjustedWeights(
    weights, myTeam, allPlayers, selectedCategories, 'basketball'
  );

  // Current team's projected wins
  const currentProjections = computeTeamProjections(myTeam, allPlayers, selectedCategories, 'basketball');
  const currentWins = currentProjections.filter((p) => p.winning).length;

  // Rank available players with adjusted weights
  const ranked = computeRankings(availablePlayers, selectedCategories, adjustedWeights, 'basketball');

  // Score each candidate
  const scored: (NBARec & { score: number })[] = ranked.slice(0, Math.min(50, ranked.length)).map((candidate) => {
    const hypothetical = [...myTeam, candidate];
    const hypotheticalProjections = computeTeamProjections(
      hypothetical, allPlayers, selectedCategories, 'basketball'
    );
    const projectedWins = hypotheticalProjections.filter((p) => p.winning).length;

    // Category-level impacts
    const categoryImpacts = selectedCategories.map((cat) => {
      const before = currentProjections.find((p) => p.category === cat);
      const after = hypotheticalProjections.find((p) => p.category === cat);
      const label = BASKETBALL_CATEGORY_LABELS[cat as keyof typeof BASKETBALL_CATEGORY_LABELS] ?? cat;

      if (!before || !after) return { category: cat, label, impact: 'neutral' as const };
      const improved = after.winning && !before.winning;
      const hurt = !after.winning && before.winning;
      return { category: cat, label, impact: improved ? 'improves' as const : hurt ? 'hurts' as const : 'neutral' as const };
    });

    // FG%/FT% delta
    let fgPctDelta: number | undefined;
    let ftPctDelta: number | undefined;
    if (selectedCategories.includes('FG%')) {
      const currentFGM = myTeam.reduce((s, p) => s + (p.stats.FGM ?? (p.stats['FG%'] ?? 0) * (p.stats.FGA ?? 0)), 0);
      const currentFGA = myTeam.reduce((s, p) => s + (p.stats.FGA ?? 0), 0);
      const currentFGPct = currentFGA > 0 ? currentFGM / currentFGA : 0;
      const candFGM = candidate.stats.FGM ?? (candidate.stats['FG%'] ?? 0) * (candidate.stats.FGA ?? 0);
      const candFGA = candidate.stats.FGA ?? 0;
      const newFGPct = (currentFGA + candFGA) > 0 ? (currentFGM + candFGM) / (currentFGA + candFGA) : currentFGPct;
      fgPctDelta = newFGPct - currentFGPct;
    }
    if (selectedCategories.includes('FT%')) {
      const currentFTM = myTeam.reduce((s, p) => s + (p.stats.FTM ?? (p.stats['FT%'] ?? 0) * (p.stats.FTA ?? 0)), 0);
      const currentFTA = myTeam.reduce((s, p) => s + (p.stats.FTA ?? 0), 0);
      const currentFTPct = currentFTA > 0 ? currentFTM / currentFTA : 0;
      const candFTM = candidate.stats.FTM ?? (candidate.stats['FT%'] ?? 0) * (candidate.stats.FTA ?? 0);
      const candFTA = candidate.stats.FTA ?? 0;
      const newFTPct = (currentFTA + candFTA) > 0 ? (currentFTM + candFTM) / (currentFTA + candFTA) : currentFTPct;
      ftPctDelta = newFTPct - currentFTPct;
    }

    const score = projectedWins * 1000 + candidate.compositeScore;

    return {
      player: candidate,
      projectedWins,
      delta: projectedWins - currentWins,
      categoryImpacts,
      fgPctDelta,
      ftPctDelta,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(({ score: _score, ...rec }) => rec);
}

// ── Baseball punt-adjusted remaining values ───────────────────────────────────
export { computePuntAdjustedWeights };
