'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBaseballStore } from '@/store/useBaseballStore';
import GlowCard from '@/components/shared/GlowCard';

const ROSTER_KEYS = ['C', '1B', '2B', '2B/SS', '1B/3B', '3B', 'SS', 'OF', 'UTIL', 'BN', 'IL', 'SP', 'RP'] as const;

export default function BaseballLeagueSetup() {
  const { leagueSettings, updateLeagueSettings, completeSetup } = useBaseballStore();
  const router = useRouter();
  const [form, setForm] = useState({ ...leagueSettings });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateLeagueSettings(form);
    completeSetup();
    router.push('/baseball/analysis');
  };

  const updateSlot = (key: string, val: number) => {
    setForm((f) => ({ ...f, rosterSlots: { ...f.rosterSlots, [key]: val } }));
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-5xl tracking-widest text-[var(--text)] mb-1">LEAGUE SETUP</h1>
        <p className="text-[var(--text-dim)] text-sm">Configure your fantasy baseball league once. Settings are saved and can be changed later.</p>
      </div>

      <GlowCard>
        <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)] mb-4">League Info</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[var(--text-dim)] block mb-1">Number of Teams</label>
            <input
              type="number" min={4} max={30} value={form.numTeams}
              onChange={(e) => setForm((f) => ({ ...f, numTeams: parseInt(e.target.value) || 10 }))}
              className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-dim)] block mb-1">Draft Rounds</label>
            <input
              type="number" min={1} max={50} value={form.draftRounds}
              onChange={(e) => setForm((f) => ({ ...f, draftRounds: parseInt(e.target.value) || 23 }))}
              className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      </GlowCard>

      <GlowCard>
        <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)] mb-4">Draft Format</h2>
        <div className="flex items-center gap-4 mb-4">
          {[{ val: true, label: 'Auction Draft' }, { val: false, label: 'Snake Draft' }].map(({ val, label }) => (
            <button
              key={String(val)} type="button"
              onClick={() => setForm((f) => ({ ...f, isAuction: val }))}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                form.isAuction === val
                  ? 'accent-bg text-[var(--navy)] border-transparent'
                  : 'bg-[var(--navy-2)] text-[var(--text-dim)] border-[var(--border)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {form.isAuction && (
          <div>
            <label className="text-xs text-[var(--text-dim)] block mb-1">Starting Budget ($)</label>
            <input
              type="number" min={100} max={1000} value={form.budget}
              onChange={(e) => setForm((f) => ({ ...f, budget: parseInt(e.target.value) || 260 }))}
              className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        )}
      </GlowCard>

      <GlowCard>
        <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)] mb-4">Roster Slots</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {ROSTER_KEYS.map((key) => (
            <div key={key}>
              <label className="text-xs text-[var(--text-dim)] block mb-1 font-mono">{key}</label>
              <input
                type="number" min={0} max={20}
                value={(form.rosterSlots as Record<string, number>)[key] ?? 0}
                onChange={(e) => updateSlot(key, parseInt(e.target.value) || 0)}
                className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-center text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          ))}
        </div>
      </GlowCard>

      <button type="submit"
        className="w-full py-3 rounded-xl font-semibold accent-bg text-[var(--navy)] hover:opacity-90 transition-opacity">
        Save & Continue to Analysis →
      </button>
    </form>
  );
}
