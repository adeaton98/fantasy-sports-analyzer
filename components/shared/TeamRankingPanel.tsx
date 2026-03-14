'use client';
import { useState, useRef } from 'react';
import { useBaseballStore } from '@/store/useBaseballStore';
import { MLB_TEAMS } from '@/utils/constants';

export default function TeamRankingPanel() {
  const { teamRankings, setTeamRankings, teamRankWeight, setTeamRankWeight, teamRankEnabled, setTeamRankEnabled } = useBaseballStore();
  const [showPanel, setShowPanel] = useState(false);
  const dragIdx = useRef<number | null>(null);

  // Initialize with default order if empty
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

  const toggleEnabled = () => {
    const newVal = !teamRankEnabled;
    setTeamRankEnabled(newVal);
    // Initialize rankings if enabling and empty
    if (newVal && teamRankings.length === 0) {
      setTeamRankings(MLB_TEAMS.map(t => t.abbr));
    }
  };

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        onClick={() => { toggleEnabled(); if (!teamRankEnabled) setShowPanel(true); else setShowPanel(false); }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
          teamRankEnabled
            ? 'border-[var(--accent)] accent-text accent-dim-bg'
            : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent)]/40'
        }`}
      >
        <span>⚾</span>
        Team Rank {teamRankEnabled ? `(${teamRankWeight.toFixed(1)}x)` : ''}
      </button>

      {/* Expand/collapse panel button when enabled */}
      {teamRankEnabled && (
        <button
          onClick={() => setShowPanel(v => !v)}
          className="ml-1 px-2 py-1.5 rounded text-xs text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--border)] hover:border-[var(--accent)]/40"
        >
          {showPanel ? '▲' : '▼'}
        </button>
      )}

      {/* Panel */}
      {teamRankEnabled && showPanel && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Team Rankings</span>
            <span className="text-[10px] text-[var(--text-dim)]">Drag to reorder · #1 = best</span>
          </div>

          {/* Weight slider */}
          <div className="mb-4 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--text-dim)]">Team Rank Weight</span>
              <span className="text-xs font-mono accent-text">{teamRankWeight.toFixed(1)}x</span>
            </div>
            <input type="range" min={1} max={2} step={0.05} value={teamRankWeight}
              onChange={(e) => setTeamRankWeight(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: 'var(--accent)' }} />
            <div className="flex justify-between text-[10px] text-[var(--text-dim)]">
              <span>1.0x</span><span>2.0x</span>
            </div>
          </div>

          {/* Draggable team list */}
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

          <button
            onClick={() => setTeamRankings(MLB_TEAMS.map(t => t.abbr))}
            className="mt-3 w-full text-xs text-[var(--text-dim)] hover:text-[var(--text)] py-1.5 border border-[var(--border)] rounded hover:border-[var(--accent)]/40 transition-colors"
          >
            Reset to default order
          </button>
        </div>
      )}
    </div>
  );
}
