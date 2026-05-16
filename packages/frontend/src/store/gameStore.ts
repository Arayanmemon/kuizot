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
}

interface GameState {
  // Socket Connection
  socket: Socket | null;
  setSocket: (socket: Socket | null) => void;

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
  
  currentQuestion: QuestionData | null;
  setCurrentQuestion: (question: QuestionData | null) => void;
  
  leaderboard: LeaderboardEntry[];
  setLeaderboard: (leaderboard: LeaderboardEntry[]) => void;
  
  score: number;
  setScore: (score: number) => void;
  
  resetStore: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  socket: null,
  setSocket: (socket) => set({ socket }),

  pin: '',
  role: null,
  userId: '',
  nickname: '',
  setSessionData: (pin, role, userId, nickname = '') => set({ pin, role, userId, nickname }),

  phase: 'lobby',
  setPhase: (phase) => set({ phase }),

  players: [],
  setPlayers: (players) => set({ players }),

  currentQuestion: null,
  setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),

  leaderboard: [],
  setLeaderboard: (leaderboard) => set({ leaderboard }),

  score: 0,
  setScore: (score) => set({ score }),

  resetStore: () => set({
    pin: '',
    role: null,
    phase: 'lobby',
    players: [],
    currentQuestion: null,
    leaderboard: [],
    score: 0,
  }),
}));
