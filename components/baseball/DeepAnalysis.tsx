'use client';
import { useMemo, useState } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { computeRankings, applyTeamBoost } from '@/utils/rankings';
import {
  BASEBALL_CATEGORIES, BASEBALL_CATEGORY_LABELS, BASEBALL_POSITIONS,
  BASEBALL_CATEGORY_CORRELATIONS, matchesPositionFilter, PITCHING_CATS, BATTING_CATS,
} from '@/utils/constants';
import StatTable from '@/components/shared/StatTable';
import GlowCard from '@/components/shared/GlowCard';
import DataModeToggle from '@/components/shared/DataModeToggle';
import PlayerTypeToggle from '@/components/shared/PlayerTypeToggle';
import TeamRankingPanel from '@/components/shared/TeamRankingPanel';
import type { RankedPlayer } from '@/types';
import type { BaseballCategory } from '@/types';

// ── Correlation suggestion engine ─────────────────────────────────────────────
function computeSuggestions(
  weights: Record<BaseballCategory, number>,
  baseWeights: Record<BaseballCategory, number>
): { cat: BaseballCategory; suggestion: string; reason: string; direction: 'up' | 'down' }[] {
  const suggestions: { cat: BaseballCategory; suggestion: string; reason: string; direction: 'up' | 'down'; score: number }[] = [];
  const seen = new Set<BaseballCategory>();

  for (const cat of BASEBALL_CATEGORIES) {
    const currentW = weights[cat] ?? 1;
    const baseW = baseWeights[cat] ?? 1;
    const delta = currentW - baseW; // positive = user increased, negative = user decreased

    if (Math.abs(delta) < 0.2) continue; // ignore small changes

    const corrs = BASEBALL_CATEGORY_CORRELATIONS[cat] ?? [];
    for (const { cat: corrCat, strength } of corrs) {
      if (seen.has(corrCat)) continue;

      const corrCurrentW = weights[corrCat] ?? 1;
      const corrBaseW = baseWeights[corrCat] ?? 1;
      const corrDelta = corrCurrentW - corrBaseW;

      // If user lowered cat X and corr cat hasn't been adjusted similarly, suggest lowering corr cat
      if (strength > 0 && delta < -0.2 && corrDelta > -0.15) {
        suggestions.push({
          cat: corrCat,
          suggestion: `Lower ${corrCat}`,
          reason: `${cat} and ${corrCat} tend to come from the same hitter archetype (${(strength * 100).toFixed(0)}% correlation). Devaluing ${cat} usually means you also care less about ${corrCat}.`,
          direction: 'down',
          score: Math.abs(delta) * strength,
        });
        seen.add(corrCat);
      }
      // If user raised cat X and corr cat hasn't been raised, suggest raising corr cat
      if (strength > 0 && delta > 0.2 && corrDelta < 0.15) {
        suggestions.push({
          cat: corrCat,
          suggestion: `Raise ${corrCat}`,
          reason: `${cat} and ${corrCat} frequently come from the same players (${(strength * 100).toFixed(0)}% correlation). If you want more ${cat}, you likely want more ${corrCat} too.`,
          direction: 'up',
          score: Math.abs(delta) * strength,
        });
        seen.add(corrCat);
      }
      // Negative correlation: if user raised SV, consider lowering W
      if (strength < 0 && delta > 0.2 && corrDelta > -0.1) {
        suggestions.push({
          cat: corrCat,
          suggestion: `Consider lowering ${corrCat}`,
          reason: `${cat} and ${corrCat} often trade off — closers get saves but rarely wins, starters get wins but rarely saves. Targeting ${cat} means less roster space for ${corrCat} contributors.`,
          direction: 'down',
          score: Math.abs(delta) * Math.abs(strength),
        });
        seen.add(corrCat);
      }
    }
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
}

// ── Weight slider ─────────────────────────────────────────────────────────────
function WeightSlider({ cat, label, value, base, onChange }: {
  cat: BaseballCategory; label: string; value: number; base: number; onChange: (v: number) => void;
}) {
  const delta = value - base;
  const changed = Math.abs(delta) >= 0.2;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-medium text-[var(--text)]">{cat}</span>
          <span className="text-xs text-[var(--text-dim)]">{label}</span>
          {changed && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${delta > 0 ? 'bg-[var(--neon)] bg-opacity-20 text-[var(--neon)]' : 'bg-[var(--danger)] bg-opacity-20 text-[var(--danger)]'}`}>
              {delta > 0 ? '+' : ''}{delta.toFixed(1)}
            </span>
          )}
        </div>
        <span className="text-sm font-mono accent-text">{value.toFixed(1)}x</span>
      </div>
      <input type="range" min={0} max={3} step={0.1} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: 'var(--accent)' }} />
    </div>
  );
}

const BATTER_POS_DEEP = new Set(['C', '1B', '2B', '3B', 'SS', 'OF', 'DH']);
const PITCHER_POS_DEEP = new Set(['SP', 'RP', 'P']);

// ── Main component ────────────────────────────────────────────────────────────
export default function BaseballDeepAnalysis() {
  const {
    players, positionFilter, setPositionFilter,
    dataMode, setDataMode, pastPlayers, projectionPlayers,
    categoryWeights: storedWeights,
    playerTypeFilter, setPlayerTypeFilter,
    teamRankings, teamRankWeight, teamRankEnabled,
  } = useBaseballStore();

  // Local weights for deep analysis — start from stored weights but can be adjusted independently
  const [localWeights, setLocalWeights] = useState<Record<BaseballCategory, number>>(
    () => Object.fromEntries(BASEBALL_CATEGORIES.map((c) => [c, storedWeights[c] ?? 1])) as Record<BaseballCategory, number>
  );
  const [search, setSearch] = useState('');

  const baseWeights = useMemo(
    () => Object.fromEntries(BASEBALL_CATEGORIES.map((c) => [c, 1])) as Record<BaseballCategory, number>,
    []
  );

  const setWeight = (cat: BaseballCategory, v: number) =>
    setLocalWeights((prev) => ({ ...prev, [cat]: v }));

  const resetLocalWeights = () =>
    setLocalWeights(Object.fromEntries(BASEBALL_CATEGORIES.map((c) => [c, 1])) as Record<BaseballCategory, number>);

  const typeFilteredPlayers = useMemo(() => {
    if (playerTypeFilter === 'pitchers') return players.filter(p => p.positions.some(pos => PITCHER_POS_DEEP.has(pos)));
    if (playerTypeFilter === 'batters') return players.filter(p => p.positions.some(pos => BATTER_POS_DEEP.has(pos)));
    return players;
  }, [players, playerTypeFilter]);

  const activeCatsDeep = useMemo(() => {
    if (playerTypeFilter === 'pitchers') return BASEBALL_CATEGORIES.filter(c => PITCHING_CATS.includes(c));
    if (playerTypeFilter === 'batters') return BASEBALL_CATEGORIES.filter(c => BATTING_CATS.includes(c));
    return BASEBALL_CATEGORIES;
  }, [playerTypeFilter]);

  const ranked = useMemo(() => {
    if (typeFilteredPlayers.length === 0) return [];
    const baseRanked = computeRankings(typeFilteredPlayers, activeCatsDeep, localWeights, 'baseball');
    if (!teamRankEnabled || teamRankings.length === 0 || teamRankWeight <= 1) return baseRanked;
    return applyTeamBoost(baseRanked, teamRankings, teamRankWeight);
  }, [typeFilteredPlayers, activeCatsDeep, localWeights, teamRankEnabled, teamRankings, teamRankWeight]);

  const filtered = useMemo(() => {
    let list = ranked;
    if (positionFilter !== 'ALL') {
      list = list.filter((p) => matchesPositionFilter(p.positions, positionFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
    }
    return list;
  }, [ranked, positionFilter, search]);

  const suggestions = useMemo(() => computeSuggestions(localWeights, baseWeights), [localWeights, baseWeights]);

  const columns = useMemo(() => [
    { key: 'name', label: 'Player', format: (_: unknown, p: RankedPlayer) =>
      <span className="font-medium text-[var(--text)]">{p.name}</span> },
    { key: 'compositeScore', label: 'Score', format: (_: unknown, p: RankedPlayer) =>
      <span className="font-mono text-xs accent-text">{p.compositeScore.toFixed(3)}</span>, sortable: true },
    { key: 'team', label: 'Team', format: (_: unknown, p: RankedPlayer) =>
      <span className="text-[var(--text-dim)] font-mono text-xs">{p.team}</span> },
    { key: 'positions', label: 'Pos', format: (_: unknown, p: RankedPlayer) =>
      <span className="text-xs accent-text font-mono">{p.positions.join(', ')}</span> },
    ...BASEBALL_CATEGORIES.map((cat) => ({
      key: `stats.${cat}`, label: cat,
      format: (_: unknown, p: RankedPlayer) => {
        const v = p.stats[cat];
        if (v === undefined) return '—';
        return ['ERA', 'WHIP', 'OBP'].includes(cat) ? v.toFixed(3)
          : ['HR', 'R', 'RBI', 'SB', 'K', 'SV', 'W'].includes(cat) ? v.toFixed(0)
          : v.toFixed(1);
      },
    })),
    { key: 'stats.AVG', label: 'AVG', format: (_: unknown, p: RankedPlayer) => p.stats.AVG?.toFixed(3) ?? '—' },
    { key: 'stats.BB', label: 'BB', format: (_: unknown, p: RankedPlayer) => p.stats.BB?.toFixed(0) ?? '—' },
    { key: 'stats.IP', label: 'IP', sortable: true,
      format: (_: unknown, p: RankedPlayer) => {
        const v = p.stats.IP;
        return v !== undefined ? <span className="font-mono text-xs text-[var(--text-dim)]">{v.toFixed(1)}</span> : <span className="text-[var(--text-dim)]">—</span>;
      }
    },
    { key: 'stats.AB', label: 'AB', sortable: true,
      format: (_: unknown, p: RankedPlayer) => {
        const v = p.stats.AB;
        return v !== undefined ? <span className="font-mono text-xs text-[var(--text-dim)]">{v.toFixed(0)}</span> : <span className="text-[var(--text-dim)]">—</span>;
      }
    },
  ], []);

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">🔬</div>
        <h2 className="text-xl font-semibold text-[var(--text)] mb-2">No Player Data</h2>
        <a href="/upload" className="px-6 py-2.5 rounded-xl accent-bg text-[var(--navy)] font-semibold text-sm">Upload Data →</a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl tracking-widest text-[var(--text)]">DEEP ANALYSIS</h1>
          <p className="text-[var(--text-dim)] text-sm mt-1">
            Adjust category weights — the app suggests correlated categories to consider.
          </p>
        </div>
        <DataModeToggle mode={dataMode} onChange={setDataMode} pastCount={pastPlayers.length} projCount={projectionPlayers.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: weight sliders */}
        <div className="space-y-4">
          <GlowCard className="space-y-5" hover={false}>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Category Weights</h2>
              <button onClick={resetLocalWeights} className="text-xs text-[var(--text-dim)] hover:accent-text hover:underline">Reset</button>
            </div>
            {BASEBALL_CATEGORIES.map((cat) => (
              <WeightSlider key={cat} cat={cat} label={BASEBALL_CATEGORY_LABELS[cat]}
                value={localWeights[cat] ?? 1} base={baseWeights[cat] ?? 1}
                onChange={(v) => setWeight(cat, v)} />
            ))}
          </GlowCard>

          {/* Suggestions panel */}
          {suggestions.length > 0 && (
            <GlowCard className="space-y-4" hover={false}>
              <div>
                <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">💡 Suggestions</h2>
                <p className="text-[10px] text-[var(--text-dim)] mt-1">Based on your weight changes and stat correlations.</p>
              </div>
              {suggestions.map(({ cat, suggestion, reason, direction }) => (
                <div key={cat} className={`p-3 rounded-lg border ${direction === 'up'
                  ? 'border-[var(--neon)] border-opacity-30 bg-[var(--neon)] bg-opacity-5'
                  : 'border-[var(--danger)] border-opacity-30 bg-[var(--danger)] bg-opacity-5'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-mono font-semibold ${direction === 'up' ? 'text-[var(--neon)]' : 'text-[var(--danger)]'}`}>
                      {direction === 'up' ? '↑' : '↓'} {suggestion}
                    </span>
                    <button
                      onClick={() => setWeight(cat, direction === 'up' ? Math.min(3, (localWeights[cat] ?? 1) + 0.5) : Math.max(0, (localWeights[cat] ?? 1) - 0.5))}
                      className="text-[9px] px-2 py-0.5 rounded accent-dim-bg accent-text border border-[var(--accent)] border-opacity-30 hover:opacity-90">
                      Apply
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--text-dim)] leading-relaxed">{reason}</p>
                </div>
              ))}
            </GlowCard>
          )}

          {/* Correlation map */}
          <GlowCard className="space-y-3" hover={false}>
            <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Stat Correlations</h2>
            <div className="space-y-2">
              {BASEBALL_CATEGORIES.map((cat) => {
                const corrs = BASEBALL_CATEGORY_CORRELATIONS[cat] ?? [];
                if (corrs.length === 0) return null;
                return (
                  <div key={cat} className="flex items-start gap-2">
                    <span className="text-xs font-mono text-[var(--text)] w-10 shrink-0 pt-0.5">{cat}</span>
                    <div className="flex flex-wrap gap-1">
                      {corrs.map(({ cat: c, strength }) => (
                        <span key={c} className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${strength > 0 ? 'border-[var(--neon)] border-opacity-30 text-[var(--neon)]' : 'border-[var(--danger)] border-opacity-30 text-[var(--danger)]'}`}>
                          {c} {strength > 0 ? '+' : ''}{(strength * 100).toFixed(0)}%
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlowCard>
        </div>

        {/* Right: table */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <input type="text" placeholder="Search players..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]" />
            <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}
              className="bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
              <option value="ALL">All Positions</option>
              {BASEBALL_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <PlayerTypeToggle value={playerTypeFilter} onChange={setPlayerTypeFilter} />
            <TeamRankingPanel />
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            {filtered.length} players · Rankings use local weights only — does not affect other pages.
          </p>
          <StatTable players={filtered} columns={columns} showRank maxHeight="640px" />
        </div>
      </div>
    </div>
  );
}
