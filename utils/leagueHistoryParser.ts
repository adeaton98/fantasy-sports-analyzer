import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { normalizeName, fuzzyMatch } from './fileParser';
import { STAT_COLUMN_ALIASES } from './constants';
import type { CategoryHistoryRow, YearCategoryHistory, HistoricalDraftPick, YearDraftRecap } from '@/types';

const HISTORY_ALLOWED_CATS = ['HR', 'R', 'RBI', 'SB', 'OBP', 'ERA', 'WHIP', 'K', 'SV', 'W'];

function normalizeHeader(h: string): string | null {
  const lower = h.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(STAT_COLUMN_ALIASES)) {
    if (!HISTORY_ALLOWED_CATS.includes(canonical)) continue;
    if (aliases.some((a) => lower === a)) return canonical;
  }
  // Direct match
  if (HISTORY_ALLOWED_CATS.includes(h.trim().toUpperCase())) return h.trim().toUpperCase();
  return null;
}

// ── Detect year from sheet/tab name ───────────────────────────────────────────
export function detectYearFromSheetName(name: string): number | null {
  const match = name.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : null;
}

// ── Parse category history file ───────────────────────────────────────────────
// Accepts CSV or Excel. Teams as rows, categories as columns.
// Returns { sheetResults } for multi-sheet Excel, or single result for CSV.
export interface SheetParseResult {
  sheetName: string;
  detectedYear: number | null;
  rows: CategoryHistoryRow[];
}

export async function parseCategoryHistoryFile(file: File): Promise<SheetParseResult[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as Record<string, unknown>[];
          const parsed = parseCategoryHistoryRows(rows);
          resolve([{ sheetName: file.name, detectedYear: detectYearFromSheetName(file.name), rows: parsed }]);
        },
        error: reject,
      });
    });
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const results: SheetParseResult[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const parsed = parseCategoryHistoryRows(rows);
      if (parsed.length > 0) {
        results.push({ sheetName, detectedYear: detectYearFromSheetName(sheetName), rows: parsed });
      }
    }
    return results;
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

function parseCategoryHistoryRows(rows: Record<string, unknown>[]): CategoryHistoryRow[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);

  // First column = team name
  const teamCol = headers[0];
  // Build header → canonical map
  const colMap: Record<string, string> = {};
  for (const h of headers.slice(1)) {
    const canonical = normalizeHeader(h);
    if (canonical) colMap[h] = canonical;
  }

  return rows.map((row) => {
    const team = String(row[teamCol] ?? '').trim();
    if (!team) return null;
    const stats: Partial<Record<string, number>> = {};
    for (const [rawCol, canonical] of Object.entries(colMap)) {
      const val = parseFloat(String(row[rawCol] ?? '').replace(/,/g, ''));
      if (!isNaN(val)) stats[canonical] = val;
    }
    return { team, stats } as CategoryHistoryRow;
  }).filter((r): r is CategoryHistoryRow => r !== null && r.team.length > 0);
}

// ── Parse draft recap file ────────────────────────────────────────────────────
// Row 1 (0-indexed) = team names (every 3rd column).
// Row 2 = headers ("No.", "Player", "Offer Amount").
// Rows 3+ = data.
export interface DraftSheetParseResult {
  sheetName: string;
  detectedYear: number | null;
  picks: HistoricalDraftPick[];
}

// Header-like strings that should NOT be treated as team names
const SKIP_TEAM_WORDS = new Set([
  'no.', 'no', '#', 'player', 'offer amount', 'offer', 'amount',
  'team names', 'team name', 'team', 'name', 'rank', 'pick', 'position', 'pos',
]);

function isLikelyTeamName(s: string): boolean {
  if (!s || s.length < 2) return false;
  if (SKIP_TEAM_WORDS.has(s.toLowerCase())) return false;
  if (/^\d+$/.test(s)) return false;
  return true;
}

function cleanDraftPlayerName(raw: string): string {
  // Normalize non-breaking spaces (\u00A0) to regular spaces — Excel exports often use these
  const trimmed = raw.replace(/\u00A0/g, ' ').trim();
  if (!trimmed || /^\d+$/.test(trimmed)) return '';

  // Format: "First Last TEAM, POS" — team abbreviations are mixed-case (e.g. "Phi", "Atl", "LAD")
  // Find the last ", " which separates team from position, then strip the last word (team code)
  const commaIdx = trimmed.lastIndexOf(', ');
  if (commaIdx > 0) {
    const beforeComma = trimmed.slice(0, commaIdx);
    const lastSpaceIdx = beforeComma.lastIndexOf(' ');
    if (lastSpaceIdx > 0) {
      const potentialTeam = beforeComma.slice(lastSpaceIdx + 1);
      // Team codes are 2–5 alphanumeric chars
      if (/^[A-Za-z]{2,5}$/.test(potentialTeam)) {
        return beforeComma.slice(0, lastSpaceIdx).trim();
      }
    }
  }
  return trimmed;
}

export async function parseDraftRecapFile(file: File): Promise<DraftSheetParseResult[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls') throw new Error('Draft recap must be an Excel file (.xlsx or .xls)');

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const results: DraftSheetParseResult[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][];
    if (raw.length < 3) continue;

    // ── Auto-detect team names row ──────────────────────────────────────────
    // Scan first 4 rows for the one with 2+ likely team names
    let teamRowIdx = -1;
    let teamCols: number[] = [];
    for (let rowIdx = 0; rowIdx <= Math.min(3, raw.length - 1); rowIdx++) {
      const row = raw[rowIdx] as unknown[];
      const candidates = row
        .map((v, j) => ({ j, name: String(v ?? '').replace(/\u00A0/g, ' ').trim() }))
        .filter(({ name }) => isLikelyTeamName(name));
      if (candidates.length >= 2) {
        teamRowIdx = rowIdx;
        teamCols = candidates.map((c) => c.j);
        break;
      }
    }
    if (teamRowIdx === -1 || teamCols.length === 0) continue;

    // ── Detect player/price column offsets within each group ────────────────
    // Look at the header row (row after team row) to find "Player" and "Offer Amount"
    const headerRow = (raw[teamRowIdx + 1] ?? []) as unknown[];
    const colStep = teamCols.length > 1 ? teamCols[1] - teamCols[0] : 4;
    const baseCol = teamCols[0];
    let playerOffset = 1; // default relative to team col
    let priceOffset = 2;
    for (let offset = 0; offset < colStep; offset++) {
      const h = String(headerRow[baseCol + offset] ?? '').toLowerCase().trim();
      if (h === 'player') playerOffset = offset;
      if (h === 'offer amount' || h === 'offer') priceOffset = offset;
    }

    // ── Parse picks — data starts 2 rows after team row ─────────────────────
    const dataStartRow = teamRowIdx + 2;
    const teamNames = teamCols.map((col) => ({
      colOffset: col,
      name: String((raw[teamRowIdx] as unknown[])[col]).replace(/\u00A0/g, ' ').trim(),
    }));

    const picks: HistoricalDraftPick[] = [];
    for (let rowIdx = dataStartRow; rowIdx < raw.length; rowIdx++) {
      const dataRow = raw[rowIdx] as unknown[];
      for (const { colOffset, name: teamName } of teamNames) {
        const playerRaw = String(dataRow[colOffset + playerOffset] ?? '').trim();
        if (!playerRaw) continue;
        const cleaned = cleanDraftPlayerName(playerRaw);
        if (!cleaned || cleaned.length < 2) continue;
        const priceRaw = parseFloat(String(dataRow[colOffset + priceOffset] ?? '').replace(/[$,]/g, ''));
        const price = isNaN(priceRaw) ? 0 : priceRaw;
        picks.push({ playerName: cleaned, teamName, price });
      }
    }

    if (picks.length > 0) {
      results.push({ sheetName, detectedYear: detectYearFromSheetName(sheetName), picks });
    }
  }

  return results;
}

// ── Compute avg category stats across all years ───────────────────────────────
// Returns a single row per team with averaged stats
export function computeAvgCategoryStats(history: YearCategoryHistory[]): CategoryHistoryRow[] {
  if (history.length === 0) return [];

  // Aggregate per team
  const teamAccum: Map<string, { statSums: Record<string, number>; statCounts: Record<string, number> }> = new Map();

  for (const yearData of history) {
    for (const row of yearData.rows) {
      const key = normalizeName(row.team);
      if (!teamAccum.has(key)) {
        teamAccum.set(key, { statSums: {}, statCounts: {} });
      }
      const accum = teamAccum.get(key)!;
      for (const [cat, val] of Object.entries(row.stats)) {
        if (val === undefined) continue;
        accum.statSums[cat] = (accum.statSums[cat] ?? 0) + val;
        accum.statCounts[cat] = (accum.statCounts[cat] ?? 0) + 1;
      }
    }
  }

  // Use the most recent year's team names for display
  const latestYear = [...history].sort((a, b) => b.year - a.year)[0];
  return latestYear.rows.map((row) => {
    const key = normalizeName(row.team);
    const accum = teamAccum.get(key);
    if (!accum) return row;
    const avgStats: Partial<Record<string, number>> = {};
    for (const [cat, sum] of Object.entries(accum.statSums)) {
      avgStats[cat] = sum / accum.statCounts[cat];
    }
    return { team: row.team, stats: avgStats as CategoryHistoryRow['stats'] };
  });
}

// ── Compute league avg benchmark (single averaged row across all teams/years) ─
export function computeLeagueAvgBenchmark(history: YearCategoryHistory[]): Record<string, number> {
  if (history.length === 0) return {};
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const yearData of history) {
    for (const row of yearData.rows) {
      for (const [cat, val] of Object.entries(row.stats)) {
        if (val === undefined) continue;
        sums[cat] = (sums[cat] ?? 0) + val;
        counts[cat] = (counts[cat] ?? 0) + 1;
      }
    }
  }
  const result: Record<string, number> = {};
  for (const [cat, sum] of Object.entries(sums)) {
    result[cat] = sum / counts[cat];
  }
  return result;
}

// ── Compute avg draft prices ───────────────────────────────────────────────────
export function computeAvgDraftPrices(recaps: YearDraftRecap[]): Map<string, number> {
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const recap of recaps) {
    for (const pick of recap.picks) {
      const key = normalizeName(pick.playerName);
      sums.set(key, (sums.get(key) ?? 0) + pick.price);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const result = new Map<string, number>();
  for (const [key, sum] of sums.entries()) {
    result.set(key, Math.round(sum / counts.get(key)!));
  }
  return result;
}

// ── Build normalized-key → display name map ────────────────────────────────────
export function computeDisplayNameMap(recaps: YearDraftRecap[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const recap of recaps) {
    for (const pick of recap.picks) {
      const key = normalizeName(pick.playerName);
      if (!result.has(key)) result.set(key, pick.playerName);
    }
  }
  return result;
}

// ── Lookup hist price with fuzzy fallback ──────────────────────────────────────
export function lookupHistPrice(name: string, avgPriceMap: Map<string, number>): number | null {
  const key = normalizeName(name);
  if (avgPriceMap.has(key)) return avgPriceMap.get(key)!;
  // Fuzzy fallback
  for (const [mapKey, price] of avgPriceMap.entries()) {
    if (fuzzyMatch(key, mapKey)) return price;
  }
  return null;
}

// ── Team Analysis computations ────────────────────────────────────────────────

export interface RepeatTarget {
  playerName: string;
  appearances: { year: number; price: number }[];
}

export interface TeamSpendingProfile {
  teamName: string;
  avgTop5Spend: number; // avg cost of top-5 most expensive picks, averaged across years
  top3Pct: number; // top 3 picks as % of total (for Stars & Scrubs label)
  label: 'Stars & Scrubs' | 'Balanced' | 'Even Spread';
  mostExpensiveByYear: { year: number; playerName: string; price: number }[];
}

export interface TeamCategoryTrend {
  teamName: string;
  avgRanks: Record<string, number>; // cat → avg rank (1 = best)
  strengths: string[];   // cats with consistently high rank
  weaknesses: string[];  // cats with consistently low rank
}

export function computeRepeatTargets(recaps: YearDraftRecap[]): Map<string, RepeatTarget[]> {
  // per team → map of normalized player name → appearances
  const teamMap = new Map<string, Map<string, RepeatTarget>>();

  for (const recap of recaps) {
    for (const pick of recap.picks) {
      const teamKey = normalizeName(pick.teamName);
      if (!teamMap.has(teamKey)) teamMap.set(teamKey, new Map());
      const playerMap = teamMap.get(teamKey)!;
      const playerKey = normalizeName(pick.playerName);
      if (!playerMap.has(playerKey)) {
        playerMap.set(playerKey, { playerName: pick.playerName, appearances: [] });
      }
      playerMap.get(playerKey)!.appearances.push({ year: recap.year, price: pick.price });
    }
  }

  const result = new Map<string, RepeatTarget[]>();
  for (const [teamKey, playerMap] of teamMap.entries()) {
    // Find the display team name from any recap
    let displayName = teamKey;
    outer: for (const recap of recaps) {
      for (const pick of recap.picks) {
        if (normalizeName(pick.teamName) === teamKey) {
          displayName = pick.teamName;
          break outer;
        }
      }
    }
    const repeats = Array.from(playerMap.values())
      .filter((r) => r.appearances.length >= 2)
      .sort((a, b) => b.appearances.length - a.appearances.length);
    result.set(displayName, repeats);
  }
  return result;
}

export function computeTeamSpendingProfiles(recaps: YearDraftRecap[]): TeamSpendingProfile[] {
  if (recaps.length === 0) return [];

  // Aggregate per team per year
  const teamYearSpend = new Map<string, number[]>(); // normalized team → per-year totals
  const teamYearTop3 = new Map<string, number[]>(); // normalized team → per-year top3 spend
  const teamYearTop5 = new Map<string, number[]>(); // normalized team → per-year top5 spend
  // most expensive pick per team per year: normalized team → { year, playerName, price }
  const teamMostExpensive = new Map<string, { year: number; playerName: string; price: number }[]>();
  const teamDisplayName = new Map<string, string>();

  for (const recap of recaps) {
    // Group picks by team
    const byTeam = new Map<string, { playerName: string; price: number }[]>();
    for (const pick of recap.picks) {
      const key = normalizeName(pick.teamName);
      if (!byTeam.has(key)) byTeam.set(key, []);
      byTeam.get(key)!.push({ playerName: pick.playerName, price: pick.price });
      if (!teamDisplayName.has(key)) teamDisplayName.set(key, pick.teamName);
    }
    for (const [teamKey, picks] of byTeam.entries()) {
      const sorted = [...picks].sort((a, b) => b.price - a.price);
      const prices = sorted.map((p) => p.price);
      const total = prices.reduce((s, p) => s + p, 0);
      const top3 = prices.slice(0, 3).reduce((s, p) => s + p, 0);
      const top5 = prices.slice(0, 5).reduce((s, p) => s + p, 0);
      const topPick = sorted[0];

      if (!teamYearSpend.has(teamKey)) teamYearSpend.set(teamKey, []);
      if (!teamYearTop3.has(teamKey)) teamYearTop3.set(teamKey, []);
      if (!teamYearTop5.has(teamKey)) teamYearTop5.set(teamKey, []);
      if (!teamMostExpensive.has(teamKey)) teamMostExpensive.set(teamKey, []);

      teamYearSpend.get(teamKey)!.push(total);
      teamYearTop3.get(teamKey)!.push(top3);
      teamYearTop5.get(teamKey)!.push(top5);
      if (topPick) {
        teamMostExpensive.get(teamKey)!.push({ year: recap.year, playerName: topPick.playerName, price: topPick.price });
      }
    }
  }

  return Array.from(teamYearSpend.entries()).map(([teamKey, totals]) => {
    const avgTotal = totals.reduce((s, v) => s + v, 0) / totals.length;
    const top3Totals = teamYearTop3.get(teamKey) ?? [];
    const avgTop3 = top3Totals.reduce((s, v) => s + v, 0) / top3Totals.length;
    const top3Pct = avgTotal > 0 ? (avgTop3 / avgTotal) * 100 : 0;
    const top5Totals = teamYearTop5.get(teamKey) ?? [];
    const avgTop5 = top5Totals.reduce((s, v) => s + v, 0) / top5Totals.length;
    const label: TeamSpendingProfile['label'] =
      top3Pct >= 45 ? 'Stars & Scrubs' : top3Pct <= 30 ? 'Even Spread' : 'Balanced';
    const mostExpensiveByYear = (teamMostExpensive.get(teamKey) ?? []).sort((a, b) => b.year - a.year);
    return {
      teamName: teamDisplayName.get(teamKey) ?? teamKey,
      avgTop5Spend: Math.round(avgTop5),
      top3Pct: Math.round(top3Pct),
      label,
      mostExpensiveByYear,
    };
  }).sort((a, b) => b.avgTop5Spend - a.avgTop5Spend);
}

export function computeTeamCategoryTrends(history: YearCategoryHistory[]): TeamCategoryTrend[] {
  if (history.length === 0) return [];

  const cats = ['HR', 'R', 'RBI', 'SB', 'OBP', 'ERA', 'WHIP', 'K', 'SV', 'W'];
  const negativeCats = new Set(['ERA', 'WHIP']); // lower is better

  // Per team: accumulate ranks per cat across years
  const teamRankAccum = new Map<string, Record<string, number[]>>();
  const teamDisplayName = new Map<string, string>();

  for (const yearData of history) {
    const numTeams = yearData.rows.length;
    for (const cat of cats) {
      // Get all teams' values for this cat this year
      const values = yearData.rows
        .map((r) => ({ team: r.team, val: r.stats[cat as keyof typeof r.stats] ?? null }))
        .filter((x) => x.val !== null) as { team: string; val: number }[];

      if (values.length === 0) continue;

      // Sort: lower is better for negative cats
      const sorted = [...values].sort((a, b) =>
        negativeCats.has(cat) ? a.val - b.val : b.val - a.val
      );

      sorted.forEach(({ team }, rankIdx) => {
        const key = normalizeName(team);
        if (!teamDisplayName.has(key)) teamDisplayName.set(key, team);
        if (!teamRankAccum.has(key)) teamRankAccum.set(key, {});
        const accum = teamRankAccum.get(key)!;
        if (!accum[cat]) accum[cat] = [];
        accum[cat].push(rankIdx + 1); // 1-indexed rank
      });
    }
  }

  const numTeamsAvg = history[0]?.rows.length ?? 10;

  return Array.from(teamRankAccum.entries()).map(([teamKey, ranksByCat]) => {
    const avgRanks: Record<string, number> = {};
    for (const [cat, ranks] of Object.entries(ranksByCat)) {
      avgRanks[cat] = ranks.reduce((s, v) => s + v, 0) / ranks.length;
    }
    const strengths = cats.filter((c) => (avgRanks[c] ?? Infinity) <= 2);
    const weaknesses = cats.filter((c) => (avgRanks[c] ?? 0) >= numTeamsAvg - 1);
    return {
      teamName: teamDisplayName.get(teamKey) ?? teamKey,
      avgRanks,
      strengths,
      weaknesses,
    };
  }).sort((a, b) => a.teamName.localeCompare(b.teamName));
}
