// ── Sport ────────────────────────────────────────────
export type Sport = 'baseball' | 'basketball';

// ── Baseball ─────────────────────────────────────────
export type BaseballCategory = 'ERA' | 'WHIP' | 'HR' | 'R' | 'RBI' | 'SB' | 'OBP' | 'K' | 'SV' | 'W';
export type DataMode = 'past' | 'projections' | 'both';

export interface BaseballLeagueSettings {
  numTeams: number;
  rosterSlots: {
    C: number; '1B': number; '2B': number; '2B/SS': number;
    '1B/3B': number; '3B': number; SS: number; OF: number;
    UTIL: number; BN: number; IL: number; SP: number; RP: number;
    P?: number; // used when noPitcherDesignation is true
  };
  noPitcherDesignation?: boolean; // if true, SP/RP slots are replaced by generic P slots
  isAuction: boolean;
  budget: number;
  draftRounds: number;
  setupComplete: boolean;
}

// ── Basketball ────────────────────────────────────────
export type BasketballCategory = 'FT%' | 'FG%' | '3PM' | 'REB' | 'AST' | 'STL' | 'BLK' | 'TOV' | 'PTS';

export interface BasketballLeagueSettings {
  numTeams: number;
  rosterSlots: {
    PG: number; SG: number; SF: number; PF: number; C: number;
    G: number; F: number; UTIL: number; BN: number;
  };
  draftRounds: number;
  setupComplete: boolean;
}

// ── Player ────────────────────────────────────────────
export interface Player {
  id: string;
  name: string;
  team: string;
  positions: string[];   // e.g. ['1B', 'OF'] or ['PG', 'SG']
  sport: Sport;
  stats: Record<string, number>;   // raw stat values from uploaded data
  sourcesIncluded?: number;        // how many projection files had this player
}

// ── Ranked player (after processing) ─────────────────
export interface RankedPlayer extends Player {
  zScores: Record<string, number>;         // per-category z-score
  compositeScore: number;
  rank: number;
  auctionValue?: number;
  valueAboveReplacement?: number;
}

// ── Draft pick ────────────────────────────────────────
export interface DraftPick {
  player: Player;
  price?: number;      // auction only
  pickNumber?: number; // snake only
  teamName?: string;
}

// ── Column mapping ────────────────────────────────────
export type ColumnMap = Record<string, string>; // raw header → canonical stat key

// ── Projection source ─────────────────────────────────
export interface ProjectionSource {
  filename: string;
  sport: Sport;
  rows: Record<string, unknown>[];
  headers: string[];
  uploadedAt: number;
}
