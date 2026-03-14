import type { BaseballCategory, BasketballCategory, BaseballLeagueSettings, BasketballLeagueSettings } from '@/types';

export const BASEBALL_CATEGORIES: BaseballCategory[] = ['HR', 'R', 'RBI', 'SB', 'OBP', 'ERA', 'WHIP', 'K', 'SV', 'W'];
export const BASEBALL_NEGATIVE_CATS: BaseballCategory[] = ['ERA', 'WHIP'];
export const BASEBALL_VOLUME_CATS: Record<string, string> = { ERA: 'IP', WHIP: 'IP', OBP: 'PA' };

// Player type category subsets
export const PITCHING_CATS: BaseballCategory[] = ['ERA', 'WHIP', 'K', 'SV', 'W'];
export const BATTING_CATS: BaseballCategory[] = ['HR', 'R', 'RBI', 'SB', 'OBP'];

export const BASKETBALL_CATEGORIES: BasketballCategory[] = ['PTS', 'REB', 'AST', 'STL', 'BLK', '3PM', 'FG%', 'FT%', 'TOV'];
export const BASKETBALL_NEGATIVE_CATS: BasketballCategory[] = ['TOV'];
export const BASKETBALL_VOLUME_CATS: Record<string, string> = { 'FG%': 'FGA', 'FT%': 'FTA' };

export const BASEBALL_CATEGORY_LABELS: Record<BaseballCategory, string> = {
  HR: 'Home Runs', R: 'Runs Scored', RBI: 'RBIs', SB: 'Stolen Bases', OBP: 'On-Base %',
  ERA: 'ERA', WHIP: 'WHIP', K: 'Strikeouts', SV: 'Saves', W: 'Wins',
};

export const BASKETBALL_CATEGORY_LABELS: Record<BasketballCategory, string> = {
  PTS: 'Points', REB: 'Rebounds', AST: 'Assists', STL: 'Steals',
  BLK: 'Blocks', '3PM': '3-Pointers', 'FG%': 'Field Goal %', 'FT%': 'Free Throw %', TOV: 'Turnovers',
};

export const DEFAULT_BASEBALL_SETTINGS: BaseballLeagueSettings = {
  numTeams: 10,
  rosterSlots: { C: 1, '1B': 1, '2B': 1, '2B/SS': 1, '1B/3B': 1, '3B': 1, SS: 1, OF: 3, UTIL: 1, BN: 3, IL: 2, SP: 2, RP: 2, P: 0 },
  noPitcherDesignation: false,
  isAuction: true, budget: 260, draftRounds: 23, setupComplete: false,
};

// ── Position filter matching ───────────────────────────────────────────────────
// Handles combo positions like '2B/SS' — filter '2B/SS' matches players with
// '2B', 'SS', or '2B/SS' in their positions array.
export function matchesPositionFilter(playerPositions: string[], filter: string): boolean {
  const filterParts = new Set(filter.split('/'));
  return playerPositions.some((pos) => {
    if (pos === filter) return true;
    return pos.split('/').some((part) => filterParts.has(part));
  });
}

export const DEFAULT_BASKETBALL_SETTINGS: BasketballLeagueSettings = {
  numTeams: 10,
  rosterSlots: { PG: 1, SG: 1, SF: 1, PF: 1, C: 1, G: 1, F: 1, UTIL: 1, BN: 3 },
  draftRounds: 13, setupComplete: false,
};

export const BASEBALL_POSITIONS = ['C', '1B', '2B', '2B/SS', '1B/3B', '3B', 'SS', 'OF', 'SP', 'RP', 'P', 'DH'];
export const BASKETBALL_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'];

// Only these canonical keys are extracted from uploads. Everything else ignored.
export const BASEBALL_ALLOWED_COLUMNS = [
  'HR', 'R', 'RBI', 'SB', 'OBP', 'ERA', 'WHIP', 'K', 'SV', 'W',
  'AVG', 'AB', 'PA', 'BB', 'G', 'IP', 'GS', 'STATUS',
];

export const BASKETBALL_ALLOWED_COLUMNS = [
  'PTS', 'REB', 'AST', 'STL', 'BLK', '3PM', 'FG%', 'FT%', 'TOV',
  'FGA', 'FGM', 'FTA', 'FTM', 'MIN', 'GP', 'STATUS',
];

// Pitcher-only stats — removed for batters (except Ohtani)
export const PITCHER_ONLY_STATS = ['ERA', 'WHIP', 'SV', 'W', 'IP', 'GS', 'K'];
// Batter-only stats — removed for pitchers (except Ohtani)
export const BATTER_ONLY_STATS = ['HR', 'R', 'RBI', 'SB', 'OBP', 'AVG', 'AB', 'PA', 'BB'];

// ── Category correlations (for Deep Analysis suggestions) ────────────────────
// Positive strength = categories tend to come from same player archetypes
// Negative strength = tradeoff (e.g. SV-heavy closer vs W-heavy starter)
export const BASEBALL_CATEGORY_CORRELATIONS: Partial<Record<BaseballCategory, { cat: BaseballCategory; strength: number }[]>> = {
  HR:   [{ cat: 'RBI', strength: 0.85 }, { cat: 'R', strength: 0.65 }],
  RBI:  [{ cat: 'HR', strength: 0.85 }, { cat: 'R', strength: 0.55 }],
  R:    [{ cat: 'OBP', strength: 0.70 }, { cat: 'HR', strength: 0.65 }, { cat: 'SB', strength: 0.50 }, { cat: 'RBI', strength: 0.55 }],
  OBP:  [{ cat: 'R', strength: 0.70 }, { cat: 'SB', strength: 0.40 }],
  SB:   [{ cat: 'R', strength: 0.50 }, { cat: 'OBP', strength: 0.40 }],
  ERA:  [{ cat: 'WHIP', strength: 0.80 }, { cat: 'K', strength: 0.60 }],
  WHIP: [{ cat: 'ERA', strength: 0.80 }, { cat: 'K', strength: 0.50 }],
  K:    [{ cat: 'ERA', strength: 0.60 }, { cat: 'WHIP', strength: 0.50 }],
  W:    [{ cat: 'ERA', strength: 0.35 }, { cat: 'K', strength: 0.30 }],
  SV:   [{ cat: 'W', strength: -0.30 }],
};

// Exact lowercase match against raw column header from the file
export const STAT_COLUMN_ALIASES: Record<string, string[]> = {
  HR:  ['hr', 'home runs', 'home_runs', 'homeruns', 'homers'],
  R:   ['r', 'runs', 'runs scored', 'r scored', 'rs'],
  SB:  ['sb', 'stolen bases', 'stolen_bases', 'steals'],
  OBP: ['obp', 'on-base%', 'on base%', 'on base pct', 'on-base pct',
        'on base percentage', 'on-base percentage', 'on_base_pct'],
  ERA: ['era', 'earned run avg', 'earned run average', 'earned_run_avg'],
  WHIP:['whip', 'walks+hits/ip', 'walks hits per ip'],
  // Sports Reference calls pitcher strikeouts "SO" — batters' SO is NOT counted
  K:   ['k', 'so', 'strikeouts', 'strike outs', 'strikeout', 'ks', 'k%'],
  SV:  ['sv', 'saves', 'save', 'svs'],
  W:   ['w', 'wins', 'win'],
  RBI: ['rbi', 'rbis', 'runs batted in', 'runs_batted_in', 'rbi/g'],
  // "BA" is Sports Reference batting average column name
  AVG: ['avg', 'ba', 'batting avg', 'batting average', 'batting_avg', 'b/a'],
  AB:  ['ab', 'at bats', 'at-bats', 'at_bats', 'atbats'],
  PA:  ['pa', 'plate appearances', 'plate_appearances', 'plate app'],
  BB:  ['bb', 'walks', 'base on balls', 'bases on balls', 'walk', 'ubb'],
  IP:  ['ip', 'innings pitched', 'innings_pitched', 'inn', 'innings'],
  G:   ['g', 'games', 'games played', 'games_played'],
  GS:  ['gs', 'games started', 'games_started', 'starts'],
  STATUS: ['status', 'injury', 'injury status', 'inj', 'il', 'dl', 'injury_status'],
  // Basketball
  PTS: ['pts', 'points', 'ppg', 'pts/g', 'pts per game', 'points per game'],
  REB: ['reb', 'trb', 'rebounds', 'total rebounds', 'total_rebounds', 'rpg', 'reb/g'],
  AST: ['ast', 'a', 'assists', 'apg', 'ast/g', 'assists per game'],
  STL: ['stl', 'steals', 'spg', 'stl/g', 'steals per game'],
  BLK: ['blk', 'blocks', 'bpg', 'blk/g', 'blocks per game', 'bs'],
  '3PM':['3pm', '3p', 'three pointers', 'threes made', 'fg3m', '3-pt made', '3pt made', 'tp', '3ptm'],
  'FG%':['fg%', 'fgpct', 'fg pct', 'field goal %', 'field goal pct', 'field_goal_pct', 'fgp'],
  'FT%':['ft%', 'ftpct', 'ft pct', 'free throw %', 'free throw pct', 'free_throw_pct', 'ftp'],
  TOV: ['tov', 'to', 'turnovers', 'turnover', 'tpg', 'tov/g', 'turnovers per game'],
  FGA: ['fga', 'field goal attempts', 'fg attempts', 'fg att'],
  FGM: ['fgm', 'field goals made', 'fg made'],
  FTA: ['fta', 'free throw attempts', 'ft attempts', 'ft att'],
  FTM: ['ftm', 'free throws made', 'ft made'],
  MIN: ['min', 'minutes', 'mpg', 'min/g', 'minutes per game', 'mins'],
  GP:  ['gp', 'games played', 'games_played'],
};

export const MLB_TEAMS: { abbr: string; name: string }[] = [
  { abbr: 'ARI', name: 'Arizona' },
  { abbr: 'ATL', name: 'Atlanta' },
  { abbr: 'BAL', name: 'Baltimore' },
  { abbr: 'BOS', name: 'Boston' },
  { abbr: 'CHC', name: 'Chi Cubs' },
  { abbr: 'CHW', name: 'Chi Sox' },
  { abbr: 'CIN', name: 'Cincinnati' },
  { abbr: 'CLE', name: 'Cleveland' },
  { abbr: 'COL', name: 'Colorado' },
  { abbr: 'DET', name: 'Detroit' },
  { abbr: 'HOU', name: 'Houston' },
  { abbr: 'KCR', name: 'Kansas City' },
  { abbr: 'LAA', name: 'LA Angels' },
  { abbr: 'LAD', name: 'LA Dodgers' },
  { abbr: 'MIA', name: 'Miami' },
  { abbr: 'MIL', name: 'Milwaukee' },
  { abbr: 'MIN', name: 'Minnesota' },
  { abbr: 'NYM', name: 'NY Mets' },
  { abbr: 'NYY', name: 'NY Yankees' },
  { abbr: 'OAK', name: 'Oakland' },
  { abbr: 'PHI', name: 'Philadelphia' },
  { abbr: 'PIT', name: 'Pittsburgh' },
  { abbr: 'SDP', name: 'San Diego' },
  { abbr: 'SFG', name: 'San Francisco' },
  { abbr: 'SEA', name: 'Seattle' },
  { abbr: 'STL', name: 'St. Louis' },
  { abbr: 'TBR', name: 'Tampa Bay' },
  { abbr: 'TEX', name: 'Texas' },
  { abbr: 'TOR', name: 'Toronto' },
  { abbr: 'WSN', name: 'Washington' },
];
