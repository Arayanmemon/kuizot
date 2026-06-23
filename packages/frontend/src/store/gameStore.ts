import { create } from 'zustand';
import { Socket } from 'socket.io-client';

export type GameRole = 'host' | 'player' | null;
export type GamePhase = 'lobby' | 'question' | 'leaderboard';

export interface LeaderboardEntry {
  userId: string;
  score: number;
}

export interface AnswerOption {
  id: string;
  text: string;
  color: string;
}

export interface QuestionData {
  id: string;
  text: string;
  options: AnswerOption[];
  timeLimit: number;
  scoringMode: 'classic' | 'accuracy';
  maxPoints: number;
}

interface GameState {
  // Socket Connection
  socket: Socket | null;
  isConnected: boolean;
  setSocket: (socket: Socket | null) => void;
  setConnected: (connected: boolean) => void;

  // Session Data
  pin: string;
  role: GameRole;
  userId: string; // generated client-side for now
  nickname: string;
  setSessionData: (pin: string, role: GameRole, userId: string, nickname?: string) => void;

  // Game State
  phase: GamePhase;
  setPhase: (phase: GamePhase) => void;

  // Live Data
  players: { userId: string; nickname: string }[];
  setPlayers: (players: { userId: string; nickname: string }[]) => void;
  addPlayer: (player: { userId: string; nickname: string }) => void;
  removePlayer: (player: { userId: string; nickname: string }) => void;
  
  currentQuestion: QuestionData | null;
  setCurrentQuestion: (question: QuestionData | null) => void;
  
  leaderboard: LeaderboardEntry[];
  setLeaderboard: (leaderboard: LeaderboardEntry[]) => void;
  
  score: number;
  setScore: (score: number) => void;
  
  // Answer tracking
  hasAnswered: boolean;
  setHasAnswered: (hasAnswered: boolean) => void;
  lastAnswerCorrect: boolean | null;
  setLastAnswerCorrect: (correct: boolean | null) => void;
  
  resetStore: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  socket: null,
  isConnected: false,
  setSocket: (socket) => set({ socket }),
  setConnected: (isConnected) => set({ isConnected }),

  pin: '',
  role: null,
  userId: '',
  nickname: '',
  setSessionData: (pin, role, userId, nickname = '') => set({ pin, role, userId, nickname }),

  phase: 'lobby',
  setPhase: (phase) => set({ phase }),

  players: [],
  setPlayers: (players) => set({ players }),
  addPlayer: (player) => set((state) => ({ 
    players: [...state.players, player] 
  })),
  removePlayer: (player) => set((state) => ({ 
    players: state.players.filter((p) => p.userId !== player.userId) 
  })),

  currentQuestion: null,
  setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),

  leaderboard: [],
  setLeaderboard: (leaderboard) => set({ leaderboard }),

  score: 0,
  setScore: (score) => set({ score }),
  
  hasAnswered: false,
  setHasAnswered: (hasAnswered) => set({ hasAnswered }),
  lastAnswerCorrect: null,
  setLastAnswerCorrect: (lastAnswerCorrect) => set({ lastAnswerCorrect }),

  resetStore: () => set({
    pin: '',
    role: null,
    phase: 'lobby',
    players: [],
    currentQuestion: null,
    leaderboard: [],
    score: 0,
    isConnected: false,
    hasAnswered: false,
    lastAnswerCorrect: null,
  }),
}));
