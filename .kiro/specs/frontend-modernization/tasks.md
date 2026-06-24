# Implementation Plan: Frontend Modernization

## Overview

Transform the Kuizot frontend from its current functional-but-plain UI into a vibrant, Kahoot-inspired experience. The implementation follows a strict top-down order: planning document first, then the single new dependency, then shared components, then page-by-page modernization, and finally global styles. All animation code is guarded by the `useReducedMotion` hook, and the shared `Leaderboard` and `AnswerFeedbackOverlay` components are consumed by both `PlayerView` and `HostDashboard`.

---

## Tasks

- [ ] 1. Generate frontend-plan.md
  - [ ] 1.1 Create `packages/frontend/frontend-plan.md`
    - Write a Markdown planning document covering:
      - Visual design direction: gradient palette (`pink-500 → purple-600 → indigo-700`), typography (`font-black text-white`), card patterns
      - Per-page breakdown for JoinPage, PlayerView, and HostDashboard with planned UI changes and component responsibilities
      - framer-motion animation strategies: `AnswerFeedbackOverlay` scale/shake timings, podium rising animation, staggered player-card reveal
      - Implementation task order matching this task list
    - This file must exist before any source file is touched
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Install framer-motion dependency
  - [x] 2.1 Add `framer-motion` to `packages/frontend/package.json`
    - Add `"framer-motion": "^12.0.0"` under `"dependencies"` in `packages/frontend/package.json`
    - Run `npm install` inside `packages/frontend` to update `package-lock.json`
    - Verify the build compiles without import errors before proceeding
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Add shared hooks and components
  - [x] 3.1 Create `src/hooks/useReducedMotion.ts`
    - Implement the hook using `window.matchMedia('(prefers-reduced-motion: reduce)')` with an initial synchronous read and a `change` event listener for live updates
    - Return `boolean`; re-render consumers when the OS preference changes
    - _Requirements: 8.1, 8.2_

  - [ ]* 3.2 Write property test for `useReducedMotion`
    - **Property 10: Reduced motion suppresses all framer-motion visual movement**
    - **Validates: Requirements 8.1, 8.2**
    - Use `@testing-library/react` `renderHook`; mock `window.matchMedia` to return `{ matches: true }` and assert the hook returns `true`; mock it to return `{ matches: false }` and assert `false`

  - [x] 3.3 Create `src/components/AnswerFeedbackOverlay.tsx`
    - Implement the component using `AnimatePresence` from framer-motion
    - `visible` prop drives `AnimatePresence` presence; `isCorrect` drives color and icon
    - Correct: green backdrop + `✓` with `scale: 0.5 → 1` entrance; Wrong: red backdrop + `✗` with shake `x` keyframes
    - Call `useReducedMotion()`; when `reduced === true`, set `initial` equal to `animate` and use `transition={{ duration: 0 }}`
    - Accept `visible: boolean` and `isCorrect: boolean | null` props
    - _Requirements: 5.6, 5.7, 5.8, 5.9, 8.1, 8.2_

  - [ ]* 3.4 Write property test for `AnswerFeedbackOverlay`
    - **Property 10: Reduced motion suppresses all framer-motion visual movement**
    - **Validates: Requirements 8.1, 8.2**
    - Mock `useReducedMotion` to return `true`; render `<AnswerFeedbackOverlay visible isCorrect={true} />`; assert the `motion.div` receives identical `initial` and `animate` prop values

  - [x] 3.5 Create `src/components/Leaderboard.tsx`
    - Accept props: `entries: LeaderboardEntry[]`, `currentUserId?: string`, `onBackToLobby?: () => void`
    - Render a three-column podium for top 3 in 2nd→1st→3rd left-to-right display order with heights `h-28`/`h-40`/`h-20`; medal emojis 🥇🥈🥉; nickname/userId; score beneath name
    - Animate each column with `scaleY: 0 → 1` (origin bottom), staggered by 150 ms per column via framer-motion `custom` prop
    - Player cards reveal in 2nd→3rd→1st order (winner last)
    - Render an `<ol>` below the podium for rank 4+ entries; highlight the row matching `currentUserId` with a ring class
    - Render "No scores yet" when `entries` is empty; render only available columns when `entries.length < 3`
    - Render a "Back to Lobby" button when `onBackToLobby` is provided
    - Call `useReducedMotion()`; suppress all transitions when `reduced === true`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 8.1, 8.2_

  - [ ]* 3.6 Write property test for `Leaderboard` — podium medal assignment
    - **Property 8: Podium ranks top entries with correct medal assignment**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.8**
    - Use fast-check to generate arrays of 1–3 `LeaderboardEntry` objects; render `<Leaderboard entries={...} />`; assert exactly n columns, 🥇 for rank 1, 🥈 for rank 2 (if present), 🥉 for rank 3 (if present), no empty slots

  - [ ]* 3.7 Write property test for `Leaderboard` — ranked list below podium
    - **Property 9: Ranked list below podium contains all players from rank 4 onward**
    - **Validates: Requirements 7.7**
    - Use fast-check to generate arrays of 4–20 `LeaderboardEntry` objects; render `<Leaderboard entries={...} />`; assert the `<ol>` contains exactly `n − 3` items and none repeat a top-3 `userId`

- [ ] 4. Checkpoint — ensure shared components compile and pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Modernize JoinPage
  - [x] 5.1 Rewrite `src/pages/JoinPage.tsx` with gradient background and card form
    - Apply `gradient-bg min-h-screen` to the page root div (class defined in task 8)
    - Wrap the form in a white opaque card: `bg-white rounded-2xl shadow-xl p-8`
    - Display Kuizot heading: `font-black text-white text-4xl` above the card
    - Style PIN input and Nickname input: `rounded-xl border-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-200` with full-width and large text
    - Style submit button: `bg-gray-900 text-white font-bold rounded-xl` disabled when `!isConnected`, label "Connecting..." while disconnected
    - Display `join_error` message in `text-red-400` below the form (already wired in existing component; keep logic, upgrade styling)
    - Navigate to `/player` on `join_success` (existing logic unchanged)
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 5.2 Write property test for JoinPage — error message surfacing
    - **Property 2: Error messages are always surfaced in the join form**
    - **Validates: Requirements 4.5**
    - Use fast-check to generate arbitrary non-empty error strings; render `<JoinPage />`; simulate a `join_error` socket event with each string; assert the exact string is visible in the DOM below the form

- [x] 6. Modernize PlayerView
  - [x] 6.1 Rewrite `src/pages/PlayerView.tsx` with gradient background and header bar
    - Apply `gradient-bg min-h-screen flex flex-col` to the page root
    - Implement a sticky header bar: `bg-white/10 backdrop-blur-sm` showing nickname (`font-bold text-white`) on the left and score badge (`bg-white/20 text-white font-bold rounded-full px-3 py-1`) on the right
    - _Requirements: 3.1, 3.2, 5.1, 5.2_

  - [x] 6.2 Add lobby waiting state to `PlayerView`
    - When `phase === 'lobby'`: render a centered text area with a framer-motion entrance animation (`opacity: 0 → 1`, `y: 20 → 0`)
    - Show "You're in!" heading and "See your nickname on screen" subtitle with Tailwind `animate-pulse` for the waiting indicator
    - Apply reduced-motion guard via `useReducedMotion()`
    - _Requirements: 5.3, 8.1, 8.3_

  - [x] 6.3 Add answer grid and `AnswerFeedbackOverlay` to `PlayerView`
    - When `phase === 'question'`: render a 2×2 `grid` of answer buttons, each using `style={{ backgroundColor: opt.color }}` with `rounded-xl shadow-lg text-white font-bold text-xl` styling
    - Import and render `<AnswerFeedbackOverlay visible={showFeedback} isCorrect={lastAnswerCorrect} />` as an absolute overlay inside a `relative` grid wrapper
    - Add local state `showFeedback: boolean`; use a `useEffect` watching `[hasAnswered]`: when `hasAnswered` becomes `true`, set `showFeedback = true`, then `setTimeout(() => setShowFeedback(false), 1500)`
    - Keep existing `handleAnswerClick` emit logic and button `disabled={hasAnswered}` behavior
    - _Requirements: 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 6.4 Add `Leaderboard` component to `PlayerView` leaderboard phase
    - When `phase === 'leaderboard'`: replace the current placeholder with `<Leaderboard entries={leaderboard} currentUserId={userId} />`
    - _Requirements: 5.10, 7.1_

  - [ ]* 6.5 Write property test for PlayerView — header bar reflects any nickname and score
    - **Property 3: Header bar reflects any nickname and score**
    - **Validates: Requirements 5.2**
    - Use fast-check to generate arbitrary nickname strings and non-negative integer scores; mock Zustand store; render `<PlayerView />`; assert both values appear in a header element

  - [ ]* 6.6 Write property test for PlayerView — answer grid renders all options and disables on selection
    - **Property 4: Answer grid renders all options and disables on selection**
    - **Validates: Requirements 5.4, 5.5**
    - Use fast-check to generate valid `QuestionData` objects with exactly 4 options; render `<PlayerView />` in question phase; assert 4 buttons rendered; simulate click on any button; assert all 4 buttons become disabled

- [x] 7. Modernize HostDashboard
  - [x] 7.1 Rewrite `src/pages/HostDashboard.tsx` setup screen
    - Apply `gradient-bg min-h-screen flex flex-col` to the root
    - Setup screen (no PIN): center a card with Kuizot heading and a "Generate Game PIN" button styled `bg-white text-purple-700 font-black text-2xl rounded-2xl shadow-xl px-10 py-5 hover:bg-white/90`
    - Show "Connecting..." label and disable button when `!isConnected`
    - _Requirements: 3.1, 3.5, 6.1, 6.2_

  - [x] 7.2 Rewrite `HostDashboard` lobby phase
    - PIN display card: `bg-white/10 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center`; PIN text `text-7xl font-black tracking-widest text-white`
    - Player count heading and Start button row; player badges: `bg-white/20 text-white font-bold rounded-full px-4 py-2`; "Waiting for players..." italic placeholder when empty
    - _Requirements: 6.3, 6.4_

  - [x] 7.3 Rewrite `HostDashboard` question phase
    - Question text: `text-4xl font-black text-white text-center mb-6`
    - 2×2 answer panels: `rounded-2xl shadow-lg flex items-center justify-center` with `style={{ backgroundColor: opt.color }}` and option text `text-3xl font-bold text-white`
    - Answer count indicator: `bg-white/10 text-white` chip showing `{answerCount} / {players.length} answered`
    - Keep "Skip / Show Results" button
    - _Requirements: 6.5, 6.6_

  - [x] 7.4 Add `Leaderboard` component to `HostDashboard` leaderboard phase
    - When `phase === 'leaderboard'`: replace the current list with `<Leaderboard entries={leaderboard} onBackToLobby={() => setPhase('lobby')} />`
    - _Requirements: 6.7, 7.1, 7.10_

  - [ ]* 7.5 Write property test for HostDashboard — lobby renders all joined players and correct count
    - **Property 6: Host lobby renders all joined players and correct count**
    - **Validates: Requirements 6.3, 6.4**
    - Use fast-check to generate arrays of 1–20 player objects and a 6-character PIN; mock Zustand store in lobby phase; render `<HostDashboard />`; assert every player's nickname appears as a badge and the count equals the array length

  - [ ]* 7.6 Write property test for HostDashboard — question panel shows question and answer count
    - **Property 7: Host question panel shows question and answer count**
    - **Validates: Requirements 6.5, 6.6**
    - Use fast-check to generate a valid question object and an integer answerCount in `[0, playerCount]`; render `<HostDashboard />` in question phase; assert question text is rendered prominently and the answer count indicator shows both numbers

- [ ] 8. Checkpoint — ensure page modernization is complete and all component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Update global styles in `src/index.css`
  - [x] 9.1 Rewrite `src/index.css` with Tailwind v4 CSS-first tokens and `.gradient-bg` utility
    - Keep `@import "tailwindcss"` at the top
    - Add an `@theme` block declaring `--color-brand-gradient-from: #ec4899`, `--color-brand-gradient-via: #9333ea`, `--color-brand-gradient-to: #4338ca`
    - Define `.gradient-bg { background: linear-gradient(135deg, var(--color-brand-gradient-from), var(--color-brand-gradient-via), var(--color-brand-gradient-to)); }`
    - Remove the existing `body` background-color override so all three page roots control their own background
    - Ensure `@media (prefers-reduced-motion: reduce) { .animate-pulse { animation: none; } }` is present (Tailwind v4 preflight already includes this, add it explicitly if missing)
    - No `tailwind.config.js` file should be created
    - _Requirements: 3.1, 3.3, 8.3_

  - [ ]* 9.2 Write unit tests for `index.css` token presence
    - Parse the CSS text and assert that the three custom properties and `.gradient-bg` rule are present
    - _Requirements: 3.1, 3.3_

- [x] 10. Wire Kuizot branding into `App.tsx`
  - [x] 10.1 Verify Kuizot branding appears on all pages via `App.tsx` or page roots
    - Confirm each page root (JoinPage, PlayerView, HostDashboard) renders the "Kuizot" heading — either inline in each page (preferred) or via a shared header component imported in `App.tsx`
    - Remove the dev-only "Connecting to Server..." banner from `App.tsx` and replace with a connection status chip inside each page header
    - _Requirements: 3.5_

  - [ ]* 10.2 Write property test for branding presence on all pages
    - **Property 1: Kuizot branding is present on every page**
    - **Validates: Requirements 3.5**
    - Render each of `<JoinPage />`, `<PlayerView />`, `<HostDashboard />` in isolation with mocked store; assert the string "Kuizot" appears in the rendered output for each

- [ ] 11. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `frontend-plan.md` (task 1.1) must be created before any source file is touched — this is a hard ordering constraint
- `framer-motion ^12.0.0` must be installed (task 2.1) before any component import from it will compile
- Shared components (tasks 3.1–3.5) must exist before the pages that consume them (tasks 5–7)
- All framer-motion components call `useReducedMotion()` and set `initial === animate` + `transition={{ duration: 0 }}` when `reduced === true`
- The `.gradient-bg` CSS class (task 9.1) must be defined before page roots apply it, but since all tasks run against the final artifact, the order in this list achieves that
- Property tests use fast-check; unit tests use Vitest + @testing-library/react; framer-motion should be mocked in tests
- Each property test references its design property number via a comment tag

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1", "9.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "3.5", "9.2"] },
    { "id": 5, "tasks": ["3.6", "3.7"] },
    { "id": 6, "tasks": ["5.1", "6.1", "6.2", "6.3", "7.1", "7.2", "7.3"] },
    { "id": 7, "tasks": ["5.2", "6.4", "6.5", "6.6", "7.4", "7.5", "7.6", "10.1"] },
    { "id": 8, "tasks": ["10.2"] }
  ]
}
```
