'use client';
import { useMemo, useState } from 'react';
import { useLeagueHistoryStore } from '@/store/useLeagueHistoryStore';
import { useBaseballStore } from '@/store/useBaseballStore';
import {
  computeAvgCategoryStats,
  computeAvgDraftPrices,
  computeDisplayNameMap,
  computeRepeatTargets,
  computeTeamSpendingProfiles,
  computeTeamCategoryTrends,
} from '@/utils/leagueHistoryParser';
import { matchesPositionFilter } from '@/utils/constants';
import GlowCard from '@/components/shared/GlowCard';
import type { BaseballLeagueSettings } from '@/types';
import type { Player } from '@/types';

const CATS = ['HR', 'R', 'RBI', 'SB', 'OBP', 'ERA', 'WHIP', 'K', 'SV', 'W'];

function formatStat(cat: string, val: number): string {
  if (['OBP', 'ERA', 'WHIP'].includes(cat)) return val.toFixed(3);
  return val.toFixed(0);
}

// ── Category History table ─────────────────────────────────────────────────────
function CategoryTable({ rows }: { rows: { team: string; stats: Record<string, number | undefined> }[] }) {
  const presentCats = CATS.filter((c) => rows.some((r) => r.stats[c] !== undefined));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-2 pr-4 text-[var(--text-dim)] font-mono uppercase tracking-wider">Team</th>
            {presentCats.map((c) => (
              <th key={c} className="text-right py-2 px-2 text-[var(--text-dim)] font-mono uppercase tracking-wider">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--border)]/40 hover:bg-[var(--navy-2)]">
              <td className="py-2 pr-4 text-[var(--text)] font-medium whitespace-nowrap">{row.team}</td>
              {presentCats.map((c) => (
                <td key={c} className="py-2 px-2 text-right font-mono text-[var(--text-dim)]">
                  {row.stats[c] !== undefined ? formatStat(c, row.stats[c]!) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Per-position category averages ────────────────────────────────────────────
const BATTER_POSITIONS = ['C', '1B', '2B', '2B/SS', '1B/3B', '3B', 'SS', 'OF', 'DH'];
const BATTER_CATS = ['HR', 'R', 'RBI', 'SB', 'OBP'];
const PITCHER_CATS = ['ERA', 'WHIP', 'K', 'SV', 'W'];
const SKIP_POS = new Set(['BN', 'IL', 'UTIL']);

function PositionAveragesSection({ players, leagueSettings }: { players: Player[]; leagueSettings: BaseballLeagueSettings }) {
  const slots = leagueSettings.rosterSlots as Record<string, number>;
  const numTeams = leagueSettings.numTeams;
  const noPD = leagueSettings.noPitcherDesignation ?? false;

  const posRows = useMemo(() => {
    const pitcherPos = noPD ? ['P'] : ['SP', 'RP'];
    const allPos = [...BATTER_POSITIONS, ...pitcherPos].filter(
      (pos) => !SKIP_POS.has(pos) && (slots[pos] ?? 0) > 0
    );
    return allPos.map((pos) => {
      const slotCount = slots[pos];
      const poolSize = numTeams * slotCount;
      const isBatter = BATTER_POSITIONS.includes(pos);
      const cats = isBatter ? BATTER_CATS : PITCHER_CATS;
      const posPlayers = players
        .filter((p) => matchesPositionFilter(p.positions, pos))
        .slice(0, poolSize);
      if (posPlayers.length === 0) return null;
      const avgStats: Record<string, number | undefined> = {};
      for (const cat of cats) {
        const vals = posPlayers.map((p) => p.stats[cat]).filter((v): v is number => v !== undefined);
        if (vals.length > 0) avgStats[cat] = vals.reduce((s, v) => s + v, 0) / vals.length;
      }
      return { pos, slotCount, poolSize: posPlayers.length, avgStats, cats };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
  }, [players, slots, numTeams, noPD]);

  // Roster-sized average: top (numTeams × activeSlots) players overall, all cats averaged
  const rosterAvg = useMemo(() => {
    const ilSlots = slots.IL ?? 0;
    const totalSlots = Object.values(slots).reduce((s: number, v) => s + (v as number), 0);
    const activeSlots = Math.max(1, totalSlots - ilSlots);
    const poolSize = numTeams * activeSlots;
    const poolPlayers = players.slice(0, poolSize);
    if (poolPlayers.length === 0) return null;
    const avgStats: Record<string, number | undefined> = {};
    for (const cat of [...BATTER_CATS, ...PITCHER_CATS]) {
      const vals = poolPlayers.map((p) => p.stats[cat]).filter((v): v is number => v !== undefined);
      if (vals.length > 0) avgStats[cat] = vals.reduce((s, v) => s + v, 0) / vals.length;
    }
    return { totalSlots: activeSlots, poolSize: poolPlayers.length, avgStats };
  }, [players, slots, numTeams]);

  if (posRows.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-2 pr-3 text-[var(--text-dim)] font-mono uppercase tracking-wider">Pos</th>
            <th className="text-right py-2 px-2 text-[var(--text-dim)] font-mono uppercase tracking-wider">Slots</th>
            <th className="text-right py-2 px-2 text-[var(--text-dim)] font-mono uppercase tracking-wider">Pool</th>
            {[...BATTER_CATS, ...PITCHER_CATS].map((cat) => (
              <th key={cat} className="text-right py-2 px-2 text-[var(--text-dim)] font-mono uppercase tracking-wider">{cat}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {posRows.map(({ pos, slotCount, poolSize, avgStats, cats }) => (
            <tr key={pos} className="border-b border-[var(--border)]/40 hover:bg-[var(--navy-2)]">
              <td className="py-1.5 pr-3 font-mono font-semibold accent-text">{pos}</td>
              <td className="py-1.5 px-2 text-right font-mono text-[var(--text-dim)]">{slotCount}</td>
              <td className="py-1.5 px-2 text-right font-mono text-[var(--text-dim)]">{poolSize}</td>
              {[...BATTER_CATS, ...PITCHER_CATS].map((cat) => (
                <td key={cat} className="py-1.5 px-2 text-right font-mono text-[var(--text)]">
                  {cats.includes(cat) && avgStats[cat] !== undefined
                    ? formatStat(cat, avgStats[cat]!)
                    : <span className="text-[var(--border)]">—</span>}
                </td>
              ))}
            </tr>
          ))}
          {rosterAvg && (
            <tr className="border-t-2 border-[var(--border)] bg-[var(--navy-2)]/50">
              <td className="py-2 pr-3 font-mono font-semibold text-[var(--gold)]">All Spots</td>
              <td className="py-2 px-2 text-right font-mono text-[var(--text-dim)]">{rosterAvg.totalSlots}</td>
              <td className="py-2 px-2 text-right font-mono text-[var(--text-dim)]">{rosterAvg.poolSize}</td>
              {[...BATTER_CATS, ...PITCHER_CATS].map((cat) => (
                <td key={cat} className="py-2 px-2 text-right font-mono text-[var(--gold)]">
                  {rosterAvg.avgStats[cat] !== undefined
                    ? formatStat(cat, rosterAvg.avgStats[cat]!)
                    : <span className="text-[var(--border)]">—</span>}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Draft Recap by team ────────────────────────────────────────────────────────
function DraftByTeamSection({ picks }: { picks: { playerName: string; teamName: string; price: number }[] }) {
  const byTeam = useMemo(() => {
    const map = new Map<string, { playerName: string; price: number }[]>();
    for (const pick of picks) {
      if (!map.has(pick.teamName)) map.set(pick.teamName, []);
      map.get(pick.teamName)!.push({ playerName: pick.playerName, price: pick.price });
    }
    // Sort each team's picks by price desc
    for (const [, teamPicks] of map) teamPicks.sort((a, b) => b.price - a.price);
    // Sort teams by total spend desc
    return Array.from(map.entries())
      .map(([teamName, teamPicks]) => ({
        teamName,
        picks: teamPicks,
        total: teamPicks.reduce((s, p) => s + p.price, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [picks]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {byTeam.map(({ teamName, picks: teamPicks, total }) => (
        <div key={teamName} className="bg-[var(--navy-2)] rounded-lg border border-[var(--border)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--navy-3)]">
            <span className="text-xs font-semibold text-[var(--text)] truncate">{teamName}</span>
            <span className="text-xs font-mono text-[var(--gold)] shrink-0 ml-2">${total}</span>
          </div>
          <div className="divide-y divide-[var(--border)]/40">
            {teamPicks.map((pick, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-1.5 gap-2">
                <span className="text-xs text-[var(--text)] truncate">{pick.playerName}</span>
                <span className="text-xs font-mono text-[var(--gold)] shrink-0">${pick.price}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Team Analysis tab ─────────────────────────────────────────────────────────
function TeamAnalysisTab() {
  const { categoryHistory, draftRecaps } = useLeagueHistoryStore();
  const hasData = categoryHistory.length > 0 || draftRecaps.length > 0;

  const repeatTargets = useMemo(() => computeRepeatTargets(draftRecaps), [draftRecaps]);
  const spendingProfiles = useMemo(() => computeTeamSpendingProfiles(draftRecaps), [draftRecaps]);
  const categoryTrends = useMemo(() => computeTeamCategoryTrends(categoryHistory), [categoryHistory]);

  // Build unified team list
  const allTeams = useMemo(() => {
    const names = new Set<string>();
    spendingProfiles.forEach((p) => names.add(p.teamName));
    categoryTrends.forEach((t) => names.add(t.teamName));
    return Array.from(names).sort();
  }, [spendingProfiles, categoryTrends]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-3">📈</div>
        <p className="text-[var(--text-dim)] text-sm">Upload at least one year of league history to see team analysis.</p>
        <a href="/upload" className="mt-3 text-xs accent-text hover:underline">Upload data →</a>
      </div>
    );
  }

  const spendMap = new Map(spendingProfiles.map((p) => [p.teamName, p]));
  const trendMap = new Map(categoryTrends.map((t) => [t.teamName, t]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {allTeams.map((teamName) => {
          const spending = spendMap.get(teamName);
          const trends = trendMap.get(teamName);
          const repeats = repeatTargets.get(teamName) ?? [];

          return (
            <GlowCard key={teamName} className="space-y-4" hover={false}>
              <h3 className="font-semibold text-[var(--text)]">{teamName}</h3>

              {/* Spending profile */}
              {spending && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">Spending</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-dim)]">Avg top-5 spend</span>
                    <span className="font-mono text-sm text-[var(--gold)]">${spending.avgTop5Spend}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-dim)]">Top-3 picks %</span>
                    <span className="font-mono text-xs text-[var(--text)]">{spending.top3Pct}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                      spending.label === 'Stars & Scrubs'
                        ? 'bg-[var(--neon)]/10 text-[var(--neon)]'
                        : spending.label === 'Even Spread'
                        ? 'bg-[var(--electric)]/10 text-[var(--electric)]'
                        : 'bg-[var(--gold)]/10 text-[var(--gold)]'
                    }`}>
                      {spending.label}
                    </span>
                  </div>
                  {spending.mostExpensiveByYear.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-[var(--border)]/50">
                      <div className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Most expensive pick</div>
                      {spending.mostExpensiveByYear.map(({ year, playerName, price }) => (
                        <div key={year} className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono text-[var(--text-dim)] shrink-0">{year}</span>
                          <span className="text-[var(--text)] truncate">{playerName}</span>
                          <span className="font-mono text-[var(--gold)] shrink-0">${price}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Category strengths/weaknesses */}
              {trends && (trends.strengths.length > 0 || trends.weaknesses.length > 0) && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">Categories</div>
                  {trends.strengths.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-[var(--text-dim)] w-16 shrink-0 pt-0.5">Strength</span>
                      <div className="flex flex-wrap gap-1">
                        {trends.strengths.map((c) => (
                          <span key={c} className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-[var(--neon)]/10 text-[var(--neon)] border border-[var(--neon)]/20">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {trends.weaknesses.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-[var(--text-dim)] w-16 shrink-0 pt-0.5">Weakness</span>
                      <div className="flex flex-wrap gap-1">
                        {trends.weaknesses.map((c) => (
                          <span key={c} className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Repeat targets */}
              {repeats.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">Repeat Targets</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {repeats.slice(0, 8).map((r) => (
                      <div key={r.playerName} className="flex items-start justify-between gap-2 text-xs">
                        <span className="text-[var(--text)] truncate">{r.playerName}</span>
                        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                          {r.appearances.sort((a, b) => a.year - b.year).map((app, appIdx) => (
                            <span key={`${app.year}-${appIdx}`} className="font-mono text-[10px] text-[var(--text-dim)]">
                              {app.year}: <span className="text-[var(--gold)]">${app.price}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!spending && !trends && repeats.length === 0 && (
                <p className="text-xs text-[var(--text-dim)]">No data available for this team.</p>
              )}
            </GlowCard>
          );
        })}
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
type TabType = 'year' | 'averages' | 'team-analysis';

export default function LeagueHistoryView() {
  const { categoryHistory, draftRecaps, clearAll } = useLeagueHistoryStore();
  const { players, leagueSettings } = useBaseballStore();
  const [activeTab, setActiveTab] = useState<TabType | number>('team-analysis');

  const hasAny = categoryHistory.length > 0 || draftRecaps.length > 0;

  const allYears = useMemo(() => {
    const ys = new Set([
      ...categoryHistory.map((y) => y.year),
      ...draftRecaps.map((y) => y.year),
    ]);
    return Array.from(ys).sort((a, b) => b - a);
  }, [categoryHistory, draftRecaps]);

  const avgCategoryRows = useMemo(() => computeAvgCategoryStats(categoryHistory), [categoryHistory]);
  const avgDraftPrices = useMemo(() => computeAvgDraftPrices(draftRecaps), [draftRecaps]);
  const displayNameMap = useMemo(() => computeDisplayNameMap(draftRecaps), [draftRecaps]);
  const avgDraftList = useMemo(() => {
    return Array.from(avgDraftPrices.entries())
      .map(([key, price]) => ({ playerName: displayNameMap.get(key) ?? key, price }))
      .sort((a, b) => b.price - a.price)
      .slice(0, 60);
  }, [avgDraftPrices, displayNameMap]);

  const tabs = [
    ...allYears.map((y) => ({ id: y as TabType | number, label: String(y) })),
    { id: 'averages' as TabType, label: 'Averages' },
    { id: 'team-analysis' as TabType, label: 'Team Analysis' },
  ];

  if (!hasAny) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-5xl tracking-widest text-[var(--text)]">LEAGUE HISTORY</h1>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">⌛</div>
          <h2 className="text-xl font-semibold text-[var(--text)] mb-2">No History Uploaded</h2>
          <p className="text-[var(--text-dim)] text-sm">Upload league history on the Upload page to get started.</p>
          <a href="/upload" className="mt-4 px-6 py-2.5 rounded-xl accent-bg text-[var(--navy)] font-semibold text-sm">
            Upload Data →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-5xl tracking-widest text-[var(--text)]">LEAGUE HISTORY</h1>
          <p className="text-[var(--text-dim)] text-sm mt-1">
            {allYears.length} year{allYears.length !== 1 ? 's' : ''} of data · {draftRecaps.reduce((s, y) => s + y.picks.length, 0)} total draft picks
          </p>
        </div>
        <button
          onClick={() => { if (window.confirm('Clear all league history?')) clearAll(); }}
          className="text-xs border border-red-500/50 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 flex-wrap border-b border-[var(--border)] pb-0">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={String(tab.id)}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px ${
                active
                  ? 'accent-text border-[var(--accent)]'
                  : 'text-[var(--text-dim)] border-transparent hover:text-[var(--text)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Year tab content */}
      {typeof activeTab === 'number' && (
        <div className="space-y-6">
          {players.length > 0 && (
            <GlowCard hover={false}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[var(--text)]">Per-Position Category Averages</h2>
                <span className="text-[10px] font-mono text-[var(--text-dim)]">
                  avg per player · pool = {leagueSettings.numTeams} teams × slots
                </span>
              </div>
              <PositionAveragesSection players={players} leagueSettings={leagueSettings} />
            </GlowCard>
          )}
          {categoryHistory.find((y) => y.year === activeTab) && (
            <GlowCard hover={false}>
              <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Category Totals</h2>
              <CategoryTable rows={categoryHistory.find((y) => y.year === activeTab)!.rows.map((r) => ({ team: r.team, stats: r.stats as Record<string, number | undefined> }))} />
            </GlowCard>
          )}
          {draftRecaps.find((y) => y.year === activeTab) && (
            <GlowCard hover={false}>
              <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Draft Recap</h2>
              <DraftByTeamSection picks={draftRecaps.find((y) => y.year === activeTab)!.picks} />
            </GlowCard>
          )}
        </div>
      )}

      {/* Averages tab */}
      {activeTab === 'averages' && (
        <div className="space-y-6">
          {avgCategoryRows.length > 0 && (
            <GlowCard hover={false}>
              <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Avg Category Stats (across {categoryHistory.length} years)</h2>
              <CategoryTable rows={avgCategoryRows.map((r) => ({ team: r.team, stats: r.stats as Record<string, number | undefined> }))} />
            </GlowCard>
          )}
          {avgDraftList.length > 0 && (
            <GlowCard hover={false}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[var(--text)]">Avg Draft Prices (top 60)</h2>
                <span className="text-xs text-[var(--text-dim)] font-mono">across {draftRecaps.length} years</span>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[var(--card)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 pr-4 text-[var(--text-dim)] font-mono uppercase tracking-wider">Player</th>
                      <th className="text-right py-2 text-[var(--text-dim)] font-mono uppercase tracking-wider">Avg Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avgDraftList.map((item, i) => (
                      <tr key={i} className="border-b border-[var(--border)]/40 hover:bg-[var(--navy-2)]">
                        <td className="py-1.5 pr-4 text-[var(--text)]">{item.playerName}</td>
                        <td className="py-1.5 text-right font-mono text-[var(--gold)]">${item.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlowCard>
          )}
        </div>
      )}

      {/* Team Analysis tab */}
      {activeTab === 'team-analysis' && <TeamAnalysisTab />}
    </div>
  );
}
