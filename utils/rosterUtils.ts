import type { DraftPick } from '@/types';

const BATTER_POSITIONS = new Set(['C', '1B', '2B', '3B', 'SS', 'OF', 'DH']);
const PITCHER_POSITIONS = new Set(['SP', 'RP', 'P']);

export function slotEligible(positions: string[], slot: string): boolean {
  if (slot === 'BN' || slot === 'IL') return true;
  if (slot === 'UTIL') return positions.some((p) => BATTER_POSITIONS.has(p));
  if (slot === 'P') return positions.some((p) => PITCHER_POSITIONS.has(p));
  // combo slots like '2B/SS', '1B/3B'
  const parts = new Set(slot.split('/'));
  return positions.some((p) => parts.has(p) || p.split('/').some((pp) => parts.has(pp)));
}

export function fillRosterSlots(
  picks: DraftPick[],
  rosterSlots: Record<string, number>,
  positionOverrides: Record<string, string>,
  noPD: boolean
): { slot: string; pick: DraftPick | null }[] {
  const SLOT_ORDER = ['C', '1B', '2B', '2B/SS', '1B/3B', '3B', 'SS', 'OF', 'UTIL',
    ...(noPD ? ['P'] : ['SP', 'RP']), 'BN', 'IL'];

  const allSlots: { slot: string; pick: DraftPick | null }[] = SLOT_ORDER.flatMap((key) => {
    const count = rosterSlots[key] ?? 0;
    return Array.from({ length: count }, () => ({ slot: key, pick: null as DraftPick | null }));
  });

  const remaining = [...picks];
  for (const entry of allSlots) {
    const idx = remaining.findIndex((dp) => {
      const positions = positionOverrides[dp.player.id]
        ? [positionOverrides[dp.player.id]]
        : dp.player.positions;
      return slotEligible(positions, entry.slot);
    });
    if (idx >= 0) {
      entry.pick = remaining[idx];
      remaining.splice(idx, 1);
    }
  }
  // Overflow picks
  for (const dp of remaining) {
    allSlots.push({ slot: 'BN+', pick: dp });
  }
  return allSlots;
}
