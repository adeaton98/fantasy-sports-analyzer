'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Player, BaseballLeagueSettings, DraftPick, BaseballCategory, DataMode } from '@/types';
import { DEFAULT_BASEBALL_SETTINGS, BASEBALL_CATEGORIES } from '@/utils/constants';
import { mergePastAndProjections } from '@/utils/fileParser';

interface BaseballStore {
  // Position overrides (user-defined position for a player)
  positionOverrides: Record<string, string>;
  setPositionOverride: (playerId: string, pos: string) => void;
  clearPositionOverride: (playerId: string) => void;
  // Data
  players: Player[];           // derived: active players based on dataMode
  pastPlayers: Player[];       // uploaded historical stats
  projectionPlayers: Player[]; // uploaded future projections
  dataMode: DataMode;
  setPlayers: (players: Player[]) => void;
  setPastPlayers: (players: Player[]) => void;
  setProjectionPlayers: (players: Player[]) => void;
  setDataMode: (mode: DataMode) => void;
  clearPlayers: () => void;
  clearPastPlayers: () => void;
  clearProjectionPlayers: () => void;

  // Settings
  leagueSettings: BaseballLeagueSettings;
  updateLeagueSettings: (settings: Partial<BaseballLeagueSettings>) => void;
  completeSetup: () => void;
  resetSetup: () => void;

  // Analysis
  selectedCategories: BaseballCategory[];
  toggleCategory: (cat: BaseballCategory) => void;
  setSelectedCategories: (cats: BaseballCategory[]) => void;
  positionFilter: string;
  setPositionFilter: (pos: string) => void;
  categoryWeights: Record<BaseballCategory, number>;
  setCategoryWeight: (cat: BaseballCategory, weight: number) => void;
  resetWeights: () => void;

  // Market scales (auction)
  inflationScale: number;
  deflationScale: number;
  setInflationScale: (v: number) => void;
  setDeflationScale: (v: number) => void;

  // Punt categories (draft mode)
  puntCategories: BaseballCategory[];
  togglePuntCategory: (cat: BaseballCategory) => void;
  clearPuntCategories: () => void;

  // Draft — My Team
  myTeam: DraftPick[];
  draftPlayer: (player: Player, price: number) => void;
  undoLastPick: () => void;
  resetDraft: () => void;
  remainingBudget: number;

  // Saved draft snapshots
  savedDraft: DraftPick[];
  saveDraft: () => void;
  savedAllTeams: Record<string, DraftPick[]>;
  saveAllTeams: () => void;

  // Draft — Track Draft (all teams)
  allTeams: Record<string, DraftPick[]>;
  setTeamPick: (teamName: string, pick: DraftPick) => void;
  removeTeamPick: (teamName: string, playerId: string) => void;
  teamNames: string[];
  setTeamNames: (names: string[]) => void;
  teamBudgetAdjustments: Record<string, number>;
  setTeamBudgetAdjustment: (teamName: string, adjustment: number) => void;
  playerValueOverrides: Record<string, number>;
  setPlayerValueOverride: (playerId: string, value: number) => void;
  clearPlayerValueOverride: (playerId: string) => void;

  // Watchlist / flagged players
  flaggedPlayerIds: string[];
  flagPlayer: (id: string) => void;
  unflagPlayer: (id: string) => void;
  clearFlags: () => void;

  // Player type filter
  playerTypeFilter: 'all' | 'pitchers' | 'batters';
  setPlayerTypeFilter: (f: 'all' | 'pitchers' | 'batters') => void;

  // Team rankings
  teamRankings: string[];       // ordered abbrs: index 0 = best team
  setTeamRankings: (teams: string[]) => void;
  teamRankWeight: number;       // 1.0 to 2.0, only increases
  setTeamRankWeight: (v: number) => void;
  teamRankEnabled: boolean;
  setTeamRankEnabled: (v: boolean) => void;
}

const defaultWeights = Object.fromEntries(
  BASEBALL_CATEGORIES.map((c) => [c, 1])
) as Record<BaseballCategory, number>;

function computeActivePlayers(past: Player[], projections: Player[], mode: DataMode): Player[] {
  if (mode === 'past') return past;
  if (mode === 'projections') return projections;
  return mergePastAndProjections(past, projections);
}

export const useBaseballStore = create<BaseballStore>()(
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
        set({
          pastPlayers: [],
          players: computeActivePlayers([], projectionPlayers, dataMode),
        });
      },
      clearProjectionPlayers: () => {
        const { pastPlayers, dataMode } = get();
        set({
          projectionPlayers: [],
          players: computeActivePlayers(pastPlayers, [], dataMode),
        });
      },

      leagueSettings: { ...DEFAULT_BASEBALL_SETTINGS },
      updateLeagueSettings: (settings) =>
        set((s) => ({ leagueSettings: { ...s.leagueSettings, ...settings } })),
      completeSetup: () =>
        set((s) => ({ leagueSettings: { ...s.leagueSettings, setupComplete: true } })),
      resetSetup: () =>
        set({ leagueSettings: { ...DEFAULT_BASEBALL_SETTINGS } }),

      selectedCategories: [...BASEBALL_CATEGORIES],
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

      inflationScale: 1,
      deflationScale: 1,
      setInflationScale: (v) => set({ inflationScale: v }),
      setDeflationScale: (v) => set({ deflationScale: v }),

      puntCategories: [],
      togglePuntCategory: (cat) =>
        set((s) => ({
          puntCategories: s.puntCategories.includes(cat)
            ? s.puntCategories.filter((c) => c !== cat)
            : [...s.puntCategories, cat],
        })),
      clearPuntCategories: () => set({ puntCategories: [] }),

      savedDraft: [],
      saveDraft: () => set((s) => ({ savedDraft: [...s.myTeam] })),
      savedAllTeams: {},
      saveAllTeams: () => set((s) => ({ savedAllTeams: { ...s.allTeams } })),

      myTeam: [],
      remainingBudget: DEFAULT_BASEBALL_SETTINGS.budget,
      draftPlayer: (player, price) =>
        set((s) => ({
          myTeam: [...s.myTeam, { player, price }],
          remainingBudget: s.remainingBudget - price,
        })),
      undoLastPick: () =>
        set((s) => {
          if (s.myTeam.length === 0) return s;
          const last = s.myTeam[s.myTeam.length - 1];
          return {
            myTeam: s.myTeam.slice(0, -1),
            remainingBudget: s.remainingBudget + (last.price ?? 0),
          };
        }),
      resetDraft: () =>
        set((s) => ({
          myTeam: [],
          remainingBudget: s.leagueSettings.budget,
          allTeams: {},
        })),

      allTeams: {},
      setTeamPick: (teamName, pick) =>
        set((s) => ({
          allTeams: {
            ...s.allTeams,
            [teamName]: [...(s.allTeams[teamName] ?? []), pick],
          },
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

      teamBudgetAdjustments: {},
      setTeamBudgetAdjustment: (teamName, adjustment) =>
        set((s) => ({
          teamBudgetAdjustments: { ...s.teamBudgetAdjustments, [teamName]: adjustment },
        })),

      playerValueOverrides: {},
      setPlayerValueOverride: (playerId, value) =>
        set((s) => ({
          playerValueOverrides: { ...s.playerValueOverrides, [playerId]: value },
        })),
      clearPlayerValueOverride: (playerId) =>
        set((s) => {
          const next = { ...s.playerValueOverrides };
          delete next[playerId];
          return { playerValueOverrides: next };
        }),

      positionOverrides: {},
      setPositionOverride: (playerId, pos) =>
        set((s) => ({ positionOverrides: { ...s.positionOverrides, [playerId]: pos } })),
      clearPositionOverride: (playerId) =>
        set((s) => {
          const next = { ...s.positionOverrides };
          delete next[playerId];
          return { positionOverrides: next };
        }),

      flaggedPlayerIds: [],
      flagPlayer: (id) => set((s) => ({
        flaggedPlayerIds: s.flaggedPlayerIds.includes(id)
          ? s.flaggedPlayerIds
          : [...s.flaggedPlayerIds, id],
      })),
      unflagPlayer: (id) => set((s) => ({
        flaggedPlayerIds: s.flaggedPlayerIds.filter((x) => x !== id),
      })),
      clearFlags: () => set({ flaggedPlayerIds: [] }),

      playerTypeFilter: 'all',
      setPlayerTypeFilter: (f) => set({ playerTypeFilter: f }),
      teamRankings: [],
      setTeamRankings: (teams) => set({ teamRankings: teams }),
      teamRankWeight: 1,
      setTeamRankWeight: (v) => set({ teamRankWeight: v }),
      teamRankEnabled: false,
      setTeamRankEnabled: (v) => set({ teamRankEnabled: v }),
    }),
    {
      name: 'baseball-store-v6',
      partialize: (s) => ({
        players: s.players,
        pastPlayers: s.pastPlayers,
        projectionPlayers: s.projectionPlayers,
        dataMode: s.dataMode,
        leagueSettings: s.leagueSettings,
        selectedCategories: s.selectedCategories,
        categoryWeights: s.categoryWeights,
        inflationScale: s.inflationScale,
        deflationScale: s.deflationScale,
        puntCategories: s.puntCategories,
        myTeam: s.myTeam,
        remainingBudget: s.remainingBudget,
        savedDraft: s.savedDraft,
        savedAllTeams: s.savedAllTeams,
        allTeams: s.allTeams,
        teamNames: s.teamNames,
        teamBudgetAdjustments: s.teamBudgetAdjustments,
        playerValueOverrides: s.playerValueOverrides,
        positionOverrides: s.positionOverrides,
        flaggedPlayerIds: s.flaggedPlayerIds,
        playerTypeFilter: s.playerTypeFilter,
        teamRankings: s.teamRankings,
        teamRankWeight: s.teamRankWeight,
        teamRankEnabled: s.teamRankEnabled,
      }),
    }
  )
);
