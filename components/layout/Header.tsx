'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SportToggle from './SportToggle';
import Nav from './Nav';
import { useSportStore } from '@/store/useSportStore';
import { useUserStore } from '@/store/useUserStore';
import { useBaseballStore } from '@/store/useBaseballStore';
import WatchlistPanel from '@/components/shared/WatchlistPanel';
import AvoidlistPanel from '@/components/shared/AvoidlistPanel';

function WatchlistButton() {
  const { flaggedPlayerIds } = useBaseballStore();
  const { activeSport } = useSportStore();
  const [open, setOpen] = useState(false);

  if (activeSport !== 'baseball') return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent)]/40 transition-colors"
        title="Watchlist"
      >
        <span className="text-[var(--gold)]">★</span>
        {flaggedPlayerIds.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full accent-bg text-[var(--navy)] text-[9px] font-bold font-mono flex items-center justify-center">
            {flaggedPlayerIds.length > 9 ? '9+' : flaggedPlayerIds.length}
          </span>
        )}
      </button>
      <WatchlistPanel isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AvoidlistButton() {
  const { avoidedPlayerIds } = useBaseballStore();
  const { activeSport } = useSportStore();
  const [open, setOpen] = useState(false);

  if (activeSport !== 'baseball') return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-red-500/40 transition-colors"
        title="Avoid List"
      >
        <span className="text-red-400 font-bold text-base leading-none">−</span>
        {avoidedPlayerIds.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold font-mono flex items-center justify-center">
            {avoidedPlayerIds.length > 9 ? '9+' : avoidedPlayerIds.length}
          </span>
        )}
      </button>
      <AvoidlistPanel isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default function Header() {
  const { activeSport } = useSportStore();
  const { user, clearUser } = useUserStore();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] backdrop-blur-xl"
      style={{ background: 'rgba(9, 13, 24, 0.85)' }}>
      <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-lg rotate-45"
              style={{ background: 'var(--accent)', opacity: 0.2 }} />
            <div className="absolute inset-[3px] rounded-md flex items-center justify-center"
              style={{ background: 'var(--accent)' }}>
              <span className="text-[var(--navy)] text-xs font-bold font-mono">FX</span>
            </div>
          </div>
          <div>
            <span className="font-display text-xl tracking-widest accent-text">FANTEX</span>
            <div className="text-[9px] font-mono text-[var(--text-dim)] tracking-[0.2em] uppercase -mt-0.5">
              {activeSport === 'baseball' ? 'Baseball Analytics' : 'Basketball Analytics'}
            </div>
          </div>
        </div>

        {/* Nav */}
        <Nav />

        {/* Sport toggle + watchlist + user */}
        <div className="flex items-center gap-3 shrink-0">
          <AvoidlistButton />
          <WatchlistButton />
          <SportToggle />
          {user && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-full accent-bg flex items-center justify-center text-[var(--navy)] text-xs font-bold font-mono">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <span className="text-xs text-[var(--text-dim)] hidden sm:block">{user.firstName} {user.lastName}</span>
              <button onClick={() => { clearUser(); router.push('/login'); }}
                className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] font-mono px-1.5 py-0.5 rounded hover:bg-[var(--navy-3)] transition-colors"
                title="Sign out">⊗</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
