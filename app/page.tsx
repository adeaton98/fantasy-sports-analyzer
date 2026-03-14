'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSportStore } from '@/store/useSportStore';

export default function HomePage() {
  const { activeSport } = useSportStore();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${activeSport}/analysis`);
  }, [activeSport, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
