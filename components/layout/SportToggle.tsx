'use client';
import { useSportStore } from '@/store/useSportStore';

export default function SportToggle() {
  const { activeSport, setActiveSport } = useSportStore();

  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--navy-2)] border border-[var(--border)]">
      {(['baseball', 'basketball'] as const).map((sport) => {
        const active = activeSport === sport;
        return (
          <button
            key={sport}
            onClick={() => setActiveSport(sport)}
            className={`
              relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
              ${active
                ? 'text-[var(--navy)] font-semibold shadow-lg'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }
            `}
            style={active ? { background: 'var(--accent)' } : {}}
          >
            <span className="text-base">{sport === 'baseball' ? '⚾' : '🏀'}</span>
            <span className="capitalize">{sport}</span>
          </button>
        );
      })}
    </div>
  );
}
