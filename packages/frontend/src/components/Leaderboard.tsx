import { motion } from 'framer-motion';
import type { LeaderboardEntry } from '../store/gameStore';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  onBackToLobby?: () => void;
}

// Medals indexed by rank (0 = 1st place, 1 = 2nd place, 2 = 3rd place)
const MEDALS = ['🥇', '🥈', '🥉'];

// Podium column heights indexed by rank (0=1st, 1=2nd, 2=3rd)
const PODIUM_HEIGHTS = ['h-40', 'h-28', 'h-20'];

// Display order: 2nd (index 1) → 1st (index 0) → 3rd (index 2)
const PODIUM_DISPLAY_ORDER = [1, 0, 2];

// Card reveal stagger order per design doc: REVEAL_ORDER[rankIndex] * 150ms
// indices: 0=1st place, 1=2nd place, 2=3rd place
// REVEAL_ORDER[0]=1 → 1st place: 150ms delay
// REVEAL_ORDER[1]=2 → 2nd place: 300ms delay (last visible, but winner revealed last via higher absolute delay)
// REVEAL_ORDER[2]=0 → 3rd place: 0ms delay (first)
// Effective reveal order: 3rd(0ms) → 1st(150ms) → 2nd(300ms)
const REVEAL_ORDER = [1, 2, 0];

const podiumVariants = (reduced: boolean) => ({
  hidden: reduced ? {} : { scaleY: 0 },
  visible: (i: number) => ({
    scaleY: 1,
    transition: reduced
      ? { duration: 0 }
      : { duration: 0.6, delay: i * 0.15, ease: 'easeOut' as const },
  }),
});

const cardVariants = (reduced: boolean) => ({
  hidden: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 },
  visible: (delayIndex: number) => ({
    opacity: 1,
    y: 0,
    transition: reduced
      ? { duration: 0 }
      : { duration: 0.4, delay: 0.5 + delayIndex * 0.15, ease: 'easeOut' as const },
  }),
});

export function Leaderboard({ entries, currentUserId, onBackToLobby }: LeaderboardProps) {
  const reduced = useReducedMotion();

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const pVariants = podiumVariants(reduced);
  const cVariants = cardVariants(reduced);

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl mx-auto px-4 py-8">
      {/* Title */}
      <h2 className="text-4xl font-black text-white tracking-tight">Leaderboard</h2>

      {/* Empty state */}
      {entries.length === 0 && (
        <p className="text-white/70 text-xl">No scores yet</p>
      )}

      {/* Podium */}
      {entries.length > 0 && (
        <div className="flex items-end justify-center gap-4 w-full">
          {PODIUM_DISPLAY_ORDER.map((rankIndex) => {
            const entry = top3[rankIndex];
            if (!entry) return null;

            const rank = rankIndex + 1; // 1-based rank
            const medal = MEDALS[rankIndex];
            const height = PODIUM_HEIGHTS[rankIndex];
            // Stagger index for podium rise: left-to-right display order (0, 1, 2)
            const podiumStaggerIndex = PODIUM_DISPLAY_ORDER.indexOf(rankIndex);
            // Card reveal delay: REVEAL_ORDER[rankIndex] * 150ms (from design doc)
            const cardDelayIndex = REVEAL_ORDER[rankIndex];

            return (
              <div key={entry.userId} className="flex flex-col items-center gap-2">
                {/* Player card above column */}
                <motion.div
                  variants={cVariants}
                  initial="hidden"
                  animate="visible"
                  custom={cardDelayIndex}
                  className="flex flex-col items-center gap-1"
                >
                  <span className="text-3xl" role="img" aria-label={`Rank ${rank} medal`}>
                    {medal}
                  </span>
                  <span className="text-white font-bold text-sm text-center max-w-[80px] truncate">
                    {entry.userId}
                  </span>
                  <span className="bg-white/20 text-white font-bold rounded-full px-3 py-1 text-xs">
                    {entry.score}
                  </span>
                </motion.div>

                {/* Podium column */}
                <motion.div
                  variants={pVariants}
                  initial="hidden"
                  animate="visible"
                  custom={podiumStaggerIndex}
                  style={{ originY: 1 }}
                  className={`${height} w-20 rounded-t-xl flex items-end justify-center pb-2 ${
                    rankIndex === 0
                      ? 'bg-yellow-400'
                      : rankIndex === 1
                        ? 'bg-gray-300'
                        : 'bg-amber-600'
                  }`}
                >
                  <span className="text-white font-black text-lg">{rank}</span>
                </motion.div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ranked list for rank 4+ */}
      {rest.length > 0 && (
        <ol className="w-full flex flex-col gap-2 max-h-64 overflow-y-auto">
          {rest.map((entry, idx) => {
            const rank = idx + 4;
            const isCurrentUser = currentUserId !== undefined && entry.userId === currentUserId;
            return (
              <li
                key={entry.userId}
                className={`flex items-center justify-between bg-white/10 rounded-xl px-4 py-3 text-white ${
                  isCurrentUser ? 'ring-2 ring-white' : ''
                }`}
              >
                <span className="font-bold text-white/60 w-8">{rank}</span>
                <span className="flex-1 font-semibold truncate px-2">{entry.userId}</span>
                <span className="bg-white/20 font-bold rounded-full px-3 py-1 text-sm">
                  {entry.score}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Back to Lobby button */}
      {onBackToLobby && (
        <button
          onClick={onBackToLobby}
          className="bg-white text-purple-700 font-black text-lg rounded-2xl shadow-xl px-10 py-4 hover:bg-white/90 transition-colors"
        >
          Back to Lobby
        </button>
      )}
    </div>
  );
}
