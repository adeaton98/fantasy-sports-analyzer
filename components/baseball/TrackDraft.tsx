'use client';
import { useMemo, useState } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { computeAuctionValues, totalDraftPool, totalRosterSpots, computeValueRanges } from '@/utils/auctionCalc';
import { computeRankings, applyTeamBoost } from '@/utils/rankings';
import { BASEBALL_POSITIONS, BASEBALL_CATEGORIES, BASEBALL_CATEGORY_LABELS, matchesPositionFilter, PITCHING_CATS, BATTING_CATS } from '@/utils/constants';
import { slotEligible, fillRosterSlots } from '@/utils/rosterUtils';
import GlowCard from '@/components/shared/GlowCard';
import DataModeToggle from '@/components/shared/DataModeToggle';
import PlayerTypeToggle from '@/components/shared/PlayerTypeToggle';
import TeamRankingPanel from '@/components/shared/TeamRankingPanel';
import type { RankedPlayer, DraftPick } from '@/types';
import type { BaseballCategory } from '@/types';

const ROSTER_KEYS_BASE = ['C', '1B', '2B', '2B/SS', '1B/3B', '3B', 'SS', 'OF', 'UTIL', 'BN', 'IL'] as const;
const PITCHER_KEYS = ['SP', 'RP'] as const;

// slotEligible and fillRosterSlots are imported from @/utils/rosterUtils
// Suppress unused import linting — slotEligible is used indirectly via fillRosterSlots
void slotEligible;

// ── Setup Phase ────────────────────────────────────────────────────────────────
interface SetupPhaseProps {
  onStart: (names: string[], rosterSlots: Record<string, number>, noPD: boolean) => void;
  defaultRosterSlots: Record<string, number>;
  defaultNoPD: boolean;
}

function SetupPhase({ onStart, defaultRosterSlots, defaultNoPD }: SetupPhaseProps) {
  const [step, setStep] = useState<'count' | 'names' | 'roster'>('count');
  const [teamCount, setTeamCount] = useState<number | ''>('');
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [rosterSlots, setRosterSlots] = useState<Record<string, number>>({ ...defaultRosterSlots });
  const [noPD, setNoPD] = useState(defaultNoPD);

  const handleCountSubmit = () => {
    const n = Number(teamCount);
    if (!n || n < 2 || n > 30) return;
    setTeamNames(Array.from({ length: n }, (_, i) => `Team ${i + 1}`));
    setStep('names');
  };

  const totalSlots = Object.values(rosterSlots).reduce((a, b) => a + b, 0);
  const poolSize = Number(teamCount || 0) * totalSlots;

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <GlowCard className="w-full max-w-lg space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 justify-center">
          {(['count', 'names', 'roster'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? 'accent-bg text-[var(--navy)]' : i < ['count','names','roster'].indexOf(step) ? 'bg-[var(--accent)] bg-opacity-30 accent-text' : 'bg-[var(--border)] text-[var(--text-dim)]'}`}>
                {i + 1}
              </div>
              {i < 2 && <div className="w-8 h-px bg-[var(--border)]" />}
            </div>
          ))}
        </div>

        {step === 'count' && (
          <>
            <div className="text-center">
              <div className="text-4xl mb-3">🏟️</div>
              <h2 className="font-display text-2xl tracking-wider text-[var(--text)]">SETUP DRAFT BOARD</h2>
              <p className="text-sm text-[var(--text-dim)] mt-1">Track all teams' picks and budgets during your auction.</p>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">How many teams?</label>
              <input type="number" min={2} max={30} placeholder="e.g. 12" autoFocus
                value={teamCount}
                onChange={(e) => setTeamCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && handleCountSubmit()}
                className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-4 py-3 text-lg text-[var(--text)] text-center outline-none focus:border-[var(--accent)] font-mono" />
              <button onClick={handleCountSubmit} disabled={!teamCount || Number(teamCount) < 2}
                className="w-full py-2.5 rounded-lg accent-bg text-[var(--navy)] font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                Next: Team Names →
              </button>
            </div>
          </>
        )}

        {step === 'names' && (
          <>
            <div className="text-center">
              <h2 className="font-display text-2xl tracking-wider text-[var(--text)]">TEAM NAMES</h2>
              <p className="text-sm text-[var(--text-dim)] mt-1">Name each team or leave as defaults.</p>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {teamNames.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[var(--text-dim)] w-6 text-right">{i + 1}.</span>
                  <input type="text" value={name}
                    onChange={(e) => { const next = [...teamNames]; next[i] = e.target.value; setTeamNames(next); }}
                    onKeyDown={(e) => e.key === 'Enter' && setStep('roster')}
                    className="flex-1 bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('count')} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-dim)] hover:text-[var(--text)]">← Back</button>
              <button onClick={() => setStep('roster')} className="flex-1 py-2.5 rounded-lg accent-bg text-[var(--navy)] font-semibold hover:opacity-90">Next: Roster Slots →</button>
            </div>
          </>
        )}

        {step === 'roster' && (
          <>
            <div className="text-center">
              <h2 className="font-display text-2xl tracking-wider text-[var(--text)]">ROSTER SLOTS</h2>
              <p className="text-sm text-[var(--text-dim)] mt-1">
                Draft pool: {poolSize} players ({Number(teamCount)} teams × {totalSlots} slots)
              </p>
            </div>

            {/* NoPD checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={noPD}
                onChange={(e) => {
                  const checked = e.target.checked;
                  const sp = rosterSlots.SP ?? 0;
                  const rp = rosterSlots.RP ?? 0;
                  const p = rosterSlots.P ?? 0;
                  if (checked) {
                    setRosterSlots((s) => ({ ...s, SP: 0, RP: 0, P: sp + rp || p || 4 }));
                  } else {
                    setRosterSlots((s) => ({ ...s, P: 0, SP: Math.floor((s.P ?? 0) / 2) || 2, RP: Math.ceil((s.P ?? 0) / 2) || 2 }));
                  }
                  setNoPD(checked);
                }}
                className="w-3.5 h-3.5"
              />
              <span className="text-xs text-[var(--text-dim)]">No pitcher designation (SP/RP → P)</span>
            </label>

            <div className="grid grid-cols-4 gap-3">
              {ROSTER_KEYS_BASE.map((key) => (
                <div key={key} className="text-center">
                  <div className="text-[10px] font-mono text-[var(--text-dim)] mb-1">{key}</div>
                  <input type="number" min={0} max={20}
                    value={rosterSlots[key] ?? 0}
                    onChange={(e) => setRosterSlots((s) => ({ ...s, [key]: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-2 py-2 text-sm text-center text-[var(--text)] outline-none focus:border-[var(--accent)]" />
                </div>
              ))}
              {noPD ? (
                <div className="text-center">
                  <div className="text-[10px] font-mono text-[var(--accent)] mb-1">P</div>
                  <input type="number" min={0} max={20}
                    value={rosterSlots.P ?? 0}
                    onChange={(e) => setRosterSlots((s) => ({ ...s, P: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-[var(--navy-2)] border border-[var(--accent)] border-opacity-50 rounded-lg px-2 py-2 text-sm text-center text-[var(--text)] outline-none focus:border-[var(--accent)]" />
                </div>
              ) : (
                <>
                  {PITCHER_KEYS.map((key) => (
                    <div key={key} className="text-center">
                      <div className="text-[10px] font-mono text-[var(--text-dim)] mb-1">{key}</div>
                      <input type="number" min={0} max={20}
                        value={rosterSlots[key] ?? 0}
                        onChange={(e) => setRosterSlots((s) => ({ ...s, [key]: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-2 py-2 text-sm text-center text-[var(--text)] outline-none focus:border-[var(--accent)]" />
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep('names')} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-dim)] hover:text-[var(--text)]">← Back</button>
              <button onClick={() => onStart(teamNames.map((n) => n.trim()).filter(Boolean), rosterSlots, noPD)}
                className="flex-1 py-2.5 rounded-lg accent-bg text-[var(--navy)] font-semibold hover:opacity-90">
                Start Tracking Draft
              </button>
            </div>
          </>
        )}
      </GlowCard>
    </div>
  );
}

// ── Team Category Sidebar ──────────────────────────────────────────────────────
function TeamSidebar({ teamName, picks, allPlayers, categories, rosterSlots, noPD, positionOverrides, onClose }: {
  teamName: string;
  picks: DraftPick[];
  allPlayers: { stats: Record<string, number> }[];
  categories: string[];
  rosterSlots: Record<string, number>;
  noPD: boolean;
  positionOverrides: Record<string, string>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'roster' | 'coverage'>('roster');
  const filledSlots = useMemo(() => fillRosterSlots(picks, rosterSlots, positionOverrides, noPD), [picks, rosterSlots, positionOverrides, noPD]);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-[var(--card)] border-l border-[var(--border)] shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div>
          <h3 className="font-semibold text-[var(--text)]">{teamName}</h3>
          <p className="text-xs text-[var(--text-dim)]">{picks.length} players drafted</p>
        </div>
        <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text)] text-lg">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        {(['roster', 'coverage'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider transition-colors ${
              tab === t ? 'accent-text border-b-2 border-[var(--accent)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {tab === 'roster' && (
          picks.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)] text-center py-8">No players drafted yet.</p>
          ) : (
            filledSlots.map(({ slot, pick }, i) => (
              <div key={i} className={`flex items-center gap-3 py-2 px-3 rounded-lg ${pick ? 'bg-[var(--navy-2)]' : 'opacity-40'}`}>
                <span className={`text-[10px] font-mono font-bold w-12 shrink-0 ${
                  slot === 'BN' || slot === 'BN+' ? 'text-[var(--text-dim)]'
                  : slot === 'IL' ? 'text-[var(--danger)]'
                  : 'accent-text'
                }`}>{slot}</span>
                {pick ? (
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-[var(--text)] truncate">{(pick.player as { name?: string }).name}</div>
                    <div className="text-[10px] text-[var(--text-dim)]">
                      {pick.player.positions.join('/')}
                      {pick.price !== undefined && <span className="text-[var(--gold)] ml-2">${pick.price}</span>}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-[var(--text-dim)] italic">empty</span>
                )}
              </div>
            ))
          )
        )}

        {tab === 'coverage' && (
          picks.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)] text-center py-8">No players drafted yet.</p>
          ) : (
            categories.map((cat) => {
              const teamPlayers = picks.map((p) => p.player);
              const myVals = teamPlayers.map((p) => p.stats[cat] ?? 0).filter((v) => v > 0);
              const myAvg = myVals.length > 0 ? myVals.reduce((a, b) => a + b, 0) / myVals.length : 0;
              const allVals = allPlayers.map((p) => p.stats[cat] ?? 0).filter((v) => v > 0);
              const allAvg = allVals.length > 0 ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 1;
              const isNeg = ['ERA', 'WHIP'].includes(cat);
              const pct = isNeg
                ? (myAvg > 0 ? Math.min(200, (allAvg / myAvg) * 100) : 0)
                : (allAvg > 0 ? Math.min(200, (myAvg / allAvg) * 100) : 0);
              const winning = pct >= 100;
              return (
                <div key={cat} className="space-y-1 py-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[var(--text-dim)]">{cat}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[var(--text)]">
                        {myAvg > 0 ? (['ERA', 'WHIP', 'OBP'].includes(cat) ? myAvg.toFixed(3) : myAvg.toFixed(0)) : '—'}
                      </span>
                      <span className={`text-xs ${winning ? 'text-[var(--neon)]' : 'text-[var(--danger)]'}`}>
                        {winning ? '↑' : '↓'}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-[var(--border)] rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${winning ? 'bg-[var(--neon)]' : 'bg-[var(--danger)]'}`}
                      style={{ width: `${Math.min(100, pct / 2)}%` }} />
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}

// ── Draft Board Phase ──────────────────────────────────────────────────────────
const BATTER_POS_TRACK = new Set(['C', '1B', '2B', '3B', 'SS', 'OF', 'DH']);
const PITCHER_POS_TRACK = new Set(['SP', 'RP', 'P']);

export default function TrackDraft() {
  const {
    players, allTeams, setTeamPick, removeTeamPick,
    teamNames, setTeamNames,
    leagueSettings, updateLeagueSettings,
    selectedCategories, categoryWeights,
    teamBudgetAdjustments, setTeamBudgetAdjustment,
    playerValueOverrides, setPlayerValueOverride, clearPlayerValueOverride,
    inflationScale, deflationScale, setInflationScale, setDeflationScale,
    positionOverrides, setPositionOverride,
    dataMode, setDataMode, pastPlayers, projectionPlayers,
    flaggedPlayerIds, flagPlayer, unflagPlayer,
    savedAllTeams, saveAllTeams, resetDraft,
    playerTypeFilter, setPlayerTypeFilter,
    teamRankings, teamRankWeight, teamRankEnabled,
  } = useBaseballStore();

  const [positionFilter, setPositionFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingValueInput, setEditingValueInput] = useState('');
  const [editingBudgetTeam, setEditingBudgetTeam] = useState<string | null>(null);
  const [editingBudgetInput, setEditingBudgetInput] = useState('');
  const [editingBaseBudget, setEditingBaseBudget] = useState(false);
  const [assignTeam, setAssignTeam] = useState<string>('');
  const [assignPrice, setAssignPrice] = useState(1);
  const [assigningPlayerId, setAssigningPlayerId] = useState<string | null>(null);
  const [sidebarTeam, setSidebarTeam] = useState<string | null>(null);
  const [showMarketScales, setShowMarketScales] = useState(false);
  const [showRange, setShowRange] = useState(false);

  const noPD = leagueSettings.noPitcherDesignation ?? false;
  const flaggedSet = useMemo(() => new Set(flaggedPlayerIds), [flaggedPlayerIds]);

  const requiredPerTeam = useMemo(() => {
    const total = Object.values(leagueSettings.rosterSlots).reduce((a: number, b: number | unknown) => a + (b as number), 0);
    return total - (leagueSettings.rosterSlots.IL ?? 0);
  }, [leagueSettings.rosterSlots]);
  const isTrackComplete = teamNames.length > 0 && teamNames.every(name => (allTeams[name]?.length ?? 0) >= requiredPerTeam);
  const isTrackSaved = Object.keys(savedAllTeams).length > 0 && teamNames.every(name =>
    (savedAllTeams[name]?.length ?? 0) === (allTeams[name]?.length ?? 0)
  );

  const allDraftedIds = useMemo(() =>
    new Set(Object.values(allTeams).flatMap((picks) => picks.map((p) => p.player.id))),
    [allTeams]
  );

  const typeFilteredAvailable = useMemo(() => {
    const available = players.filter((p) => !allDraftedIds.has(p.id));
    if (playerTypeFilter === 'pitchers') return available.filter(p => p.positions.some(pos => PITCHER_POS_TRACK.has(pos)));
    if (playerTypeFilter === 'batters') return available.filter(p => p.positions.some(pos => BATTER_POS_TRACK.has(pos)));
    return available;
  }, [players, allDraftedIds, playerTypeFilter]);

  const activeCatsTrack = useMemo(() => {
    if (playerTypeFilter === 'pitchers') return selectedCategories.filter(c => PITCHING_CATS.includes(c as BaseballCategory));
    if (playerTypeFilter === 'batters') return selectedCategories.filter(c => BATTING_CATS.includes(c as BaseballCategory));
    return selectedCategories;
  }, [selectedCategories, playerTypeFilter]);

  const ranked = useMemo((): RankedPlayer[] => {
    if (players.length === 0) return [];
    if (leagueSettings.isAuction) {
      const auctionValued = computeAuctionValues(typeFilteredAvailable, activeCatsTrack, categoryWeights, leagueSettings, inflationScale, deflationScale);
      if (!teamRankEnabled || teamRankings.length === 0 || teamRankWeight <= 1) return auctionValued;
      return applyTeamBoost(auctionValued, teamRankings, teamRankWeight);
    }
    const baseRanked = computeRankings(typeFilteredAvailable, activeCatsTrack, categoryWeights, 'baseball');
    if (!teamRankEnabled || teamRankings.length === 0 || teamRankWeight <= 1) return baseRanked;
    return applyTeamBoost(baseRanked, teamRankings, teamRankWeight);
  }, [players, typeFilteredAvailable, activeCatsTrack, leagueSettings, categoryWeights, inflationScale, deflationScale, teamRankEnabled, teamRankings, teamRankWeight]);

  const rangesMap = useMemo(() => {
    if (!showRange) return new Map<string, { low: number; high: number }>();
    return computeValueRanges(ranked);
  }, [ranked, showRange]);

  const filtered = useMemo(() => {
    let list = ranked;
    if (positionFilter !== 'ALL') {
      list = list.filter((p) => matchesPositionFilter(p.positions, positionFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === 'rank') { av = a.rank; bv = b.rank; }
      else if (sortKey === 'auctionValue') { av = a.auctionValue ?? 0; bv = b.auctionValue ?? 0; }
      else if (sortKey.startsWith('stats.')) {
        const stat = sortKey.slice(6);
        av = a.stats[stat] ?? -Infinity;
        bv = b.stats[stat] ?? -Infinity;
      } else {
        av = (a as unknown as Record<string, number>)[sortKey] ?? 0;
        bv = (b as unknown as Record<string, number>)[sortKey] ?? 0;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [ranked, positionFilter, search, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'rank' ? 'asc' : 'desc'); }
  };
  const sortInd = (key: string) => sortKey !== key
    ? <span className="opacity-20 ml-0.5 text-[10px]">↕</span>
    : <span className="ml-0.5 text-[10px] accent-text">{sortDir === 'asc' ? '↑' : '↓'}</span>;

  const teamBudget = (name: string) => {
    const base = leagueSettings.budget;
    const adj = teamBudgetAdjustments[name] ?? 0;
    const spent = (allTeams[name] ?? []).reduce((s, p) => s + (p.price ?? 0), 0);
    return { total: base + adj, spent, remaining: base + adj - spent };
  };

  const handleFlag = (player: RankedPlayer) => {
    if (flaggedSet.has(player.id)) {
      unflagPlayer(player.id);
    } else {
      flagPlayer(player.id);
    }
  };

  const handleAssign = (player: RankedPlayer) => {
    if (!assignTeam) return;
    setTeamPick(assignTeam, { player, price: leagueSettings.isAuction ? assignPrice : undefined });
    setAssigningPlayerId(null);
    setAssignPrice(1);
  };

  const startAssigning = (player: RankedPlayer) => {
    setAssigningPlayerId(player.id);
    setAssignTeam(teamNames[0] ?? '');
    setAssignPrice(playerValueOverrides[player.id] ?? player.auctionValue ?? 1);
  };

  const handleStartDraft = (names: string[], rosterSlots: Record<string, number>, noPD: boolean) => {
    setTeamNames(names);
    updateLeagueSettings({
      numTeams: names.length,
      noPitcherDesignation: noPD,
      rosterSlots: rosterSlots as typeof leagueSettings.rosterSlots,
    });
  };

  if (teamNames.length === 0) {
    return (
      <SetupPhase
        onStart={handleStartDraft}
        defaultRosterSlots={leagueSettings.rosterSlots as Record<string, number>}
        defaultNoPD={noPD}
      />
    );
  }

  const poolSize = totalDraftPool(leagueSettings);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)] mb-0.5">Track Draft Mode</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-[var(--text-dim)]">
              {teamNames.length} teams · pool {poolSize} ({teamNames.length} × {totalRosterSpots(leagueSettings)}) · {allDraftedIds.size} drafted · {players.length - allDraftedIds.size} available
            </p>
            {leagueSettings.isAuction && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-xs text-[var(--text-dim)]">Base budget:</span>
                {editingBaseBudget ? (
                  <input type="number" min={50} max={10000} autoFocus defaultValue={leagueSettings.budget}
                    onBlur={(e) => { updateLeagueSettings({ budget: parseInt(e.target.value) || leagueSettings.budget }); setEditingBaseBudget(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingBaseBudget(false); }}
                    className="w-20 bg-[var(--navy-2)] border border-[var(--accent)] rounded px-2 py-0.5 text-sm text-[var(--gold)] outline-none font-mono" />
                ) : (
                  <button onClick={() => setEditingBaseBudget(true)} className="font-mono text-[var(--gold)] hover:underline cursor-text">
                    ${leagueSettings.budget}<span className="text-[9px] text-[var(--text-dim)] ml-0.5">✎</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DataModeToggle mode={dataMode} onChange={setDataMode} pastCount={pastPlayers.length} projCount={projectionPlayers.length} />
          {leagueSettings.isAuction && (
            <>
              <button onClick={() => setShowRange((v) => !v)}
                className={`text-xs border px-3 py-1.5 rounded-lg transition-colors ${showRange ? 'accent-bg text-[var(--navy)] border-transparent' : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]'}`}>
                Show Range
              </button>
              <button onClick={() => setShowMarketScales(!showMarketScales)}
                className={`text-xs border px-3 py-1.5 rounded-lg transition-colors ${showMarketScales ? 'accent-bg text-[var(--navy)] border-transparent' : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]'}`}>
                Market Scales
              </button>
            </>
          )}
          {isTrackComplete && (
            <button onClick={saveAllTeams}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold accent-bg text-[var(--navy)] hover:opacity-90">
              {isTrackSaved ? '✓ Saved' : 'Save Draft'}
            </button>
          )}
          <button onClick={() => { if (window.confirm('Reset entire draft board?')) resetDraft(); }}
            className="text-xs border border-red-500/50 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors">
            Reset Draft
          </button>
          <button onClick={() => setTeamNames([])}
            className="text-xs text-[var(--text-dim)] hover:text-[var(--danger)] border border-[var(--border)] px-3 py-1.5 rounded-lg transition-colors">
            Reset Setup
          </button>
        </div>
      </div>

      {/* Market scales panel */}
      {showMarketScales && (
        <GlowCard className="grid grid-cols-2 gap-6" hover={false}>
          {[
            { label: 'Inflation (top 100 overbid)', value: inflationScale, set: setInflationScale },
            { label: 'Deflation (bottom players underbid)', value: deflationScale, set: setDeflationScale },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-xs text-[var(--text-dim)]">{label}</span>
                <span className="text-xs font-mono accent-text">{value.toFixed(1)}x</span>
              </div>
              <input type="range" min={1} max={3} step={0.1} value={value}
                onChange={(e) => set(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: 'var(--accent)' }} />
            </div>
          ))}
        </GlowCard>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* ── Available Players ── */}
        <div className="xl:col-span-3 space-y-0">
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            {/* Filters */}
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3 flex-wrap bg-[var(--navy-2)]">
              <input type="text" placeholder="Search players..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]" />
              <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}
                className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm text-[var(--text)] outline-none">
                <option value="ALL">All Pos</option>
                {BASEBALL_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <PlayerTypeToggle value={playerTypeFilter} onChange={setPlayerTypeFilter} />
              <TeamRankingPanel />
            </div>

            <div className="overflow-auto" style={{ maxHeight: '560px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('rank')} style={{ width: '36px', cursor: 'pointer' }}># {sortInd('rank')}</th>
                    <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>Player {sortInd('name')}</th>
                    <th style={{ width: '50px' }}>Pos</th>
                    <th style={{ width: '130px' }}>Assign</th>
                    <th style={{ width: '30px' }} />
                    {leagueSettings.isAuction && (
                      <th onClick={() => handleSort('auctionValue')} style={{ width: '60px', cursor: 'pointer' }}>$ {sortInd('auctionValue')}</th>
                    )}
                    {BASEBALL_CATEGORIES.map((cat) => (
                      <th key={cat} onClick={() => handleSort(`stats.${cat}`)} style={{ width: '52px', cursor: 'pointer' }}>
                        {cat} {sortInd(`stats.${cat}`)}
                      </th>
                    ))}
                    <th onClick={() => handleSort('stats.IP')} style={{ width: '52px', cursor: 'pointer' }}>
                      IP {sortInd('stats.IP')}
                    </th>
                    <th onClick={() => handleSort('stats.AB')} style={{ width: '52px', cursor: 'pointer' }}>
                      AB {sortInd('stats.AB')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((player) => {
                    const suggestedVal = playerValueOverrides[player.id] ?? player.auctionValue ?? 1;
                    const isAssigning = assigningPlayerId === player.id;
                    return (
                      <tr key={player.id}>
                        <td><span className="text-xs font-mono text-[var(--text-dim)]">{player.rank}</span></td>
                        <td>
                          <div className="min-w-0">
                            <div className="font-medium text-[var(--text)] text-sm leading-tight">{player.name}</div>
                            {player.team && <div className="text-[10px] text-[var(--text-dim)]">{player.team}</div>}
                          </div>
                        </td>
                        <td><span className="text-xs accent-text font-mono">{player.positions.join('/')}</span></td>
                        <td>
                          {isAssigning ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <select value={assignTeam} onChange={(e) => setAssignTeam(e.target.value)}
                                className="bg-[var(--navy-2)] border border-[var(--border)] rounded px-1 py-0.5 text-xs text-[var(--text)] outline-none max-w-[80px]">
                                {teamNames.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                              {leagueSettings.isAuction && (
                                <input type="number" min={1} value={assignPrice}
                                  onChange={(e) => setAssignPrice(parseInt(e.target.value) || 1)}
                                  className="w-12 bg-[var(--navy-2)] border border-[var(--border)] rounded px-1 py-0.5 text-xs text-[var(--gold)] text-center outline-none font-mono" />
                              )}
                              <button onClick={() => handleAssign(player)} className="px-2 py-0.5 rounded accent-bg text-[var(--navy)] text-xs font-bold">✓</button>
                              <button onClick={() => setAssigningPlayerId(null)} className="text-xs text-[var(--text-dim)] px-1">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => startAssigning(player)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold accent-bg text-[var(--navy)] hover:opacity-90">
                              Draft
                            </button>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => handleFlag(player)}
                            className={`text-sm ${flaggedSet.has(player.id) ? 'text-yellow-400' : 'text-[var(--text-dim)] hover:text-yellow-400'}`}
                            title={flaggedSet.has(player.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                          >
                            {flaggedSet.has(player.id) ? '★' : '☆'}
                          </button>
                        </td>
                        {leagueSettings.isAuction && (
                          <td>
                            {showRange ? (
                              (() => {
                                const range = rangesMap.get(player.id);
                                return range
                                  ? <span className="text-sm font-mono text-[var(--gold)]">${range.low}–${range.high}</span>
                                  : <span className="text-sm font-mono text-[var(--gold)]">${suggestedVal}</span>;
                              })()
                            ) : editingValueId === player.id ? (
                              <input type="number" min={1} autoFocus value={editingValueInput}
                                onChange={(e) => setEditingValueInput(e.target.value)}
                                onBlur={() => {
                                  const v = parseInt(editingValueInput);
                                  if (v > 0) setPlayerValueOverride(player.id, v);
                                  else clearPlayerValueOverride(player.id);
                                  setEditingValueId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                  if (e.key === 'Escape') { clearPlayerValueOverride(player.id); setEditingValueId(null); }
                                }}
                                className="w-14 bg-[var(--navy-2)] border border-[var(--accent)] rounded px-1 py-0.5 text-sm text-[var(--gold)] text-center outline-none font-mono" />
                            ) : (
                              <button onClick={() => { setEditingValueId(player.id); setEditingValueInput(String(suggestedVal)); }}
                                className="text-sm font-mono text-[var(--gold)] hover:underline cursor-text" title="Click to override">
                                ${suggestedVal}{playerValueOverrides[player.id] !== undefined && <span className="text-[9px] text-[var(--text-dim)] ml-0.5">✎</span>}
                              </button>
                            )}
                          </td>
                        )}
                        {BASEBALL_CATEGORIES.map((cat) => {
                          const v = player.stats[cat];
                          return (
                            <td key={cat} className="text-xs font-mono text-[var(--text-dim)]">
                              {v !== undefined ? (['ERA', 'WHIP', 'OBP'].includes(cat) ? v.toFixed(2) : v.toFixed(0)) : '—'}
                            </td>
                          );
                        })}
                        <td className="text-xs font-mono text-[var(--text-dim)]">
                          {player.stats.IP !== undefined ? player.stats.IP.toFixed(1) : '—'}
                        </td>
                        <td className="text-xs font-mono text-[var(--text-dim)]">
                          {player.stats.AB !== undefined ? player.stats.AB.toFixed(0) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={leagueSettings.isAuction ? 18 : 17} className="text-center text-[var(--text-dim)] py-8 text-sm">No available players.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Team Rosters ── */}
        <div className="xl:col-span-2 space-y-3 max-h-[640px] overflow-y-auto">
          {teamNames.map((name) => {
            const picks = allTeams[name] ?? [];
            const { total, spent, remaining } = teamBudget(name);
            return (
              <GlowCard key={name} padding={false} hover={false} className="overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <button onClick={() => setSidebarTeam(name)}
                      className="text-sm font-semibold text-[var(--text)] hover:accent-text transition-colors text-left">
                      {name} <span className="text-[10px] text-[var(--text-dim)] ml-1">↗ roster</span>
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--text-dim)]">{picks.length} picks</span>
                      {leagueSettings.isAuction && (
                        <div className="flex items-center gap-1 text-xs font-mono">
                          <span className="text-[var(--text-dim)]">${spent}/</span>
                          {editingBudgetTeam === name ? (
                            <input type="number" min={0} autoFocus value={editingBudgetInput}
                              onChange={(e) => setEditingBudgetInput(e.target.value)}
                              onBlur={() => { const v = parseInt(editingBudgetInput); if (!isNaN(v)) setTeamBudgetAdjustment(name, v - leagueSettings.budget); setEditingBudgetTeam(null); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingBudgetTeam(null); }}
                              className="w-16 bg-[var(--navy-2)] border border-[var(--accent)] rounded px-1 py-0.5 text-[var(--gold)] text-center outline-none" />
                          ) : (
                            <button onClick={() => { setEditingBudgetTeam(name); setEditingBudgetInput(String(total)); }}
                              className="text-[var(--gold)] hover:underline cursor-text" title="Click to adjust budget">
                              ${total}<span className="text-[9px] text-[var(--text-dim)] ml-0.5">✎</span>
                            </button>
                          )}
                          <span className={remaining < 0 ? 'text-[var(--danger)]' : 'text-[var(--neon)]'}>
                            (${remaining})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {leagueSettings.isAuction && (
                    <div className="mt-1.5 w-full bg-[var(--border)] rounded-full h-1">
                      <div className="accent-bg h-1 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (spent / Math.max(1, total)) * 100)}%` }} />
                    </div>
                  )}
                </div>
                <div className="divide-y divide-[var(--border)] max-h-40 overflow-y-auto">
                  {picks.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-[var(--text-dim)]">No picks yet.</div>
                  ) : picks.map(({ player, price: p }) => (
                    <div key={player.id} className="flex items-center justify-between px-4 py-1.5 group gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-[var(--text)] truncate block">{player.name}</span>
                      </div>
                      {/* Position override */}
                      <select
                        value={positionOverrides[player.id] ?? player.positions[0] ?? 'UTIL'}
                        onChange={(e) => setPositionOverride(player.id, e.target.value)}
                        className="bg-[var(--navy-2)] border border-[var(--border)] rounded px-1 py-0.5 text-[10px] text-[var(--accent)] outline-none shrink-0"
                        title="Override position"
                      >
                        {BASEBALL_POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                        <option value="UTIL">UTIL</option>
                        <option value="BN">BN</option>
                        <option value="IL">IL</option>
                      </select>
                      <div className="flex items-center gap-2 shrink-0">
                        {leagueSettings.isAuction && p !== undefined && (
                          <span className="text-sm font-mono text-[var(--gold)]">${p}</span>
                        )}
                        <button onClick={() => removeTeamPick(name, player.id)}
                          className="text-xs text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </GlowCard>
            );
          })}
        </div>
      </div>

      {/* Team sidebar */}
      {sidebarTeam && (
        <>
          <div className="fixed inset-0 z-40 bg-black bg-opacity-30" onClick={() => setSidebarTeam(null)} />
          <TeamSidebar
            teamName={sidebarTeam}
            picks={(allTeams[sidebarTeam] ?? []) as DraftPick[]}
            allPlayers={players}
            categories={BASEBALL_CATEGORIES}
            rosterSlots={leagueSettings.rosterSlots as Record<string, number>}
            noPD={noPD}
            positionOverrides={positionOverrides}
            onClose={() => setSidebarTeam(null)}
          />
        </>
      )}
    </div>
  );
}
