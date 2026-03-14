'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSportStore } from '@/store/useSportStore';
import { useUserStore } from '@/store/useUserStore';
import Header from '@/components/layout/Header';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { activeSport } = useSportStore();
  const { user } = useUserStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !user && pathname !== '/login') {
      router.replace('/login');
    }
  }, [mounted, user, pathname, router]);

  if (!mounted) return null;
  if (!user && pathname !== '/login') return null;

  return (
    <div data-sport={activeSport} className="min-h-screen flex flex-col bg-[var(--navy)]">
      <Header />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-8">
        {children}
      </main>
    </div>
  );
}
