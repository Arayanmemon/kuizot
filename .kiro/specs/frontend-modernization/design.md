# Design Document — Frontend Modernization

## Overview

This document describes the architecture and implementation plan for modernizing the Kuizot frontend. The goal is to transform the existing functional-but-plain UI into a vibrant, Kahoot-inspired experience using Tailwind CSS v4 CSS-first utilities, framer-motion animations, and a shared Leaderboard/Podium component consumed by both `PlayerView` and `HostDashboard`.

The stack remains unchanged: React 19 + Vite + Tailwind CSS v4 (`@tailwindcss/vite`) + Zustand + socket.io-client. `framer-motion` is added as the sole new production dependency.

---

## Architecture

### High-Level Component Tree

```
App.tsx
├── JoinPage          (route: /)
├── PlayerView        (route: /player)
│   ├── LobbyWaiting          (phase === 'lobby')
│   ├── AnswerGrid            (phase === 'question')
│   │   └── AnswerFeedbackOverlay   (AnimatePresence, shown after answer_result)
│   └── Leaderboard           (phase === 'leaderboard', player variant)
└── HostDashboard     (route: /host)
    ├── SetupScreen           (no PIN)
    ├── LobbyPanel            (phase === 'lobby')
    ├── QuestionPanel         (phase === 'question')
    └── Leaderboard           (phase === 'leaderboard', host variant)
```

### New Files

| Path | Purpose |
|---|---|
| `packages/frontend/frontend-plan.md` | Pre-code planning document |
| `src/components/Leaderboard.tsx` | Shared podium + ranked list component |
| `src/components/AnswerFeedbackOverlay.tsx` | Animated correct/wrong overlay |
| `src/hooks/useReducedMotion.ts` | `prefers-reduced-motion` hook |

### Modified Files

| Path | Change |
|---|---|
| `packages/frontend/package.json` | Add `framer-motion ^12.0.0` |
| `src/index.css` | Add gradient CSS custom properties; remove body bg |
| `src/App.tsx` | Apply gradient wrapper, import new components |
| `src/pages/JoinPage.tsx` | Full visual redesign |
| `src/pages/PlayerView.tsx` | Add AnswerFeedbackOverlay, header bar, Leaderboard |
| `src/pages/HostDashboard.tsx` | Visual redesign, use Leaderboard component |

---

## Components and Interfaces

### `useReducedMotion` Hook

```typescript
// src/hooks/useReducedMotion.ts
import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}
```

This hook is the single source of truth for motion preferences. Every animated component calls `useReducedMotion()` and conditionally passes `{ duration: 0 }` transitions or collapses `initial`/`animate` to the same value.

---

### `AnswerFeedbackOverlay` Component

Rendered inside `PlayerView` using `AnimatePresence`. Mounts when `hasAnswered` becomes `true` and `lastAnswerCorrect` is not null. Auto-dismisses after 1500 ms via `setTimeout` + state reset.

```typescript
// src/components/AnswerFeedbackOverlay.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Props {
  visible: boolean;
  isCorrect: boolean | null;
}

export const AnswerFeedbackOverlay = ({ visible, isCorrect }: Props) => {
  const reduced = useReducedMotion();

  const variants = reduced
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, scale: 0.5 },
        visible: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 1.2 },
      };

  const shakeVariants = reduced
    ? { shake: {} }
    : {
        shake: {
          x: [0, -12, 12, -8, 8, -4, 4, 0],
          transition: { duration: 0.5 },
        },
      };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="feedback"
          className="absolute inset-0 flex items-center justify-center z-50
                     backdrop-blur-sm rounded-xl"
          style={{
            backgroundColor: isCorrect
              ? 'rgba(22, 163, 74, 0.85)'
              : 'rgba(220, 38, 38, 0.85)',
          }}
          variants={variants}
          initial="hidden"
          animate={isCorrect ? 'visible' : ['visible', 'shake']}
          exit="exit"
          transition={reduced ? { duration: 0 } : { duration: 0.35, ease: 'backOut' }}
        >
          {isCorrect ? (
            <span className="text-8xl select-none">✓</span>
          ) : (
            <motion.span
              className="text-8xl select-none"
              variants={shakeVariants}
              animate="shake"
            >
              ✗
            </motion.span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

**Timing contract**: The overlay is shown for exactly 1 500 ms (driven by a `useEffect` in `PlayerView` that clears the display state after `setTimeout(dismiss, 1500)`). framer-motion exit animation is ≤ 300 ms, keeping the total well under budget.

---

### `Leaderboard` Component

Shared between `PlayerView` (player variant: shows personal rank + podium read-only) and `HostDashboard` (host variant: shows podium + "Back to Lobby" button).

```typescript
// src/components/Leaderboard.tsx
interface LeaderboardProps {
  entries: LeaderboardEntry[];   // full sorted array from Zustand
  currentUserId?: string;        // highlights the viewer's row (PlayerView only)
  onBackToLobby?: () => void;    // host only
}
```

#### Podium Layout

The podium renders the top 3 entries in the **2nd → 1st → 3rd** left-to-right display order to create the classic podium silhouette. The column heights are controlled by Tailwind height utilities:

| Rank | Display position | Column height |
|------|-----------------|---------------|
| 1st  | Center          | `h-40` (tallest) |
| 2nd  | Left            | `h-28` (medium) |
| 3rd  | Right           | `h-20` (shortest) |

Each podium column contains: medal emoji, nickname/userId, score.

#### Rising Podium Animation

```typescript
const podiumVariants = (reduced: boolean) => ({
  hidden: reduced ? {} : { scaleY: 0, originY: 1 },
  visible: (i: number) => ({
    scaleY: 1,
    transition: reduced
      ? { duration: 0 }
      : { duration: 0.6, delay: i * 0.15, ease: 'easeOut' },
  }),
});
```

Custom index (`i`) is passed via framer-motion's `custom` prop so each column has a staggered delay.

#### Staggered Player Card Entrance

Cards enter in the order **2nd → 3rd → 1st** (index-mapped to delays 0 ms, 150 ms, 450 ms) so the winner is revealed last.

```typescript
const REVEAL_ORDER = [1, 2, 0]; // indices into top3 array (0=1st,1=2nd,2=3rd)
// delay = REVEAL_ORDER[rank-1] * 150ms
```

#### Ranked List (rank 4+)

A scrollable `<ol>` rendered below the podium. Each row shows rank number, userId (until nickname tracking is added), and score. The current player's row is highlighted with a ring if `currentUserId` matches.

---

## Data Flow

### `PlayerView` — Answer Feedback Lifecycle

```
user clicks answer button
  → handleAnswerClick() emits 'submit_answer'
  → hasAnswered set to true (disables all buttons)
  → overlay timer starts in useEffect watching [hasAnswered]

backend fires 'answer_result'
  → App.tsx handler calls setLastAnswerCorrect(isCorrect)
  → AnswerFeedbackOverlay becomes visible

setTimeout(1500ms) fires
  → local showFeedback state cleared
  → overlay AnimatePresence exit animation plays (≤ 300 ms)
```

### `HostDashboard` — Leaderboard Phase

```
backend fires 'leaderboard_update'
  → App.tsx handler calls setLeaderboard(data.leaderboard) + setPhase('leaderboard')
  → HostDashboard renders <Leaderboard entries={leaderboard} onBackToLobby={...} />
  → Podium rising animations trigger on mount
```

---

## Styling System

### Tailwind CSS v4 CSS-First

No `tailwind.config.js`. Custom gradient tokens are declared in `src/index.css` using `@theme`:

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --color-brand-gradient-from: #ec4899;   /* pink-500  */
  --color-brand-gradient-via:  #9333ea;   /* purple-600 */
  --color-brand-gradient-to:   #4338ca;   /* indigo-700 */
}

/* Shared gradient utility applied to all page roots */
.gradient-bg {
  background: linear-gradient(
    135deg,
    var(--color-brand-gradient-from),
    var(--color-brand-gradient-via),
    var(--color-brand-gradient-to)
  );
}
```

All three page roots (`JoinPage`, `PlayerView`, `HostDashboard`) apply `className="gradient-bg min-h-screen ..."`.

### Card / Panel Pattern

White semi-transparent cards using `bg-white/10 backdrop-blur-sm rounded-2xl shadow-xl` for overlays on gradient backgrounds, and `bg-white rounded-2xl shadow-xl` for opaque input forms.

### Typography

- Headings: `font-black tracking-tight text-white`
- Body on gradient: `text-white/90`
- Score badges: `bg-white/20 text-white font-bold rounded-full px-3 py-1`

---

## Accessibility

### `prefers-reduced-motion` Strategy

Every component that uses framer-motion:
1. Calls `useReducedMotion()`.
2. If `reduced === true`: passes `transition={{ duration: 0 }}` and sets `initial` equal to `animate` so no visual movement occurs.
3. The final visual state (correct position, full opacity) is always reached regardless of motion preference.

### Lobby Pulse Exception

The waiting-state pulse animation in `PlayerView` (phase `lobby`) uses a CSS `animate-pulse` class with a Tailwind media query override:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-pulse { animation: none; }
}
```

Tailwind v4 includes this override by default via its preflight reset.

### Contrast

All white text on the gradient background meets WCAG AA (4.5:1) — the gradient uses saturated dark-leaning midpoints (purple-600 = `#9333ea`, indigo-700 = `#4338ca`). Input form cards use dark text (`text-gray-900`) on white backgrounds.

---

## Data Models

No new persistent data models are introduced. The feature consumes existing Zustand store types and extends them with one local UI state value.

### Existing Types (unchanged)

```typescript
// From src/store/gameStore.ts

export interface LeaderboardEntry {
  userId: string;   // displayed as nickname until server sends nickname
  score: number;
}

export interface AnswerOption {
  id: string;
  text: string;
  color: string;    // CSS hex color for button background
}

export interface QuestionData {
  id: string;
  text: string;
  options: AnswerOption[];
  timeLimit: number;         // milliseconds
  scoringMode: 'classic' | 'accuracy';
  maxPoints: number;
}

export type GamePhase = 'lobby' | 'question' | 'leaderboard';
```

### New Local UI State (component-level, not in Zustand)

```typescript
// PlayerView.tsx — local state only
interface PlayerViewLocalState {
  showFeedback: boolean;      // drives AnswerFeedbackOverlay visibility
  questionStartTime: number;  // timestamp for scoring timeTakenMs
}
```

### `LeaderboardProps` Interface

```typescript
// src/components/Leaderboard.tsx
interface LeaderboardProps {
  entries: LeaderboardEntry[];  // full sorted array from Zustand store
  currentUserId?: string;       // highlights current player's row (PlayerView only)
  onBackToLobby?: () => void;   // renders "Back to Lobby" button (HostDashboard only)
}
```

### `AnswerFeedbackOverlayProps` Interface

```typescript
// src/components/AnswerFeedbackOverlay.tsx
interface AnswerFeedbackOverlayProps {
  visible: boolean;          // whether overlay is shown (drives AnimatePresence)
  isCorrect: boolean | null; // null means no result yet; not rendered
}
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Socket not connected | Submit buttons disabled; "Connecting..." label shown |
| `join_error` event | Error message displayed below form in `text-red-300` |
| Leaderboard has 0 entries | Podium not rendered; "No scores yet" message shown |
| Leaderboard has 1–2 entries | Only available podium columns rendered; no empty slots |
| `currentQuestion` is null in question phase | Answer grid shows empty state; no crash |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Kuizot branding is present on every page

*For any* rendered page component (JoinPage, PlayerView, HostDashboard), the output should contain the Kuizot application name or logo element.

**Validates: Requirements 3.5**

---

### Property 2: Error messages are always surfaced in the join form

*For any* error message string emitted via the `join_error` socket event, the JoinPage should render that exact string visibly below the input form.

**Validates: Requirements 4.5**

---

### Property 3: Header bar reflects any nickname and score

*For any* nickname string and any non-negative integer score, the PlayerView header should render both values in a visually distinct header region.

**Validates: Requirements 5.2**

---

### Property 4: Answer grid renders all options and disables on selection

*For any* valid question with 4 answer options, the PlayerView question phase should render exactly 4 answer buttons in a 2×2 grid. Furthermore, for any option index clicked, all 4 buttons should become disabled immediately after the click.

**Validates: Requirements 5.4, 5.5**

---

### Property 5: Player leaderboard card shows rank and score

*For any* leaderboard array and any `currentUserId`, the PlayerView leaderboard phase should display the player's rank (1-based position in the sorted array) and total score in a styled card.

**Validates: Requirements 5.10**

---

### Property 6: Host lobby renders all joined players and correct count

*For any* list of players and any valid 6-digit PIN, the HostDashboard lobby phase should render every player's nickname as a badge chip and display a live count equal to the length of the player list.

**Validates: Requirements 6.3, 6.4**

---

### Property 7: Host question panel shows question and answer count

*For any* valid question object and any answer count between 0 and the total player count, the HostDashboard question phase should render the question text prominently and display the answer count indicator showing both submitted and total counts.

**Validates: Requirements 6.5, 6.6**

---

### Property 8: Podium ranks top entries with correct medal assignment

*For any* leaderboard array with n entries (1 ≤ n ≤ 3), the Podium Screen should render exactly n podium columns, assign 🥇 to rank 1, 🥈 to rank 2 (if present), and 🥉 to rank 3 (if present), and display each player's score beneath their name. No empty podium slots should be rendered for missing entries.

**Validates: Requirements 7.2, 7.3, 7.4, 7.8**

---

### Property 9: Ranked list below podium contains all players from rank 4 onward

*For any* leaderboard array with n entries where n > 3, the ranked list below the podium should contain exactly n − 3 entries, each displaying a rank number, identifier, and score, with no entry from the top 3 repeated.

**Validates: Requirements 7.7**

---

### Property 10: Reduced motion suppresses all framer-motion visual movement

*For any* animated component rendered with `prefers-reduced-motion: reduce` active, the `initial` and `animate` motion values should be identical (same position, same opacity, same scale), ensuring the component renders directly in its final visual state with no transition.

**Validates: Requirements 8.1, 8.2**

---

## Testing Strategy

### Dual Testing Approach

**Unit / example tests** cover specific states and interactions:
- Render each page with the correct phase and verify key UI elements
- Verify disabled button state after answer submission
- Verify error message display on `join_error`

**Property-based tests** verify universal invariants across arbitrary inputs:
- Leaderboard podium rendering with any n-entry array (Properties 8 and 9)
- Header bar reflecting any nickname/score combination (Property 3)
- Answer grid disabling on any option click (Property 4)
- Reduced-motion suppression for any animated component (Property 10)

### Test Framework

The project uses Vite; tests should use **Vitest** with **@testing-library/react** for component rendering. Property-based tests use **fast-check** for input generation.

### Property Test Configuration

- Minimum 100 iterations per property test
- Each property test references its design property via a tag comment: `// Property N: <title>`
- framer-motion should be mocked in unit/property tests to avoid JSDOM animation issues; the reduced-motion property (Property 10) is verified by asserting that `initial` and `animate` prop values are identical when the mock `useReducedMotion` returns `true`
