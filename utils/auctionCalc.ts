import type { Player, RankedPlayer } from '@/types';
import type { BaseballLeagueSettings } from '@/types';
import { computeRankings } from './rankings';
import { BATTING_CATS, PITCHING_CATS } from './constants';

// ── Batter/Pitcher skew — adjusts category weights before ranking ──────────────
// skew: -1 = full pitcher bias, 0 = neutral, +1 = full batter bias
// At ±1: favored side gets ×1.5, opposing side gets ×0.5 (3:1 ratio max)
export function applyBatterPitcherSkew(
  weights: Record<string, number>,
  skew: number
): Record<string, number> {
  if (skew === 0) return weights;
  const result = { ...weights };
  const batterMult = Math.max(0.1, 1 + skew * 0.5);
  const pitcherMult = Math.max(0.1, 1 - skew * 0.5);
  for (const cat of BATTING_CATS) {
    if (cat in result) result[cat] = (result[cat] ?? 1) * batterMult;
  }
  for (const cat of PITCHING_CATS) {
    if (cat in result) result[cat] = (result[cat] ?? 1) * pitcherMult;
  }
  return result;
}

// ── Total draftable roster spots ──────────────────────────────────────────────
export function totalRosterSpots(settings: BaseballLeagueSettings): number {
  const slots = settings.rosterSlots;
  return Object.values(slots).reduce((s: number, v: number) => s + v, 0);
}

// ── Total draft pool size (all players to be drafted across all teams) ─────────
export function totalDraftPool(settings: BaseballLeagueSettings): number {
  return settings.numTeams * totalRosterSpots(settings);
}

// ── Replacement level index ───────────────────────────────────────────────────
function replacementIndex(settings: BaseballLeagueSettings): number {
  return totalDraftPool(settings);
}

// ── Apply inflation/deflation multipliers to raw auction values ───────────────
// inflationScale (1-3): top-100 players get boosted values (overpay market)
// deflationScale (1-3): bottom players (near replacement) get devalued
function applyMarketScales(
  rawValues: number[],
  repIdx: number,
  inflationScale: number,
  deflationScale: number
): number[] {
  const INFLATION_WINDOW = Math.min(100, repIdx);
  // Deflation zone: 100 before pool boundary to 100 after it
  const DEFLATION_BEFORE = 100;
  const DEFLATION_AFTER = 100;
  const deflationStart = Math.max(0, repIdx - DEFLATION_BEFORE);
  const deflationEnd = repIdx + DEFLATION_AFTER;

  return rawValues.map((v, i) => {
    let multiplier = 1;

    // Inflation: apply to top players, linearly decreasing from rank 0 to INFLATION_WINDOW
    if (inflationScale > 1 && i < INFLATION_WINDOW) {
      const t = 1 - i / INFLATION_WINDOW; // 1 at #1, 0 at cutoff
      multiplier *= 1 + (inflationScale - 1) * t;
    }

    // Deflation: ramp up from deflationStart → repIdx (full strength), then hold through deflationEnd
    if (deflationScale > 1 && i >= deflationStart && i <= deflationEnd) {
      const t = i <= repIdx
        ? (i - deflationStart) / Math.max(1, repIdx - deflationStart) // ramp up to boundary
        : 1; // full deflation for players past pool boundary
      multiplier *= Math.max(0.1, 1 - (deflationScale - 1) * t * 0.6);
    }

    return Math.max(0, v * multiplier);
  });
}

// ── Compute auction values ────────────────────────────────────────────────────
export function computeAuctionValues(
  players: Player[],
  selectedCategories: string[],
  weights: Record<string, number>,
  settings: BaseballLeagueSettings,
  inflationScale = 1,
  deflationScale = 1
): RankedPlayer[] {
  // Sanitize cross-position stats before ranking
  const BATTER_POS = new Set(['C', '1B', '2B', '3B', 'SS', 'OF', 'DH']);
  const PITCHER_POS = new Set(['SP', 'RP', 'P']);
  const BATTER_STATS_TO_STRIP = ['HR', 'R', 'RBI', 'SB', 'OBP', 'AVG', 'AB', 'PA', 'BB'];
  const PITCHER_STATS_TO_STRIP = ['ERA', 'WHIP', 'SV', 'W', 'IP', 'GS', 'K'];
  const sanitizedPlayers = players.map((p) => {
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
  const ranked = computeRankings(sanitizedPlayers, selectedCategories, weights, 'baseball');
  const repIdx = Math.min(replacementIndex(settings), ranked.length - 1);

  if (repIdx < 0) return ranked;

  const replacementScore = ranked[repIdx]?.compositeScore ?? 0;

  // Value above replacement
  const withVAR = ranked.map((p) => ({
    ...p,
    valueAboveReplacement: Math.max(0, p.compositeScore - replacementScore),
  }));

  const totalSlots = totalRosterSpots(settings);
  // Reserve $1 per slot per team as minimum bid floor
  const totalMoney = settings.numTeams * settings.budget - settings.numTeams * totalSlots;

  const totalVAR = withVAR.reduce((s, p) => s + (p.valueAboveReplacement ?? 0), 0);
  if (totalVAR === 0) return withVAR;

  // Proportional distribution
  let rawValues = withVAR.map((p) =>
    Math.max(1, ((p.valueAboveReplacement ?? 0) / totalVAR) * totalMoney)
  );

  // Apply market scale adjustments
  if (inflationScale !== 1 || deflationScale !== 1) {
    rawValues = applyMarketScales(rawValues, repIdx, inflationScale, deflationScale);
  }

  // Normalize so they sum exactly to totalMoney
  const rawSum = rawValues.reduce((a, b) => a + b, 0);
  const scale = rawSum > 0 ? totalMoney / rawSum : 1;

  return withVAR.map((p, i) => ({
    ...p,
    auctionValue: Math.max(1, Math.round(rawValues[i] * scale)),
  }));
}

// ── Value efficiency (undervalued/overvalued) ─────────────────────────────────
export function computeValueEfficiency(
  players: RankedPlayer[]
): Map<string, 'under' | 'over' | 'fair'> {
  const result = new Map<string, 'under' | 'over' | 'fair'>();
  const eligible = players.filter((p) => (p.auctionValue ?? 1) > 1 && (p.valueAboveReplacement ?? 0) > 0);
  if (eligible.length < 4) return result;

  const efficiencies = eligible.map((p) => ({
    id: p.id,
    eff: (p.valueAboveReplacement ?? 0) / Math.max(1, (p.auctionValue ?? 1) - 1),
  })).sort((a, b) => a.eff - b.eff);

  const n = efficiencies.length;
  const q25 = efficiencies[Math.floor(n * 0.25)].eff;
  const q75 = efficiencies[Math.floor(n * 0.75)].eff;

  for (const { id, eff } of efficiencies) {
    if (eff >= q75) result.set(id, 'under');
    else if (eff <= q25) result.set(id, 'over');
    else result.set(id, 'fair');
  }
  return result;
}

// ── Value ranges (low/high bid range) ────────────────────────────────────────
export function computeValueRanges(
  players: RankedPlayer[],
  positionScarcity?: Map<string, number>
): Map<string, { low: number; high: number }> {
  const result = new Map<string, { low: number; high: number }>();
  for (const player of players) {
    const base = player.auctionValue ?? 1;
    const spread = Math.max(2, Math.min(40, base * 0.15));
    let scarcityBonus = 0;
    if (positionScarcity) {
      for (const pos of player.positions) {
        const depleted = positionScarcity.get(pos) ?? 0;
        if (depleted > 0.3) {
          scarcityBonus = Math.max(scarcityBonus, ((depleted - 0.3) / 0.7) * base * 0.4);
        }
      }
    }
    result.set(player.id, {
      low: Math.max(1, Math.round(base - spread)),
      high: Math.round(base + spread + scarcityBonus),
    });
  }
  return result;
}

// ── Recompute with punt-adjusted weights during draft ─────────────────────────
export function computePuntAdjustedValues(
  availablePlayers: Player[],
  myTeam: Player[],
  allPlayers: Player[],
  selectedCategories: string[],
  baseWeights: Record<string, number>,
  settings: BaseballLeagueSettings,
  puntCategories: string[] = [],
  inflationScale = 1,
  deflationScale = 1
): RankedPlayer[] {
  // Apply punt: zero out punted categories
  const puntedWeights = { ...baseWeights };
  for (const cat of puntCategories) {
    puntedWeights[cat] = 0;
  }

  // Active categories = those with weight > 0 and not punted
  const activeCategories = selectedCategories.filter(
    (cat) => !puntCategories.includes(cat) && (puntedWeights[cat] ?? 1) > 0
  );

  if (myTeam.length === 0) {
    return computeAuctionValues(availablePlayers, activeCategories, puntedWeights, settings, inflationScale, deflationScale);
  }

  const adjusted = { ...puntedWeights };

  // Compute team's average stat for each active category
  for (const cat of activeCategories) {
    const catVals = myTeam.map((p) => p.stats[cat] ?? 0).filter((v) => v !== 0);
    if (catVals.length === 0) continue;
    const avgVal = catVals.reduce((a, b) => a + b, 0) / catVals.length;
    const allVals = allPlayers.map((p) => p.stats[cat] ?? 0).filter((v) => v !== 0);
    const allAvg = allVals.length > 0 ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 1;

    const ratio = allAvg > 0 ? avgVal / allAvg : 1;
    if (ratio > 1.5) {
      adjusted[cat] = Math.max((adjusted[cat] ?? 1) * 0.5, 0);
    } else if (ratio < 0.6) {
      adjusted[cat] = (adjusted[cat] ?? 1) * 1.25;
    }
  }

  return computeAuctionValues(availablePlayers, activeCategories, adjusted, settings, inflationScale, deflationScale);
}
