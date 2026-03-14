import type { Player, RankedPlayer, Sport, BaseballCategory, BasketballCategory } from '@/types';
import {
  BASEBALL_NEGATIVE_CATS, BASEBALL_VOLUME_CATS,
  BASKETBALL_NEGATIVE_CATS, BASKETBALL_VOLUME_CATS,
} from './constants';

// ── Statistics helpers ────────────────────────────────────────────────────────
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], mu: number): number {
  if (values.length < 2) return 1;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mu, 2), 0) / values.length;
  return Math.max(Math.sqrt(variance), 0.0001); // avoid divide-by-zero
}

// ── Per-category z-scores ─────────────────────────────────────────────────────
export function computeCategoryZScores(
  players: Player[],
  category: string,
  sport: Sport
): Map<string, number> {
  const negatives = (sport === 'baseball' ? BASEBALL_NEGATIVE_CATS : BASKETBALL_NEGATIVE_CATS) as string[];
  const volumeMap = sport === 'baseball' ? BASEBALL_VOLUME_CATS : BASKETBALL_VOLUME_CATS;
  const volumeCol = volumeMap[category];

  const withStat = players.filter((p) => p.stats[category] !== undefined && !isNaN(p.stats[category]));
  if (withStat.length === 0) return new Map();

  let rawValues = withStat.map((p) => p.stats[category]);
  let skipNegation = false;

  if (volumeCol) {
    // Volume-weighted impact: rate × volume relative to league average
    // This ensures high-IP pitchers with good ERA rank above low-IP pitchers with great ERA,
    // and high-PA batters with good OBP rank above low-PA batters.
    const volumes = withStat.map((p) => p.stats[volumeCol] ?? 0);
    const totalVol = volumes.reduce((a, b) => a + b, 0);
    const weightedAvgRate = totalVol > 0
      ? rawValues.reduce((s, r, i) => s + r * volumes[i], 0) / totalVol
      : mean(rawValues);

    const isNeg = negatives.includes(category);
    rawValues = rawValues.map((r, i) => {
      const vol = volumes[i];
      // For negative cats (ERA, WHIP): (avg - rate) * vol → higher = better
      // For positive cats (OBP): (rate - avg) * vol → higher = better
      return isNeg
        ? (weightedAvgRate - r) * vol
        : (r - weightedAvgRate) * vol;
    });
    skipNegation = true; // impact is already directional
  }

  const mu = mean(rawValues);
  const sigma = stdDev(rawValues, mu);

  const scores = new Map<string, number>();
  withStat.forEach((p, i) => {
    let z = (rawValues[i] - mu) / sigma;
    if (!skipNegation && negatives.includes(category)) z = -z;
    scores.set(p.id, z);
  });

  return scores;
}

// ── Compute composite rankings ─────────────────────────────────────────────────
export function computeRankings(
  players: Player[],
  selectedCategories: string[],
  weights: Record<string, number>,
  sport: Sport
): RankedPlayer[] {
  if (players.length === 0 || selectedCategories.length === 0) {
    return players.map((p, i) => ({ ...p, zScores: {}, compositeScore: 0, rank: i + 1 }));
  }

  // Sanitize cross-position stats for already-stored data
  const BATTER_POS = new Set(['C', '1B', '2B', '3B', 'SS', 'OF', 'DH']);
  const PITCHER_POS = new Set(['SP', 'RP', 'P']);
  const BATTER_STATS_TO_STRIP = ['HR', 'R', 'RBI', 'SB', 'OBP', 'AVG', 'AB', 'PA', 'BB'];
  const PITCHER_STATS_TO_STRIP = ['ERA', 'WHIP', 'SV', 'W', 'IP', 'GS', 'K'];
  const sanitized = players.map((p) => {
    if (p.sport !== 'baseball') return p;
    const name = p.name.toLowerCase();
    if (name.includes('ohtani') || name.includes('shohei')) return p;
    const isBatter = p.positions.some((pos) => BATTER_POS.has(pos));
    const isPitcher = p.positions.some((pos) => PITCHER_POS.has(pos));
    if (isBatter && !isPitcher) {
      const stats = { ...p.stats };
      for (const s of PITCHER_STATS_TO_STRIP) delete stats[s];
      return { ...p, stats };
    }
    if (isPitcher && !isBatter) {
      const stats = { ...p.stats };
      for (const s of BATTER_STATS_TO_STRIP) delete stats[s];
      return { ...p, stats };
    }
    return p;
  });

  // Compute z-scores per category
  const categoryZMaps: Record<string, Map<string, number>> = {};
  for (const cat of selectedCategories) {
    const w = weights[cat] ?? 1;
    if (w === 0) continue;
    categoryZMaps[cat] = computeCategoryZScores(sanitized, cat, sport);
  }

  // Compute composite per player
  const scored = sanitized.map((p) => {
    const zScores: Record<string, number> = {};
    let weightedSum = 0;
    let totalWeight = 0;

    for (const cat of selectedCategories) {
      const w = weights[cat] ?? 1;
      if (w === 0) continue;
      const z = categoryZMaps[cat]?.get(p.id) ?? 0;
      zScores[cat] = z;
      weightedSum += w * z;
      totalWeight += w;
    }

    const compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    return { ...p, zScores, compositeScore };
  });

  // Sort and assign rank
  scored.sort((a, b) => b.compositeScore - a.compositeScore);
  return scored.map((p, i) => ({ ...p, rank: i + 1 }));
}

// ── Punt adjustment: recalculate weights based on team ────────────────────────
export function computePuntAdjustedWeights(
  baseWeights: Record<string, number>,
  myTeam: Player[],
  allPlayers: Player[],
  selectedCategories: string[],
  sport: Sport
): Record<string, number> {
  if (myTeam.length === 0) return baseWeights;

  const adjusted = { ...baseWeights };

  for (const cat of selectedCategories) {
    // Get z-scores for this category across all players
    const zMap = computeCategoryZScores(allPlayers, cat, sport);

    // Average z-score of my team for this category
    const teamZs = myTeam.map((p) => zMap.get(p.id) ?? 0);
    const teamAvgZ = mean(teamZs);

    if (teamAvgZ > 1.0) {
      // Already strong here — reduce weight by 50%
      adjusted[cat] = Math.max((adjusted[cat] ?? 1) * 0.5, 0);
    } else if (teamAvgZ < -0.5) {
      // Weak here — boost weight by 25%
      adjusted[cat] = (adjusted[cat] ?? 1) * 1.25;
    }
  }

  return adjusted;
}

// ── Team category projections (basketball % dilution) ─────────────────────────
export interface TeamCategoryProjection {
  category: string;
  projection: number;
  leagueAverage: number;
  winning: boolean;
}

export function computeTeamProjections(
  myTeam: Player[],
  allPlayers: Player[],
  categories: string[],
  sport: Sport
): TeamCategoryProjection[] {
  const results: TeamCategoryProjection[] = [];
  const volumeMap = sport === 'baseball' ? BASEBALL_VOLUME_CATS : BASKETBALL_VOLUME_CATS;

  for (const cat of categories) {
    const volumeCol = volumeMap[cat];

    let teamProjection: number;
    if (volumeCol && myTeam.length > 0) {
      // True combined % for the team
      const totalMakes = myTeam.reduce((s, p) => s + (p.stats[cat === 'FG%' ? 'FGM' : cat === 'FT%' ? 'FTM' : 'OBP'] ?? p.stats[cat] ?? 0) * (p.stats[volumeCol] ?? 0), 0);
      const totalAttempts = myTeam.reduce((s, p) => s + (p.stats[volumeCol] ?? 0), 0);
      teamProjection = totalAttempts > 0 ? totalMakes / totalAttempts : 0;
    } else {
      teamProjection = myTeam.length > 0
        ? mean(myTeam.map((p) => p.stats[cat] ?? 0))
        : 0;
    }

    // League average (simple mean across all players with this stat)
    const withStat = allPlayers.filter((p) => p.stats[cat] !== undefined);
    let leagueAverage: number;
    if (volumeCol && withStat.length > 0) {
      const totalMakes2 = withStat.reduce((s, p) => s + (p.stats[cat] ?? 0) * (p.stats[volumeCol] ?? 0), 0);
      const totalAttempts2 = withStat.reduce((s, p) => s + (p.stats[volumeCol] ?? 0), 0);
      leagueAverage = totalAttempts2 > 0 ? totalMakes2 / totalAttempts2 : 0;
    } else {
      leagueAverage = mean(withStat.map((p) => p.stats[cat]));
    }

    const negatives = (sport === 'baseball' ? BASEBALL_NEGATIVE_CATS : BASKETBALL_NEGATIVE_CATS) as string[];
    const winning = negatives.includes(cat)
      ? teamProjection < leagueAverage
      : teamProjection >= leagueAverage;

    results.push({ category: cat, projection: teamProjection, leagueAverage, winning });
  }

  return results;
}

// ── Apply team ranking boost to scored players ────────────────────────────────
export function applyTeamBoost(
  ranked: RankedPlayer[],
  teamRankings: string[],
  teamRankWeight: number
): RankedPlayer[] {
  if (teamRankWeight <= 1 || teamRankings.length === 0) return ranked;
  const n = teamRankings.length;
  const boosted = ranked.map((p) => {
    // Try to match player's team abbreviation against ranked teams
    const teamUpper = (p.team ?? '').toUpperCase();
    const idx = teamRankings.findIndex((t) => {
      const tu = t.toUpperCase();
      return tu === teamUpper || teamUpper.includes(tu) || tu.includes(teamUpper);
    });
    if (idx === -1) return p;
    // idx 0 = best team → max boost; idx n-1 = worst → minimal boost
    const boost = 1 + (teamRankWeight - 1) * (n - 1 - idx) / Math.max(n - 1, 1);
    return { ...p, compositeScore: p.compositeScore * boost };
  });
  // Re-sort and re-rank after boost
  boosted.sort((a, b) => b.compositeScore - a.compositeScore);
  return boosted.map((p, i) => ({ ...p, rank: i + 1 }));
}

// ── Basketball FG%/FT% impact of adding a candidate ──────────────────────────
export function computePctImpact(
  myTeam: Player[],
  candidate: Player,
  pctStat: 'FG%' | 'FT%'
): { newPct: number; delta: number } {
  const makeCol = pctStat === 'FG%' ? 'FGM' : 'FTM';
  const attCol = pctStat === 'FG%' ? 'FGA' : 'FTA';

  const currentMakes = myTeam.reduce((s, p) => s + (p.stats[makeCol] ?? (p.stats[pctStat] ?? 0) * (p.stats[attCol] ?? 0)), 0);
  const currentAtts = myTeam.reduce((s, p) => s + (p.stats[attCol] ?? 0), 0);
  const currentPct = currentAtts > 0 ? currentMakes / currentAtts : 0;

  const candMakes = candidate.stats[makeCol] ?? (candidate.stats[pctStat] ?? 0) * (candidate.stats[attCol] ?? 0);
  const candAtts = candidate.stats[attCol] ?? 0;

  const newMakes = currentMakes + candMakes;
  const newAtts = currentAtts + candAtts;
  const newPct = newAtts > 0 ? newMakes / newAtts : candidate.stats[pctStat] ?? 0;

  return { newPct, delta: newPct - currentPct };
}
