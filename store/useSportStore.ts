'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Sport } from '@/types';

interface SportStore {
  activeSport: Sport;
  setActiveSport: (sport: Sport) => void;
}

export const useSportStore = create<SportStore>()(
  persist(
    (set) => ({
      activeSport: 'baseball',
      setActiveSport: (sport) => set({ activeSport: sport }),
    }),
    { name: 'sport-store' }
  )
);
