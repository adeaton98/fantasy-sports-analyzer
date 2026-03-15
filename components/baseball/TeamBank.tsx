'use client';
import React, { useMemo, useState } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { computeRankings } from '@/utils/rankings';
import { BASEBALL_CATEGORIES, BASEBALL_CATEGORY_LABELS } from '@/utils/constants';
import { fillRosterSlots } from '@/utils/rosterUtils';
import MyDraft from './MyDraft';
import GlowCard from '@/components/shared/GlowCard';
import type { BankedTeam, DraftPick } from '@/types';
import type { BaseballCategory } from '@/types';

export default function TeamBank() {
  const {
    bankedTeams, saveTeamToBank, deleteBankedTeam, updateBankedTeam, updateBankedTeamReserves, renameBankedTeam,
    players, myTeam, myTeamReserves, selectedCategories, categoryWeights,
    leagueSettings, positionOverrides,
  } = useBaseballStore();

  const [activeTab, setActiveTab] = useState<'draft' | 'bank'>('draft');
  const [saveName, setSaveName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [swapTeamId, setSwapTeamId] = useState<string | null>(null);
  const [selectedSwapPick, setSelectedSwapPick] = useState<{ type: 'starter' | 'reserve'; playerId: string } | null>(null);

  // Ranked players for category coverage computation
  const allRanked = useMemo(() => {
    if (players.length === 0) return [];
    return computeRankings(players, selectedCategories, categoryWeights, 'baseball');
  }, [players, selectedCategories, categoryWeights]);

  // Suppress unused variable warning — allRanked kept for potential future use
  void allRanked;

  const handleSaveToBank = () => {
    const defaultName = `Team ${bankedTeams.length + 1}`;
    setSaveName(defaultName);
    setShowSaveModal(true);
  };

  const handleConfirmSave = () => {
    const name = saveName.trim() || `Team ${bankedTeams.length + 1}`;
    saveTeamToBank(name);
    setShowSaveModal(false);
    setSaveName('');
    setActiveTab('bank');
  };

  // Compute category coverage for a set of picks (starters only, not reserves)
  function getCoverage(picks: DraftPick[]) {
    const teamPlayers = picks.map((p) => p.player);
    if (teamPlayers.length === 0 || players.length === 0) return [];
    return selectedCategories.map((cat) => {
      const myTotal = teamPlayers.reduce((s, p) => s + (p.stats[cat] ?? 0), 0);
      const myAvg = teamPlayers.length > 0 ? myTotal / teamPlayers.length : 0;
      const poolTotal = players.reduce((s, p) => s + (p.stats[cat] ?? 0), 0);
      const poolAvg = players.length > 0 ? poolTotal / players.length : 1;
      const pct = poolAvg > 0 ? (myAvg / poolAvg) * 100 : 0;
      return { cat: cat as BaseballCategory, pct };
    });
  }

  const noPD = leagueSettings.noPitcherDesignation ?? false;

  const performSwap = (teamId: string, starterPlayerId: string, reservePlayerId: string) => {
    const team = bankedTeams.find(t => t.id === teamId);
    if (!team) return;
    const starterPick = team.picks.find(p => p.player.id === starterPlayerId);
    const reservePick = (team.reserves ?? []).find(p => p.player.id === reservePlayerId);
    if (!starterPick || !reservePick) return;
    const newPicks = team.picks.map(p => p.player.id === starterPlayerId ? reservePick : p);
    const newReserves = (team.reserves ?? []).map(p => p.player.id === reservePlayerId ? starterPick : p);
    updateBankedTeamReserves(teamId, newPicks, newReserves);
    setSelectedSwapPick(null);
  };

  const handleSwapClick = (teamId: string, type: 'starter' | 'reserve', playerId: string) => {
    if (swapTeamId !== teamId) {
      setSelectedSwapPick({ type, playerId });
      setSwapTeamId(teamId);
      return;
    }
    if (!selectedSwapPick) {
      setSelectedSwapPick({ type, playerId });
      return;
    }
    if (selectedSwapPick.type === type) {
      // Same type — just change selection
      setSelectedSwapPick({ type, playerId });
      return;
    }
    // Different types — perform swap
    if (selectedSwapPick.type === 'starter' && type === 'reserve') {
      performSwap(teamId, selectedSwapPick.playerId, playerId);
    } else if (selectedSwapPick.type === 'reserve' && type === 'starter') {
      performSwap(teamId, playerId, selectedSwapPick.playerId);
    }
  };

  const tabs = [
    { id: 'draft' as const, label: 'Draft', icon: '◎' },
    { id: 'bank' as const, label: `Team Bank (${bankedTeams.length})`, icon: '💾' },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-display text-4xl tracking-widest accent-text">TEAM BANK</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">Draft and save team builds for comparison</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[var(--border)] pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[var(--accent)] accent-text accent-dim-bg'
                : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--navy-2)]'
            }`}
          >
            <span className="font-mono text-xs">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'draft' && (
        <MyDraft onSaveToBank={handleSaveToBank} />
      )}

      {activeTab === 'bank' && (
        <div className="space-y-4">
          {bankedTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="text-5xl">💾</div>
              <h2 className="font-display text-2xl tracking-wider text-[var(--text)]">NO SAVED TEAMS</h2>
              <p className="text-[var(--text-dim)] max-w-sm">
                Go to the Draft tab, build a team, then hit &quot;Save to Bank&quot; to store it here.
              </p>
              <button onClick={() => setActiveTab('draft')}
                className="mt-2 px-4 py-2 rounded-lg accent-bg text-[var(--navy)] font-semibold text-sm hover:opacity-90">
                Go to Draft →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {bankedTeams.map((team) => {
                const isExpanded = expandedId === team.id;
                const isEditing = editingId === team.id;
                const isRenaming = renamingId === team.id;
                const isSwapping = swapTeamId === team.id;
                const coverage = getCoverage(team.picks);
                const totalSpent = team.picks.reduce((s, p) => s + (p.price ?? 0), 0);
                const teamReserves = team.reserves ?? [];

                return (
                  <GlowCard key={team.id} className="space-y-4">
                    {/* Team header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {isRenaming ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { renameBankedTeam(team.id, renameValue.trim() || team.name); setRenamingId(null); }
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                              autoFocus
                              className="flex-1 bg-[var(--navy-2)] border border-[var(--accent)] rounded px-2 py-1 text-sm text-[var(--text)] outline-none font-display tracking-wider"
                            />
                            <button onClick={() => { renameBankedTeam(team.id, renameValue.trim() || team.name); setRenamingId(null); }}
                              className="text-xs accent-text hover:opacity-80">✓</button>
                            <button onClick={() => setRenamingId(null)}
                              className="text-xs text-[var(--text-dim)] hover:text-[var(--text)]">✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-xl tracking-wider accent-text truncate">{team.name}</h3>
                            <button onClick={() => { setRenamingId(team.id); setRenameValue(team.name); }}
                              className="text-[10px] text-[var(--text-dim)] hover:accent-text font-mono px-1 py-0.5 rounded hover:bg-[var(--navy-2)]">✎</button>
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-dim)]">
                          <span>{team.picks.length} starters</span>
                          {teamReserves.length > 0 && <span className="text-[var(--text-dim)]">+{teamReserves.length} reserves</span>}
                          {totalSpent > 0 && <span className="text-[var(--gold)]">${totalSpent} spent</span>}
                          <span>{new Date(team.savedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setExpandedId(isExpanded ? null : team.id); setEditingId(null); if (isSwapping) { setSwapTeamId(null); setSelectedSwapPick(null); } }}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${isExpanded ? 'border-[var(--accent)] accent-text accent-dim-bg' : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]'}`}
                        >
                          {isExpanded ? '▲ Less' : '▼ More'}
                        </button>
                        {teamReserves.length > 0 && (
                          <button
                            onClick={() => {
                              if (isSwapping) {
                                setSwapTeamId(null);
                                setSelectedSwapPick(null);
                              } else {
                                setSwapTeamId(team.id);
                                setSelectedSwapPick(null);
                                setExpandedId(team.id);
                              }
                            }}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${isSwapping ? 'border-yellow-500 text-yellow-400' : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]'}`}
                          >
                            {isSwapping ? '✕ Cancel' : '⇄ Swap'}
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingId(isEditing ? null : team.id); setExpandedId(team.id); }}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${isEditing ? 'border-yellow-500 text-yellow-400' : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]'}`}
                        >
                          {isEditing ? '✓ Done' : '✎ Edit'}
                        </button>
                        <button
                          onClick={() => { if (window.confirm(`Delete "${team.name}"?`)) deleteBankedTeam(team.id); }}
                          className="text-xs px-2 py-1 rounded border border-red-500/40 text-red-400 hover:bg-red-900/20 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Category coverage bars — always visible */}
                    {coverage.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {coverage.map(({ cat, pct }) => {
                          const isNeg = ['ERA', 'WHIP'].includes(cat);
                          const score = isNeg ? (200 - pct) : pct;
                          const color = score >= 110 ? 'var(--accent)' : score >= 80 ? 'var(--gold)' : '#ef4444';
                          return (
                            <div key={cat}>
                              <div className="flex justify-between items-center mb-0.5">
                                <span className="text-[10px] text-[var(--text-dim)] font-mono">{cat}</span>
                                <span className="text-[10px] font-mono" style={{ color }}>{pct.toFixed(0)}%</span>
                              </div>
                              <div className="h-1 bg-[var(--navy-2)] rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(150, pct)}%`, background: color, maxWidth: '100%' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Swap mode hint */}
                    {isSwapping && (
                      <div className="text-[10px] font-mono text-yellow-400 bg-yellow-900/20 px-2 py-1 rounded border border-yellow-700/30">
                        {selectedSwapPick
                          ? `Selected: ${selectedSwapPick.type} — click a ${selectedSwapPick.type === 'starter' ? 'reserve' : 'starter'} to swap`
                          : 'Click a starter or reserve to begin swap'}
                      </div>
                    )}

                    {/* Expanded: roster template + reserves */}
                    {isExpanded && (
                      <div className="border-t border-[var(--border)] pt-3 space-y-1 max-h-80 overflow-y-auto">
                        {team.picks.length === 0 ? (
                          <p className="text-xs text-[var(--text-dim)] text-center py-2">No players</p>
                        ) : (
                          <>
                            {/* Roster slots */}
                            {fillRosterSlots(team.picks, leagueSettings.rosterSlots as Record<string, number>, positionOverrides, noPD).map(({ slot, pick }, i) => (
                              <div
                                key={slot + i}
                                onClick={() => {
                                  if (isSwapping && pick) handleSwapClick(team.id, 'starter', pick.player.id);
                                }}
                                className={`flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                                  pick ? 'bg-[var(--navy-2)]' : 'border border-dashed border-[var(--border)]'
                                } ${isSwapping && pick ? 'cursor-pointer hover:border hover:border-yellow-500/50' : ''} ${
                                  isSwapping && selectedSwapPick?.type === 'starter' && pick?.player.id === selectedSwapPick.playerId
                                    ? 'border border-yellow-500 bg-yellow-900/20'
                                    : ''
                                }`}
                              >
                                <span className={`font-mono w-10 shrink-0 text-[10px] ${pick ? 'accent-text' : 'text-[var(--text-dim)]'}`}>{slot}</span>
                                {pick ? (
                                  <>
                                    <span className="font-mono text-[10px] text-[var(--text-dim)] shrink-0">{pick.player.positions.join('/')}</span>
                                    <span className="text-[var(--text)] truncate">{pick.player.name}</span>
                                    <span className="text-[var(--text-dim)] text-[10px] shrink-0">{pick.player.team}</span>
                                  </>
                                ) : (
                                  <span className="text-[var(--text-dim)] italic">empty</span>
                                )}
                                <div className="flex items-center gap-2 ml-auto shrink-0">
                                  {pick?.price !== undefined && pick.price > 0 && (
                                    <span className="font-mono text-[var(--gold)] text-[10px]">${pick.price}</span>
                                  )}
                                  {isEditing && pick && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); updateBankedTeam(team.id, team.picks.filter(p => p.player.id !== pick.player.id)); }}
                                      className="text-red-400 hover:text-red-300 font-mono text-[10px] px-1"
                                    >✕</button>
                                  )}
                                </div>
                              </div>
                            ))}

                            {/* Reserves section */}
                            {teamReserves.length > 0 && (
                              <>
                                <div className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider pt-2 pb-0.5 border-t border-[var(--border)]">
                                  Reserves ({teamReserves.length}/15)
                                </div>
                                {teamReserves.map((r, i) => (
                                  <div
                                    key={r.player.id + i}
                                    onClick={() => { if (isSwapping) handleSwapClick(team.id, 'reserve', r.player.id); }}
                                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs bg-[var(--navy-2)] opacity-80 transition-colors ${
                                      isSwapping ? 'cursor-pointer hover:border hover:border-yellow-500/50' : ''
                                    } ${
                                      isSwapping && selectedSwapPick?.type === 'reserve' && r.player.id === selectedSwapPick.playerId
                                        ? 'border border-yellow-500 bg-yellow-900/20 opacity-100'
                                        : ''
                                    }`}
                                  >
                                    <span className="font-mono w-10 shrink-0 text-[10px] text-[var(--text-dim)]">RES</span>
                                    <span className="font-mono text-[10px] text-[var(--text-dim)] shrink-0">{r.player.positions.join('/')}</span>
                                    <span className="text-[var(--text)] truncate">{r.player.name}</span>
                                    <span className="text-[var(--text-dim)] text-[10px] shrink-0">{r.player.team}</span>
                                    <div className="flex items-center gap-2 ml-auto shrink-0">
                                      {r.price !== undefined && r.price > 0 && (
                                        <span className="font-mono text-[var(--gold)] text-[10px]">${r.price}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </GlowCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Save to Bank Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="font-display text-xl tracking-wider accent-text">SAVE TEAM</h3>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Team Name</label>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmSave(); if (e.key === 'Escape') setShowSaveModal(false); }}
                autoFocus
                className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <p className="text-xs text-[var(--text-dim)]">
              Saving {myTeam.length} player{myTeam.length !== 1 ? 's' : ''}
              {myTeamReserves.length > 0 ? ` + ${myTeamReserves.length} reserve${myTeamReserves.length !== 1 ? 's' : ''}` : ''}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowSaveModal(false)}
                className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-dim)] hover:text-[var(--text)]">
                Cancel
              </button>
              <button onClick={handleConfirmSave}
                className="flex-1 py-2 rounded-lg accent-bg text-[var(--navy)] font-semibold text-sm hover:opacity-90">
                Save to Bank
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Suppress unused import warnings
void BASEBALL_CATEGORIES;
void BASEBALL_CATEGORY_LABELS;
