'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Player, BasketballLeagueSettings, DraftPick, BasketballCategory, DataMode } from '@/types';
import { DEFAULT_BASKETBALL_SETTINGS, BASKETBALL_CATEGORIES } from '@/utils/constants';
import { mergePastAndProjections } from '@/utils/fileParser';

interface BasketballStore {
  players: Player[];           // derived: active players based on dataMode
  pastPlayers: Player[];
  projectionPlayers: Player[];
  dataMode: DataMode;
  setPlayers: (players: Player[]) => void;
  setPastPlayers: (players: Player[]) => void;
  setProjectionPlayers: (players: Player[]) => void;
  setDataMode: (mode: DataMode) => void;
  clearPlayers: () => void;
  clearPastPlayers: () => void;
  clearProjectionPlayers: () => void;

  leagueSettings: BasketballLeagueSettings;
  updateLeagueSettings: (settings: Partial<BasketballLeagueSettings>) => void;
  completeSetup: () => void;
  resetSetup: () => void;

  selectedCategories: BasketballCategory[];
  toggleCategory: (cat: BasketballCategory) => void;
  setSelectedCategories: (cats: BasketballCategory[]) => void;
  positionFilter: string;
  setPositionFilter: (pos: string) => void;
  categoryWeights: Record<BasketballCategory, number>;
  setCategoryWeight: (cat: BasketballCategory, weight: number) => void;
  resetWeights: () => void;

  myTeam: DraftPick[];
  draftPlayer: (player: Player, pickNumber?: number) => void;
  undoLastPick: () => void;
  resetDraft: () => void;
  currentPick: number;

  allTeams: Record<string, DraftPick[]>;
  setTeamPick: (teamName: string, pick: DraftPick) => void;
  removeTeamPick: (teamName: string, playerId: string) => void;
  teamNames: string[];
  setTeamNames: (names: string[]) => void;
}

const defaultWeights = Object.fromEntries(
  BASKETBALL_CATEGORIES.map((c) => [c, 1])
) as Record<BasketballCategory, number>;

function computeActivePlayers(past: Player[], projections: Player[], mode: DataMode): Player[] {
  if (mode === 'past') return past;
  if (mode === 'projections') return projections;
  return mergePastAndProjections(past, projections);
}

export const useBasketballStore = create<BasketballStore>()(
  persist(
    (set, get) => ({
      players: [],
      pastPlayers: [],
      projectionPlayers: [],
      dataMode: 'both' as DataMode,

      setPlayers: (players) => set({ players }),

      setPastPlayers: (players) => {
        const { projectionPlayers, dataMode } = get();
        set({
          pastPlayers: players,
          players: computeActivePlayers(players, projectionPlayers, dataMode),
        });
      },

      setProjectionPlayers: (players) => {
        const { pastPlayers, dataMode } = get();
        set({
          projectionPlayers: players,
          players: computeActivePlayers(pastPlayers, players, dataMode),
        });
      },

      setDataMode: (mode) => {
        const { pastPlayers, projectionPlayers } = get();
        set({
          dataMode: mode,
          players: computeActivePlayers(pastPlayers, projectionPlayers, mode),
        });
      },

      clearPlayers: () => set({ players: [], pastPlayers: [], projectionPlayers: [] }),
      clearPastPlayers: () => {
        const { projectionPlayers, dataMode } = get();
        set({ pastPlayers: [], players: computeActivePlayers([], projectionPlayers, dataMode) });
      },
      clearProjectionPlayers: () => {
        const { pastPlayers, dataMode } = get();
        set({ projectionPlayers: [], players: computeActivePlayers(pastPlayers, [], dataMode) });
      },

      leagueSettings: { ...DEFAULT_BASKETBALL_SETTINGS },
      updateLeagueSettings: (settings) =>
        set((s) => ({ leagueSettings: { ...s.leagueSettings, ...settings } })),
      completeSetup: () =>
        set((s) => ({ leagueSettings: { ...s.leagueSettings, setupComplete: true } })),
      resetSetup: () => set({ leagueSettings: { ...DEFAULT_BASKETBALL_SETTINGS } }),

      selectedCategories: [...BASKETBALL_CATEGORIES],
      toggleCategory: (cat) =>
        set((s) => ({
          selectedCategories: s.selectedCategories.includes(cat)
            ? s.selectedCategories.filter((c) => c !== cat)
            : [...s.selectedCategories, cat],
        })),
      setSelectedCategories: (cats) => set({ selectedCategories: cats }),

      positionFilter: 'ALL',
      setPositionFilter: (pos) => set({ positionFilter: pos }),

      categoryWeights: { ...defaultWeights },
      setCategoryWeight: (cat, weight) =>
        set((s) => ({ categoryWeights: { ...s.categoryWeights, [cat]: weight } })),
      resetWeights: () => set({ categoryWeights: { ...defaultWeights } }),

      myTeam: [],
      currentPick: 0,
      draftPlayer: (player, pickNumber) =>
        set((s) => ({
          myTeam: [...s.myTeam, { player, pickNumber: pickNumber ?? s.currentPick }],
          currentPick: s.currentPick + 1,
        })),
      undoLastPick: () =>
        set((s) => {
          if (s.myTeam.length === 0) return s;
          return { myTeam: s.myTeam.slice(0, -1), currentPick: Math.max(0, s.currentPick - 1) };
        }),
      resetDraft: () => set({ myTeam: [], currentPick: 0, allTeams: {} }),

      allTeams: {},
      setTeamPick: (teamName, pick) =>
        set((s) => ({
          allTeams: { ...s.allTeams, [teamName]: [...(s.allTeams[teamName] ?? []), pick] },
        })),
      removeTeamPick: (teamName, playerId) =>
        set((s) => ({
          allTeams: {
            ...s.allTeams,
            [teamName]: (s.allTeams[teamName] ?? []).filter((p) => p.player.id !== playerId),
          },
        })),
      teamNames: [],
      setTeamNames: (names) => set({ teamNames: names }),
    }),
    {
      name: 'basketball-store-v2',
      partialize: (s) => ({
        players: s.players,
        pastPlayers: s.pastPlayers,
        projectionPlayers: s.projectionPlayers,
        dataMode: s.dataMode,
        leagueSettings: s.leagueSettings,
        selectedCategories: s.selectedCategories,
        categoryWeights: s.categoryWeights,
        myTeam: s.myTeam,
        currentPick: s.currentPick,
        allTeams: s.allTeams,
        teamNames: s.teamNames,
      }),
    }
  )
);
