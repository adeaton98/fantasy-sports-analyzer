import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { Player, Sport } from '@/types';
import {
  STAT_COLUMN_ALIASES, BASEBALL_ALLOWED_COLUMNS, BASKETBALL_ALLOWED_COLUMNS,
  PITCHER_ONLY_STATS, BATTER_ONLY_STATS,
} from './constants';

// ── Sports Reference position code map ───────────────────────────────────────
// Numeric codes used in the "Pos" column of Baseball Reference exports
const SPORTSREF_POS_MAP: Record<string, string> = {
  '1': 'SP', '2': 'C', '3': '1B', '4': '2B', '5': '3B',
  '6': 'SS', '7': 'OF', '8': 'OF', '9': 'OF',
  'p': 'SP', 'c': 'C', 'd': 'DH', 'h': 'DH',
  'sp': 'SP', 'rp': 'RP', 'lf': 'OF', 'cf': 'OF', 'rf': 'OF',
  'dh': 'DH', '1b': '1B', '2b': '2B', '3b': '3B', 'ss': 'SS', 'of': 'OF',
};

const KNOWN_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'OF', 'SP', 'RP', 'P', 'DH', 'UTIL',
  'PG', 'SG', 'SF', 'PF', 'G', 'F', '2B/SS', '1B/3B', '1B/OF', '3B/SS'];

const BATTER_POSITIONS = new Set(['C', '1B', '2B', '3B', 'SS', 'OF', 'DH']);
const PITCHER_POSITIONS = new Set(['SP', 'RP', 'P']);

function addPos(positions: string[], pos: string) {
  if (!positions.includes(pos)) positions.push(pos);
}

function parsePositions(raw: string): string[] {
  // Strip leading * (all-star/active marker)
  const cleaned = raw.replace(/^\*+/, '').replace(/[+]$/, '').trim();
  if (!cleaned) return [];

  // Split on / or , or |
  const parts = cleaned.split(/[/|,]/).map((p) => p.trim()).filter(Boolean);

  const positions: string[] = [];

  for (const part of parts) {
    if (!part || part === '-') continue;
    const lower = part.toLowerCase();

    // Try the whole token first (e.g. "DH", "SS", "1B", "OF")
    const directMap = SPORTSREF_POS_MAP[lower];
    if (directMap) {
      addPos(positions, directMap);
      continue;
    }
    // Try as-is uppercase against known list (e.g. "C", "RP")
    if (KNOWN_POSITIONS.includes(part.toUpperCase())) {
      addPos(positions, part.toUpperCase());
      continue;
    }

    // Handle concatenated Sports Reference codes like "D3" (DH+1B) or "5H" (3B+DH)
    // Each character in the token is a separate single-char position code
    let consumed = false;
    for (let i = 0; i < part.length; i++) {
      // Two-char sequences like "sp", "rp", "lf", "cf", "rf", "dh", "ss", "of"
      if (i + 1 < part.length) {
        const twoChar = (part[i] + part[i + 1]).toLowerCase();
        const twoMap = SPORTSREF_POS_MAP[twoChar];
        if (twoMap) {
          addPos(positions, twoMap);
          i++; // skip next char
          consumed = true;
          continue;
        }
      }
      const ch = part[i].toLowerCase();
      const oneMap = SPORTSREF_POS_MAP[ch];
      if (oneMap) {
        addPos(positions, oneMap);
        consumed = true;
      }
    }
    // If nothing was consumed and it's short, try uppercase as-is
    if (!consumed && KNOWN_POSITIONS.includes(part.toUpperCase())) {
      addPos(positions, part.toUpperCase());
    }
  }
  return positions;
}

// ── Strip trailing decorators from player names ───────────────────────────────
// Baseball Reference appends * (HOF), # (active leader), + to player names
function cleanPlayerName(name: string): string {
  return name.replace(/[*#+@^]+$/, '').trim();
}

// ── Column detection ──────────────────────────────────────────────────────────
export function detectColumnMap(headers: string[], sport?: Sport): Record<string, string> {
  const allowed = sport === 'baseball'
    ? BASEBALL_ALLOWED_COLUMNS
    : sport === 'basketball'
    ? BASKETBALL_ALLOWED_COLUMNS
    : null; // null = allow all (when sport not yet known)

  const map: Record<string, string> = {};
  headers.forEach((rawHeader) => {
    const normalized = rawHeader.trim().toLowerCase();
    for (const [canonical, aliases] of Object.entries(STAT_COLUMN_ALIASES)) {
      // If we have an allowed list, skip columns not in it
      if (allowed && !allowed.includes(canonical)) continue;
      if (aliases.some((a) => normalized === a)) {
        if (!map[rawHeader]) map[rawHeader] = canonical;
      }
    }
  });
  return map;
}

// ── Parse file → rows + headers ───────────────────────────────────────────────
export async function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields ?? [];
          resolve({ headers, rows: results.data as Record<string, unknown>[] });
        },
        error: reject,
      });
    });
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { headers, rows };
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

// ── Normalize name for ID/matching ───────────────────────────────────────────
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Levenshtein distance ──────────────────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export function fuzzyMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  if (Math.abs(na.length - nb.length) > 4) return false;
  return levenshtein(na, nb) <= 2;
}

// ── Detect name column ────────────────────────────────────────────────────────
const NAME_COLUMN_KEYS = ['name', 'player', 'player name', 'playername', 'playerid', 'athlete'];

function findNameColumn(row: Record<string, unknown>): string | undefined {
  return Object.keys(row).find((k) => NAME_COLUMN_KEYS.includes(k.toLowerCase().trim()));
}

// ── Detect team column ────────────────────────────────────────────────────────
const TEAM_COLUMN_KEYS = ['team', 'tm', 'franchise', 'club', 'org'];

function findTeamColumn(row: Record<string, unknown>): string | undefined {
  return Object.keys(row).find((k) => TEAM_COLUMN_KEYS.includes(k.toLowerCase().trim()));
}

// ── Detect position column ────────────────────────────────────────────────────
const POS_COLUMN_KEYS = ['pos', 'position', 'positions', 'elig', 'eligibility', 'pos.'];

function findPosColumn(row: Record<string, unknown>): string | undefined {
  return Object.keys(row).find((k) => POS_COLUMN_KEYS.includes(k.toLowerCase().trim()));
}

// ── Check if player is Shohei Ohtani ─────────────────────────────────────────
function isOhtani(name: string): boolean {
  const n = normalizeName(name);
  return n.includes('ohtani') || n.includes('shohei');
}

// ── Convert raw rows → Player objects ─────────────────────────────────────────
export function normalizeRows(
  rows: Record<string, unknown>[],
  columnMap: Record<string, string>,
  sport: Sport
): Player[] {
  const players: Player[] = [];

  for (const row of rows) {
    // ── Name ──────────────────────────────────────────────────────────────────
    const nameKey = findNameColumn(row);
    const rawName = nameKey ? String(row[nameKey] ?? '').trim() : '';
    const name = cleanPlayerName(rawName);

    // Skip blank rows, header repetition rows, and totals
    // Sports Reference repeats header rows mid-file with Name="Name" or Name="Player"
    if (!name || /^total/i.test(name) || name === 'Rk' || name === 'Player' || name === 'Name') continue;
    // Skip rows where the name column contains a number (bad parse)
    if (/^\d+$/.test(name)) continue;

    // ── Team ──────────────────────────────────────────────────────────────────
    const teamKey = findTeamColumn(row);
    const team = teamKey ? String(row[teamKey] ?? '').trim() : '';

    // ── Positions ─────────────────────────────────────────────────────────────
    const posKey = findPosColumn(row);
    const posRaw = posKey ? String(row[posKey] ?? '').trim() : '';
    let positions = posRaw ? parsePositions(posRaw) : [];

    // ── Stats (only allowed columns) ──────────────────────────────────────────
    const allowed = sport === 'baseball' ? BASEBALL_ALLOWED_COLUMNS : BASKETBALL_ALLOWED_COLUMNS;
    const stats: Record<string, number> = {};
    for (const [rawCol, canonical] of Object.entries(columnMap)) {
      if (!allowed.includes(canonical)) continue;
      const val = row[rawCol];
      if (val !== undefined && val !== '') {
        const num = parseFloat(String(val).replace(/,/g, ''));
        if (!isNaN(num)) stats[canonical] = num;
      }
    }

    // ── Position inference from stats (baseball only) ─────────────────────────
    // If no position detected, infer from stat context
    if (sport === 'baseball' && positions.length === 0) {
      const hasPitcherStats = stats.ERA !== undefined || stats.WHIP !== undefined
        || stats.SV !== undefined || (stats.W !== undefined && stats.IP !== undefined);
      const hasBatterStats = stats.OBP !== undefined
        || (stats.AB !== undefined && stats.AB > 5)
        || (stats.PA !== undefined && stats.PA > 5);

      if (hasPitcherStats && !hasBatterStats) {
        positions = ['P'];
      }
      // If only batter stats, leave positions empty (will show as unpositioned)
    }

    // ── Cross-position stat filtering (baseball only, not Ohtani) ─────────────
    if (sport === 'baseball' && !isOhtani(name)) {
      const isBatter = positions.some((p) => BATTER_POSITIONS.has(p));
      const isPitcher = positions.some((p) => PITCHER_POSITIONS.has(p));

      if (isBatter && !isPitcher) {
        // Remove pitcher-only stats from batters
        for (const stat of PITCHER_ONLY_STATS) {
          delete stats[stat];
        }
      }
      if (isPitcher && !isBatter) {
        // Remove batter-only stats (AB) from pitchers
        for (const stat of BATTER_ONLY_STATS) {
          delete stats[stat];
        }
      }
    }

    const id = `${normalizeName(name)}_${team.toLowerCase()}`.replace(/\s/g, '_');
    players.push({ id, name, team, positions, sport, stats });
  }

  return players;
}

// ── Merge multiple projection sources ────────────────────────────────────────
export function mergeProjectionSources(sourcePlayers: Player[][]): Player[] {
  if (sourcePlayers.length === 0) return [];
  if (sourcePlayers.length === 1) return sourcePlayers[0].map((p) => ({ ...p, sourcesIncluded: 1 }));

  const merged: Map<string, {
    player: Player;
    statSums: Record<string, number>;
    statCounts: Record<string, number>;
    count: number;
  }> = new Map();

  for (const playerList of sourcePlayers) {
    for (const player of playerList) {
      let matchKey: string | undefined;
      for (const [key, entry] of merged.entries()) {
        if (fuzzyMatch(player.name, entry.player.name)) {
          matchKey = key;
          break;
        }
      }

      if (!matchKey) {
        merged.set(player.id, {
          player: { ...player },
          statSums: { ...player.stats },
          statCounts: Object.fromEntries(Object.keys(player.stats).map((k) => [k, 1])),
          count: 1,
        });
      } else {
        const entry = merged.get(matchKey)!;
        entry.count += 1;
        for (const [stat, val] of Object.entries(player.stats)) {
          entry.statSums[stat] = (entry.statSums[stat] ?? 0) + val;
          entry.statCounts[stat] = (entry.statCounts[stat] ?? 0) + 1;
        }
        const allPos = new Set([...entry.player.positions, ...player.positions]);
        entry.player.positions = Array.from(allPos);
        // Prefer non-empty team
        if (!entry.player.team && player.team) entry.player.team = player.team;
      }
    }
  }

  return Array.from(merged.values()).map(({ player, statSums, statCounts, count }) => {
    const avgStats: Record<string, number> = {};
    for (const [stat, sum] of Object.entries(statSums)) {
      avgStats[stat] = sum / statCounts[stat];
    }
    return { ...player, stats: avgStats, sourcesIncluded: count };
  });
}

// ── Merge past stats + projections (equal weighting, projections take precedence for meta) ──
export function mergePastAndProjections(past: Player[], projections: Player[]): Player[] {
  if (past.length === 0) return projections.map((p) => ({ ...p, sourcesIncluded: 1 }));
  if (projections.length === 0) return past.map((p) => ({ ...p, sourcesIncluded: 1 }));

  const result: Map<string, Player & { sourcesIncluded: number }> = new Map();

  // Seed with past players
  for (const p of past) {
    result.set(p.id, { ...p, sourcesIncluded: 1 });
  }

  // Merge in projections
  for (const proj of projections) {
    let matchKey: string | undefined;
    for (const [key, existing] of result.entries()) {
      if (fuzzyMatch(proj.name, existing.name)) {
        matchKey = key;
        break;
      }
    }

    if (!matchKey) {
      // Only in projections
      result.set(proj.id, { ...proj, sourcesIncluded: 1 });
    } else {
      // In both — average stats equally, projections take precedence for team/position
      const existing = result.get(matchKey)!;
      const mergedStats: Record<string, number> = {};
      const allStatKeys = new Set([...Object.keys(existing.stats), ...Object.keys(proj.stats)]);
      for (const stat of allStatKeys) {
        const pv = existing.stats[stat];
        const jv = proj.stats[stat];
        if (pv !== undefined && jv !== undefined) {
          mergedStats[stat] = (pv + jv) / 2;
        } else if (pv !== undefined) {
          mergedStats[stat] = pv;
        } else {
          mergedStats[stat] = jv!;
        }
      }
      result.set(matchKey, {
        ...existing,
        // Projections take precedence for team and position
        team: proj.team || existing.team,
        positions: proj.positions.length > 0 ? proj.positions : existing.positions,
        stats: mergedStats,
        sourcesIncluded: 2,
      });
    }
  }

  return Array.from(result.values());
}

export function getSheetNames(file: File): Promise<string[]> {
  return new Promise(async (resolve) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    resolve(workbook.SheetNames);
  });
}
