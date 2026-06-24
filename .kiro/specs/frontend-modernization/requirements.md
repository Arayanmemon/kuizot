# Requirements Document

## Introduction

This feature modernizes the Kuizot quiz game frontend with a vibrant, visually striking UI across all three pages (JoinPage, PlayerView, HostDashboard). The modernization includes Kahoot-inspired gradient backgrounds with high-contrast white text, framer-motion animations for answer feedback, and a polished podium-style end-game leaderboard displayed to both hosts and players. A `frontend-plan.md` planning document must be generated before any code changes are made.

## Glossary

- **Frontend**: The React 19 + Vite + Tailwind CSS v4 single-page application located in `packages/frontend/`
- **JoinPage**: The player entry screen rendered at the `/` route where players input a Game PIN and nickname
- **PlayerView**: The player remote-control screen rendered at the `/player` route where players see questions and submit answers
- **HostDashboard**: The host broadcast screen rendered at the `/host` route where the host controls the game and sees live results
- **framer-motion**: The animation library to be installed as a production dependency in `packages/frontend/package.json`
- **Vibrant Gradient Background**: A CSS gradient background style using vivid colors (e.g., pink → purple, or equivalent high-saturation palette), applied using Tailwind CSS v4 inline gradient utilities
- **Podium Screen**: The end-game leaderboard view showing the top 3 ranked players on a visual podium with medal icons (🥇🥈🥉), followed by a full scrollable ranked list
- **AnswerFeedback**: The animated visual response shown in PlayerView after a player submits an answer, indicating correct or incorrect status via framer-motion animations
- **GamePhase**: A value from the Zustand `gameStore` representing the current stage of the game — one of `lobby`, `question`, or `leaderboard`
- **LeaderboardEntry**: A data structure containing `userId` and `score` fields, sourced from the Zustand store's `leaderboard` array
- **frontend-plan.md**: A markdown planning document describing the UI/UX approach, component breakdown, and implementation steps, to be created at `packages/frontend/frontend-plan.md` before any code is modified

---

## Requirements

### Requirement 1: Planning Document Generation

**User Story:** As a developer, I want a frontend-plan.md created before any code changes, so that the implementation approach is documented and reviewable upfront.

#### Acceptance Criteria

1. THE Frontend SHALL have a `frontend-plan.md` file created at `packages/frontend/frontend-plan.md` before any source code file is modified.
2. THE `frontend-plan.md` SHALL describe the visual design direction including color palette, gradient styles, and typography choices.
3. THE `frontend-plan.md` SHALL list each page (JoinPage, PlayerView, HostDashboard) with its planned UI changes and component breakdown.
4. THE `frontend-plan.md` SHALL document framer-motion animation strategies for answer feedback and leaderboard transitions.
5. THE `frontend-plan.md` SHALL include the implementation task order.

---

### Requirement 2: framer-motion Dependency Installation

**User Story:** As a developer, I want framer-motion added to the frontend package, so that animation capabilities are available throughout the application.

#### Acceptance Criteria

1. THE Frontend SHALL have `framer-motion` listed as a production dependency in `packages/frontend/package.json`.
2. THE Frontend SHALL use a pinned or exact-minor version of `framer-motion` compatible with React 19 (version `^12.0.0` or later).
3. WHEN the frontend build process runs, THE Frontend SHALL compile without errors related to missing framer-motion imports.

---

### Requirement 3: Global Visual Style — Vibrant Gradient UI

**User Story:** As a player or host, I want the app to have a vibrant, Kahoot-inspired visual design, so that the game feels energetic and engaging.

#### Acceptance Criteria

1. THE Frontend SHALL apply a vibrant gradient background (e.g., `from-pink-500 via-purple-600 to-indigo-700` or equivalent) to all three pages using Tailwind CSS v4 utility classes without a `tailwind.config.js` file.
2. THE Frontend SHALL render primary text on gradient backgrounds in white (`text-white`) with sufficient contrast to meet WCAG AA requirements.
3. THE Frontend SHALL use Tailwind CSS v4 CSS-first configuration exclusively — no `tailwind.config.js` SHALL be present or required.
4. THE Frontend SHALL apply rounded corners, shadows, and card-style containers to form and content panels to create visual depth.
5. THE Frontend SHALL display the Kuizot application name or logo on all pages in a prominent, styled heading.

---

### Requirement 4: JoinPage Modernization

**User Story:** As a player, I want the Join page to look polished and welcoming, so that I feel excited to participate in the game.

#### Acceptance Criteria

1. THE JoinPage SHALL render with the vibrant gradient background defined in Requirement 3.
2. THE JoinPage SHALL display a styled card container with a white or translucent background for the PIN and nickname input form.
3. THE JoinPage SHALL display the Game PIN input field and the Nickname input field each with clear visual styling (rounded corners, focus ring, padding).
4. WHEN the user submits the join form successfully, THE JoinPage SHALL navigate to the `/player` route.
5. IF the server returns a `join_error` event, THEN THE JoinPage SHALL display the error message in a visually distinct error state below the form.
6. WHILE the socket connection is not established, THE JoinPage SHALL display a disabled submit button with a "Connecting..." label.

---

### Requirement 5: PlayerView Modernization

**User Story:** As a player, I want the PlayerView to be visually modern and provide clear animated feedback on my answers, so that the quiz experience is fun and immediate.

#### Acceptance Criteria

1. THE PlayerView SHALL render with the vibrant gradient background defined in Requirement 3.
2. THE PlayerView SHALL display a styled header bar showing the player's nickname and current score in a readable, visually distinct layout.
3. WHEN the GamePhase is `lobby`, THE PlayerView SHALL display a waiting message with a framer-motion pulse or entrance animation.
4. WHEN the GamePhase is `question`, THE PlayerView SHALL render the answer option buttons in a 2×2 grid with distinct colors per option.
5. WHEN a player clicks an answer button, THE PlayerView SHALL immediately disable all answer buttons to prevent re-submission.
6. WHEN the `answer_result` socket event is received with `isCorrect: true`, THE PlayerView SHALL display a framer-motion animated correct-answer feedback overlay (e.g., green checkmark with scale-in animation).
7. WHEN the `answer_result` socket event is received with `isCorrect: false`, THE PlayerView SHALL display a framer-motion animated wrong-answer feedback overlay (e.g., red X with shake animation).
8. THE correct-answer animation SHALL complete within 1500ms.
9. THE wrong-answer animation SHALL complete within 1500ms.
10. WHEN the GamePhase is `leaderboard`, THE PlayerView SHALL display the player's personal rank and total score in a styled card.

---

### Requirement 6: HostDashboard Modernization

**User Story:** As a host, I want the HostDashboard to look professional and lively, so that the broadcast screen looks great on a projector or shared screen.

#### Acceptance Criteria

1. THE HostDashboard SHALL render with the vibrant gradient background defined in Requirement 3.
2. WHEN no Game PIN exists, THE HostDashboard SHALL display a centered setup screen with a prominent "Generate Game PIN" button styled with gradient or bold color.
3. WHEN the GamePhase is `lobby`, THE HostDashboard SHALL display the Game PIN in a large, high-contrast styled container visible from a distance.
4. WHEN the GamePhase is `lobby`, THE HostDashboard SHALL display joined player nicknames as styled badge chips with a live count.
5. WHEN the GamePhase is `question`, THE HostDashboard SHALL display the current question text prominently and render the four answer option panels in a 2×2 grid with distinct background colors.
6. WHEN the GamePhase is `question`, THE HostDashboard SHALL display a live answer count indicator showing how many players have submitted answers.
7. WHEN the GamePhase is `leaderboard`, THE HostDashboard SHALL display the Podium Screen as defined in Requirement 7.

---

### Requirement 7: Podium-Style End-Game Leaderboard

**User Story:** As a host or player, I want to see a polished podium leaderboard at the end of the game, so that the final results are visually celebratory and memorable.

#### Acceptance Criteria

1. THE Podium Screen SHALL display when the GamePhase transitions to `leaderboard`, visible to both the HostDashboard (at `/host`) and PlayerView (at `/player`).
2. THE Podium Screen SHALL render the top 3 players from the `leaderboard` Zustand store array on a visual podium with distinct heights: 2nd place left (shorter), 1st place center (tallest), 3rd place right (shortest).
3. THE Podium Screen SHALL display medal icons — 🥇 for 1st, 🥈 for 2nd, 🥉 for 3rd — adjacent to each top-3 player's name.
4. THE Podium Screen SHALL display each top-3 player's score beneath their name on the podium.
5. WHEN the Podium Screen first appears, THE Podium Screen SHALL use framer-motion to animate the podium columns rising from the bottom into view.
6. WHEN the Podium Screen first appears, THE Podium Screen SHALL use framer-motion to animate each player card entering with a staggered entrance (2nd → 3rd → 1st reveal order).
7. THE Podium Screen SHALL render a full scrollable ranked list below the podium showing all players from rank 4 onward with their rank number, nickname (sourced from `userId` until nickname tracking is added), and score.
8. IF the `leaderboard` array contains fewer than 3 entries, THEN THE Podium Screen SHALL render only the available entries on the podium without rendering empty podium slots.
9. THE Podium Screen SHALL apply the vibrant gradient background defined in Requirement 3.
10. WHEN the HostDashboard displays the Podium Screen, THE HostDashboard SHALL provide a "Back to Lobby" control to reset the game phase.

---

### Requirement 8: Animation Quality and Accessibility

**User Story:** As a user with motion sensitivity preferences, I want animations to respect the OS reduced-motion setting, so that I can use the app comfortably.

#### Acceptance Criteria

1. THE Frontend SHALL wrap all framer-motion animations with logic that checks the `prefers-reduced-motion` media query.
2. WHEN `prefers-reduced-motion: reduce` is active, THE Frontend SHALL suppress or minimize all framer-motion transition effects while preserving the final visual state.
3. THE Frontend SHALL not display any animation that loops indefinitely without user interaction, except for waiting-state pulse effects in the lobby.
