'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User { firstName: string; lastName: string; }
interface UserStore {
  user: User | null;
  setUser: (u: User) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: { firstName: 'Alex', lastName: 'Deaton' }, // default so existing data is preserved
      setUser: (u) => set({ user: u }),
      clearUser: () => set({ user: null }),
    }),
    { name: 'fantex-user' }
  )
);
