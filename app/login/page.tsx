'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';

export default function LoginPage() {
  const { user, setUser } = useUserStore();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && user) router.replace('/');
  }, [mounted, user, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setUser({ firstName: firstName.trim(), lastName: lastName.trim() });
    router.push('/');
  };

  if (!mounted || user) return null;

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-xl rotate-45" style={{ background: '#00FF88', opacity: 0.2 }} />
            <div className="absolute inset-[4px] rounded-lg flex items-center justify-center" style={{ background: '#00FF88' }}>
              <span className="text-[#0A0E1A] text-base font-bold font-mono">FX</span>
            </div>
          </div>
          <div className="text-center">
            <div className="font-display text-3xl tracking-widest" style={{ color: '#00FF88' }}>FANTEX</div>
            <div className="text-[10px] font-mono tracking-[0.3em] uppercase mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Fantasy Analytics</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-white">Welcome</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Enter your name to get started</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>First Name</label>
              <input
                type="text" autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)}
                placeholder="Alex"
                className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-colors"
                style={{ background: '#0A0E1A', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={(e) => e.target.style.borderColor = '#00FF88'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Last Name</label>
              <input
                type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                placeholder="Deaton"
                className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-colors"
                style={{ background: '#0A0E1A', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={(e) => e.target.style.borderColor = '#00FF88'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>
            <button type="submit" disabled={!firstName.trim() || !lastName.trim()}
              className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#00FF88', color: '#0A0E1A' }}>
              Get Started →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
