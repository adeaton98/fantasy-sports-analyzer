import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { YearCategoryHistory, YearDraftRecap, CategoryHistoryRow } from '@/types';

interface LeagueHistoryState {
  categoryHistory: YearCategoryHistory[];
  draftRecaps: YearDraftRecap[];
  addCategoryHistory: (year: number, rows: CategoryHistoryRow[]) => void;
  addDraftRecap: (year: number, picks: import('@/types').HistoricalDraftPick[]) => void;
  removeCategoryYear: (year: number) => void;
  removeDraftYear: (year: number) => void;
  clearAll: () => void;
}

export const useLeagueHistoryStore = create<LeagueHistoryState>()(
  persist(
    (set) => ({
      categoryHistory: [],
      draftRecaps: [],

      addCategoryHistory: (year, rows) =>
        set((state) => {
          const filtered = state.categoryHistory.filter((y) => y.year !== year);
          return { categoryHistory: [...filtered, { year, rows }].sort((a, b) => b.year - a.year) };
        }),

      addDraftRecap: (year, picks) =>
        set((state) => {
          const filtered = state.draftRecaps.filter((y) => y.year !== year);
          return { draftRecaps: [...filtered, { year, picks }].sort((a, b) => b.year - a.year) };
        }),

      removeCategoryYear: (year) =>
        set((state) => ({ categoryHistory: state.categoryHistory.filter((y) => y.year !== year) })),

      removeDraftYear: (year) =>
        set((state) => ({ draftRecaps: state.draftRecaps.filter((y) => y.year !== year) })),

      clearAll: () => set({ categoryHistory: [], draftRecaps: [] }),
    }),
    { name: 'league-history-store-v1' }
  )
);
