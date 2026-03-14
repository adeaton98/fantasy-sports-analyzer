'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBasketballStore } from '@/store/useBasketballStore';
import GlowCard from '@/components/shared/GlowCard';

const ROSTER_KEYS = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL', 'BN'] as const;

export default function BasketballLeagueSetup() {
  const { leagueSettings, updateLeagueSettings, completeSetup } = useBasketballStore();
  const router = useRouter();
  const [form, setForm] = useState({ ...leagueSettings });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateLeagueSettings(form);
    completeSetup();
    router.push('/basketball/analysis');
  };

  const updateSlot = (key: string, val: number) => {
    setForm((f) => ({ ...f, rosterSlots: { ...f.rosterSlots, [key]: val } }));
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-5xl tracking-widest text-[var(--text)] mb-1">LEAGUE SETUP</h1>
        <p className="text-[var(--text-dim)] text-sm">Configure your fantasy basketball league. Snake draft format.</p>
      </div>

      <GlowCard>
        <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)] mb-4">League Info</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[var(--text-dim)] block mb-1">Number of Teams</label>
            <input type="number" min={4} max={30} value={form.numTeams}
              onChange={(e) => setForm((f) => ({ ...f, numTeams: parseInt(e.target.value) || 10 }))}
              className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" />
          </div>
          <div>
            <label className="text-xs text-[var(--text-dim)] block mb-1">Draft Rounds</label>
            <input type="number" min={1} max={30} value={form.draftRounds}
              onChange={(e) => setForm((f) => ({ ...f, draftRounds: parseInt(e.target.value) || 13 }))}
              className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" />
          </div>
        </div>
      </GlowCard>

      <GlowCard>
        <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)] mb-4">Roster Slots</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {ROSTER_KEYS.map((key) => (
            <div key={key}>
              <label className="text-xs text-[var(--text-dim)] block mb-1 font-mono">{key}</label>
              <input type="number" min={0} max={20}
                value={(form.rosterSlots as Record<string, number>)[key] ?? 0}
                onChange={(e) => updateSlot(key, parseInt(e.target.value) || 0)}
                className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-center text-[var(--text)] outline-none focus:border-[var(--accent)]" />
            </div>
          ))}
        </div>
      </GlowCard>

      <div className="p-4 rounded-xl bg-[var(--electric-dim)] border border-[rgba(0,198,255,0.2)]">
        <p className="text-xs text-[var(--electric)]">
          <strong>FG%/FT% note:</strong> These stats are weighted by volume. Adding a player with low attempts can hurt your team percentage even if their individual % is high. The draft mode shows you the exact impact.
        </p>
      </div>

      <button type="submit"
        className="w-full py-3 rounded-xl font-semibold accent-bg text-[var(--navy)] hover:opacity-90 transition-opacity">
        Save & Continue to Analysis →
      </button>
    </form>
  );
}
