'use client';
import React, { useRef } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { BASEBALL_CATEGORIES, BASEBALL_CATEGORY_LABELS, MLB_TEAMS } from '@/utils/constants';
import { totalDraftPool } from '@/utils/auctionCalc';
import GlowCard from '@/components/shared/GlowCard';
import type { BaseballCategory } from '@/types';

const ROSTER_KEYS_BASE = ['C', '1B', '2B', '2B/SS', '1B/3B', '3B', 'SS', 'OF', 'UTIL', 'BN', 'IL'] as const;
const PITCHER_KEYS = ['SP', 'RP'] as const;

export default function BaseballSettings() {
  const {
    leagueSettings, updateLeagueSettings,
    selectedCategories, toggleCategory,
    categoryWeights, setCategoryWeight, resetWeights,
    inflationScale, deflationScale, setInflationScale, setDeflationScale,
    batterPitcherSkew, setBatterPitcherSkew,
    teamRankings, setTeamRankings, teamRankWeight, setTeamRankWeight,
    teamRankEnabled, setTeamRankEnabled,
  } = useBaseballStore();

  const noPD = leagueSettings.noPitcherDesignation ?? false;
  const poolSize = totalDraftPool(leagueSettings);
  const dragIdx = useRef<number | null>(null);

  const teams = teamRankings.length > 0
    ? teamRankings.map(abbr => MLB_TEAMS.find(t => t.abbr === abbr) ?? { abbr, name: abbr })
    : [...MLB_TEAMS];

  const handleDragStart = (i: number) => { dragIdx.current = i; };
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const reordered = [...teams];
    const [moved] = reordered.splice(dragIdx.current, 1);
    reordered.splice(i, 0, moved);
    dragIdx.current = i;
    setTeamRankings(reordered.map(t => t.abbr));
  };
  const handleDrop = () => { dragIdx.current = null; };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-5xl tracking-widest text-[var(--text)]">SETTINGS</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">
          League configuration, category weights, and ranking preferences. Changes apply across all pages.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* League Settings */}
        <GlowCard className="space-y-5" hover={false}>
          <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">League</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-dim)]">Number of Teams</label>
              <input
                type="number" min={2} max={30}
                value={leagueSettings.numTeams}
                onChange={(e) => updateLeagueSettings({ numTeams: parseInt(e.target.value) || leagueSettings.numTeams })}
                className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            {leagueSettings.isAuction && (
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-dim)]">Draft Budget ($)</label>
                <input
                  type="number" min={50} max={10000}
                  value={leagueSettings.budget}
                  onChange={(e) => updateLeagueSettings({ budget: parseInt(e.target.value) || leagueSettings.budget })}
                  className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--gold)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-[var(--text-dim)]">Draft Format</label>
            <div className="flex gap-2">
              <button
                onClick={() => updateLeagueSettings({ isAuction: true })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${leagueSettings.isAuction ? 'accent-bg text-[var(--navy)] border-transparent' : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]'}`}
              >Auction</button>
              <button
                onClick={() => updateLeagueSettings({ isAuction: false })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${!leagueSettings.isAuction ? 'accent-bg text-[var(--navy)] border-transparent' : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]'}`}
              >Snake</button>
            </div>
          </div>
        </GlowCard>

        {/* Roster Slots */}
        <GlowCard className="space-y-4" hover={false}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Roster Slots</h2>
            <span className="text-[10px] font-mono text-[var(--text-dim)]">Draft pool: {poolSize} players</span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={noPD}
              onChange={(e) => {
                const checked = e.target.checked;
                const sp = (leagueSettings.rosterSlots as Record<string, number>).SP ?? 0;
                const rp = (leagueSettings.rosterSlots as Record<string, number>).RP ?? 0;
                const p = (leagueSettings.rosterSlots as Record<string, number>).P ?? 0;
                if (checked) {
                  updateLeagueSettings({ noPitcherDesignation: true, rosterSlots: { ...leagueSettings.rosterSlots, SP: 0, RP: 0, P: sp + rp || p || 4 } });
                } else {
                  updateLeagueSettings({ noPitcherDesignation: false, rosterSlots: { ...leagueSettings.rosterSlots, P: 0, SP: Math.floor(p / 2) || 2, RP: Math.ceil(p / 2) || 2 } });
                }
              }}
              className="w-3.5 h-3.5"
            />
            <span className="text-xs text-[var(--text-dim)]">No pitcher designation (SP/RP → P)</span>
          </label>

          <div className="grid grid-cols-4 gap-2">
            {ROSTER_KEYS_BASE.map((key) => (
              <div key={key} className="text-center">
                <div className="text-[10px] font-mono text-[var(--text-dim)] mb-0.5">{key}</div>
                <input
                  type="number" min={0} max={20}
                  value={(leagueSettings.rosterSlots as Record<string, number>)[key] ?? 0}
                  onChange={(e) => updateLeagueSettings({ rosterSlots: { ...leagueSettings.rosterSlots, [key]: parseInt(e.target.value) || 0 } })}
                  className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded px-1 py-1 text-xs text-center text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            ))}
            {noPD ? (
              <div className="text-center col-span-1">
                <div className="text-[10px] font-mono text-[var(--accent)] mb-0.5">P</div>
                <input
                  type="number" min={0} max={20}
                  value={(leagueSettings.rosterSlots as Record<string, number>).P ?? 0}
                  onChange={(e) => updateLeagueSettings({ rosterSlots: { ...leagueSettings.rosterSlots, P: parseInt(e.target.value) || 0 } })}
                  className="w-full bg-[var(--navy-2)] border border-[var(--accent)] border-opacity-50 rounded px-1 py-1 text-xs text-center text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            ) : (
              <>
                {PITCHER_KEYS.map((key) => (
                  <div key={key} className="text-center">
                    <div className="text-[10px] font-mono text-[var(--text-dim)] mb-0.5">{key}</div>
                    <input
                      type="number" min={0} max={20}
                      value={(leagueSettings.rosterSlots as Record<string, number>)[key] ?? 0}
                      onChange={(e) => updateLeagueSettings({ rosterSlots: { ...leagueSettings.rosterSlots, [key]: parseInt(e.target.value) || 0 } })}
                      className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded px-1 py-1 text-xs text-center text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        </GlowCard>

        {/* Category Weights — full width */}
        <GlowCard className="space-y-5 lg:col-span-2" hover={false}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Category Weights</h2>
            <button onClick={resetWeights} className="text-xs text-[var(--text-dim)] hover:accent-text hover:underline">Reset all to 1x</button>
          </div>

          {/* Category toggles */}
          <div>
            <div className="text-xs text-[var(--text-dim)] mb-2">Select categories to rank by:</div>
            <div className="flex flex-wrap gap-2">
              {BASEBALL_CATEGORIES.map((cat) => {
                const active = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                      active ? 'accent-bg text-[var(--navy)] border-transparent' : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    {active && <span>✓</span>} {cat}
                    <span className="text-[9px] opacity-60">{BASEBALL_CATEGORY_LABELS[cat as BaseballCategory]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Weight sliders */}
          <div className="border-t border-[var(--border)] pt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {BASEBALL_CATEGORIES.map((cat) => (
              <div key={cat} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-[var(--text)]">{cat}</span>
                    <span className="text-xs text-[var(--text-dim)]">{BASEBALL_CATEGORY_LABELS[cat as BaseballCategory]}</span>
                    {!selectedCategories.includes(cat) && (
                      <span className="text-[10px] font-mono text-[var(--text-dim)] italic">(excluded)</span>
                    )}
                  </div>
                  <span className="text-sm font-mono accent-text">{(categoryWeights[cat] ?? 1).toFixed(1)}x</span>
                </div>
                <input
                  type="range" min={0} max={3} step={0.1}
                  value={categoryWeights[cat] ?? 1}
                  onChange={(e) => setCategoryWeight(cat, parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: 'var(--accent)' }}
                />
              </div>
            ))}
          </div>
        </GlowCard>

        {/* Batter / Pitcher Skew */}
        <GlowCard className="space-y-5" hover={false}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Batter / Pitcher Skew</h2>
            {batterPitcherSkew !== 0 && (
              <button onClick={() => setBatterPitcherSkew(0)} className="text-xs text-[var(--text-dim)] hover:accent-text hover:underline">Reset</button>
            )}
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            Shift value weight toward batters or pitchers. Affects rankings on Draft and Auction pages.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text)]">
                {batterPitcherSkew === 0
                  ? 'Neutral'
                  : batterPitcherSkew > 0
                  ? `Batter bias (+${(batterPitcherSkew * 100).toFixed(0)}%)`
                  : `Pitcher bias (${(batterPitcherSkew * 100).toFixed(0)}%)`}
              </span>
              <span className="text-xs font-mono accent-text">
                {batterPitcherSkew > 0
                  ? `Bat ×${(1 + batterPitcherSkew * 0.5).toFixed(2)} · Pit ×${(1 - batterPitcherSkew * 0.5).toFixed(2)}`
                  : batterPitcherSkew < 0
                  ? `Bat ×${(1 + batterPitcherSkew * 0.5).toFixed(2)} · Pit ×${(1 - batterPitcherSkew * 0.5).toFixed(2)}`
                  : '1.00× each'}
              </span>
            </div>
            <input
              type="range" min={-1} max={1} step={0.05}
              value={batterPitcherSkew}
              onChange={(e) => setBatterPitcherSkew(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: 'var(--accent)' }}
            />
            <div className="flex justify-between text-[9px] font-mono text-[var(--text-dim)]">
              <span>All Pitchers</span>
              <span>Neutral</span>
              <span>All Batters</span>
            </div>
          </div>
        </GlowCard>

        {/* Market Scales — auction only */}
        {leagueSettings.isAuction && (
          <GlowCard className="space-y-5" hover={false}>
            <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Market Scales</h2>
            <p className="text-xs text-[var(--text-dim)]">
              Adjust to match your league's bidding tendencies.
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[var(--text)]">Inflation Scale</div>
                  <div className="text-[10px] text-[var(--text-dim)]">Top 100 players overvalued — boosts their suggested bids</div>
                </div>
                <span className="text-sm font-mono accent-text">{inflationScale.toFixed(1)}x</span>
              </div>
              <input
                type="range" min={1} max={3} step={0.1} value={inflationScale}
                onChange={(e) => setInflationScale(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div className="flex justify-between text-[9px] font-mono text-[var(--text-dim)]">
                <span>1x (neutral)</span><span>2x</span><span>3x</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[var(--text)]">Deflation Scale</div>
                  <div className="text-[10px] text-[var(--text-dim)]">Late-round players undervalued — reduces their suggested bids</div>
                </div>
                <span className="text-sm font-mono accent-text">{deflationScale.toFixed(1)}x</span>
              </div>
              <input
                type="range" min={1} max={3} step={0.1} value={deflationScale}
                onChange={(e) => setDeflationScale(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div className="flex justify-between text-[9px] font-mono text-[var(--text-dim)]">
                <span>1x (neutral)</span><span>2x</span><span>3x</span>
              </div>
            </div>
          </GlowCard>
        )}

        {/* Team Rankings */}
        <GlowCard className="space-y-5" hover={false}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Team Rank Boost</h2>
            <button
              onClick={() => {
                const newVal = !teamRankEnabled;
                setTeamRankEnabled(newVal);
                if (newVal && teamRankings.length === 0) setTeamRankings(MLB_TEAMS.map(t => t.abbr));
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                teamRankEnabled ? 'accent-bg text-[var(--navy)] border-transparent' : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              {teamRankEnabled ? '● Enabled' : '○ Disabled'}
            </button>
          </div>

          <p className="text-xs text-[var(--text-dim)]">
            Boost player values based on their MLB team's strength ranking. Drag teams to set order (#1 = best team).
          </p>

          {teamRankEnabled ? (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-dim)]">Boost Weight</span>
                  <span className="text-xs font-mono accent-text">{teamRankWeight.toFixed(2)}x</span>
                </div>
                <input
                  type="range" min={1} max={2} step={0.05} value={teamRankWeight}
                  onChange={(e) => setTeamRankWeight(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div className="flex justify-between text-[9px] font-mono text-[var(--text-dim)]">
                  <span>1x (no boost)</span><span>2x (max boost)</span>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-3">
                <div className="flex justify-between items-center text-[10px] font-mono text-[var(--text-dim)] mb-2 px-2">
                  <span>#1 = Best team · Drag to reorder</span>
                  <button onClick={() => setTeamRankings(MLB_TEAMS.map(t => t.abbr))} className="hover:accent-text hover:underline">Reset order</button>
                </div>
                <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
                  {teams.map((team, i) => (
                    <div
                      key={team.abbr}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDrop={handleDrop}
                      className="flex items-center gap-2 px-2 py-1 rounded cursor-grab active:cursor-grabbing hover:bg-[var(--navy-2)] select-none"
                    >
                      <span className="text-[10px] font-mono text-[var(--text-dim)] w-4 text-right shrink-0">{i + 1}</span>
                      <span className="text-[10px] font-mono accent-text w-8 shrink-0">{team.abbr}</span>
                      <span className="text-xs text-[var(--text)] truncate">{team.name}</span>
                      <span className="ml-auto text-[var(--text-dim)] text-xs">⠿</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-[var(--text-dim)] text-sm">
              Enable to boost player values based on their team's projected strength.
            </div>
          )}
        </GlowCard>
      </div>
    </div>
  );
}
