# Requirements Document

## Introduction

Kuizot is a real-time quiz platform. This expansion adds five phases of functionality on top of the existing anonymous game engine: Authentication & Identity, Owner Quiz CRUD Portal, Admin Panel, Billing & Subscription System, and Analytics.

The system currently has no authentication, no REST CRUD endpoints, and no persistent session records. All game state lives in Redis. This expansion introduces persistent identity (JWT + refresh tokens), a full quiz management portal for owners, an admin panel for platform operators, a manual credit-based billing system, and analytics reporting.

---

## Requirements

### Phase 1 — Authentication & Identity

### 1.1 User Entity Extension

The existing `User` entity MUST be extended with:
- `passwordHash: string` — bcrypt-hashed password
- `role: enum('super_admin' | 'admin' | 'owner')` — platform role, default `'owner'`
- `refreshToken: string | null` — current valid refresh token, null when logged out

### 1.2 Auth Module (Backend)

The system MUST expose four REST endpoints:
- `POST /auth/register` — create a new user with email, username, password; returns access token + refresh token
- `POST /auth/login` — validate email + password; returns access token + refresh token
- `POST /auth/refresh` — accept a valid refresh token; rotate it and return a new access + refresh token pair
- `POST /auth/logout` — clear the stored refresh token on the User record

### 1.3 Password Security

Passwords MUST be hashed with bcrypt (cost factor ≥ 10) before storage. Plain-text passwords MUST NOT be persisted anywhere.

### 1.4 JWT Tokens

- Access tokens MUST be short-lived JWTs signed with `JWT_SECRET` (default expiry `15m`), carrying payload `{ sub: userId, role, email }`
- Refresh tokens MUST be stored as a hashed or raw string on the `User` entity with expiry `7d`
- On every refresh call, the old refresh token MUST be rotated (invalidated and replaced)

### 1.5 Guards and Decorators

The backend MUST provide:
- `JwtAuthGuard` — rejects requests without a valid Bearer token
- `RolesGuard` + `@Roles()` decorator — enforces role-level access on routes
- `@CurrentUser()` decorator — extracts the authenticated user from the request context

### 1.6 Frontend Auth Store

The frontend MUST maintain a Zustand slice (`authStore`) that stores:
- `accessToken: string | null`
- `user: { id, role, email, username } | null`
- Actions: `setAuth`, `clearAuth`

### 1.7 Login and Register Pages

- A `LoginPage` MUST exist at route `/login` — email + password form using the existing gradient design system
- A `RegisterPage` MUST exist at route `/register` — username + email + password form

### 1.8 Route Protection

- A `PrivateRoute` component MUST redirect unauthenticated users to `/login`
- The `/host` route MUST be protected; users without the `owner` role or higher MUST be redirected to `/login`

### 1.9 API Client

A shared `src/lib/api.ts` axios instance MUST:
- Attach `Authorization: Bearer <token>` to all outgoing requests
- Intercept 401 responses, attempt a token refresh, and retry the original request once
- Call `clearAuth` and redirect to `/login` if the refresh also fails

### 1.10 Environment Variables

The following variables MUST be added to the backend `.env`:
- `JWT_SECRET`
- `JWT_EXPIRES_IN=15m`
- `JWT_REFRESH_EXPIRES_IN=7d`

---

### Phase 2 — Owner Quiz CRUD Portal

### 2.1 Quiz Entity Extension

The `Quiz` entity MUST gain:
- `isPublic: boolean` — whether the quiz is publicly discoverable (default `false`)
- `playCount: number` — number of times the quiz has been used in a completed game session (default `0`)

### 2.2 Question Entity Extension

The `Question` entity MUST gain:
- `imageUrl: string | null` — optional image attached to a question (Pro tier feature)

### 2.3 Quiz CRUD Endpoints

A `QuizzesModule` MUST provide CRUD endpoints, all protected by `JwtAuthGuard` + `owner` role:
- `GET /quizzes` — list the authenticated owner's own quizzes
- `POST /quizzes` — create a new quiz
- `GET /quizzes/:id` — get a single quiz (ownership check required)
- `PATCH /quizzes/:id` — update quiz title / description / isPublic (ownership check)
- `DELETE /quizzes/:id` — delete a quiz (ownership check)
- `GET /quizzes/:id/questions` — list all questions with their options

### 2.4 Question and Option Endpoints

A `QuestionsModule` MUST provide:
- `POST /quizzes/:id/questions` — add a question to a quiz
- `PATCH /questions/:id` — edit question text, timeLimit, scoringMode, imageUrl
- `DELETE /questions/:id` — delete a question
- `PATCH /questions/:id/reorder` — change the `order` value of a question
- `POST /questions/:id/options` — add an option to a question
- `PATCH /options/:id` — edit option text, color, isCorrect
- `DELETE /options/:id` — delete an option

### 2.5 GameSession Entity

A new `GameSession` entity MUST be created with columns: `id`, `pin`, `quiz` (ManyToOne), `host` (ManyToOne User), `playerCount`, `leaderboardSnapshot` (jsonb), `playedAt`.

### 2.6 GameGateway — Quiz-Backed Sessions

- `create_session` MUST accept a `quizId` in its payload and store it in the Redis session hash
- `start_question` MUST load the question (text, options, timeLimit, scoringMode, maxPoints) from PostgreSQL by index rather than accepting those values from the client payload
- When `end_game` fires, the gateway MUST write a `GameSession` record to PostgreSQL (pin, quizId, hostId, playerCount, leaderboard snapshot, playedAt)

### 2.7 Owner Dashboard

An `OwnerDashboard` page MUST exist at `/dashboard`:
- Displays quiz list as cards: title, play count, question count, last played date
- Has a "Create Quiz" action
- Has a "Host" button per quiz that passes `quizId` into the session creation flow

### 2.8 Quiz Editor

A `QuizEditor` page MUST exist at `/dashboard/quizzes/:id/edit`:
- Lists questions with add / remove / reorder (drag handles)
- Per question: text input, time limit selector, scoring mode toggle, options editor with correct-answer toggle

### 2.9 Host Flow Update

The existing `HostDashboard` MUST be updated so the host selects a quiz from their list before generating a PIN. The chosen `quizId` MUST be sent in the `create_session` WebSocket event.

### 2.10 Session History Page

A `SessionHistoryPage` MUST exist at `/dashboard/quizzes/:id/history`, showing a table of past game sessions for that quiz.

---

### Phase 3 — Admin Panel

### 3.1 Admin Module (Backend)

A `src/admin/` NestJS module MUST be created, protected by `JwtAuthGuard` + `Roles('super_admin', 'admin')`.

### 3.2 Admin Endpoints

The admin module MUST expose:
- `GET /admin/users` — paginated, searchable, sortable list of all users
- `PATCH /admin/users/:id` — edit a user's role or suspend/unsuspend their account
- `DELETE /admin/users/:id` — delete a user account
- `GET /admin/quizzes` — paginated list of all quizzes across all owners
- `DELETE /admin/quizzes/:id` — delete any quiz
- `GET /admin/stats` — platform KPIs: total users, quizzes, active sessions, revenue
- `GET /admin/audit-log` — paginated audit log

### 3.3 Audit Log Entity

An `AuditLog` entity MUST be created with: `id`, `action` (string), `actorId` (uuid), `targetType` (string), `targetId` (uuid), `metadata` (jsonb), `createdAt`.

### 3.4 Audit Log Interceptor

An `AuditLogInterceptor` MUST automatically log all admin `PATCH` and `DELETE` mutations to the `AuditLog` table, capturing the actor, target, and a metadata snapshot of the change.

### 3.5 Frontend Dependencies

The following packages MUST be installed in `packages/frontend`:
- `@tanstack/react-query ^5`
- `@tanstack/react-table ^8`
- `recharts ^2`
- `react-hook-form ^7`
- `zod ^3`
- `axios ^1`
- Radix UI primitives used by shadcn/ui: `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-tabs`

shadcn/ui component source files MUST be copied into `src/components/ui/`.

### 3.6 Admin Layout

An `AdminLayout` component MUST exist at `src/pages/admin/AdminLayout.tsx` with:
- Collapsible sidebar containing navigation links to all admin pages
- Top bar showing authenticated user info

### 3.7 Admin Pages

The following admin pages MUST be implemented under `/admin/**`:
- `DashboardPage` — 4 StatCards (users, quizzes, sessions, revenue) + line chart of signups over time
- `UsersPage` — TanStack Table with server-side pagination, search, sort; columns: email, username, role, tier, createdAt, actions; `UserEditModal` for role/suspension edits
- `QuizzesPage` — table: title, owner, playCount, createdAt, actions (view, delete)
- `OrganizationsPage` — org list, create/edit org, assign users to org
- `SubscriptionsPage` — user subscription table + tier distribution pie chart
- `PaymentRequestsPage` — pending payment requests table with inline Confirm/Reject actions
- `AuditLogPage` — immutable, read-only log table
- `SettingsPage` — feature flags and maintenance mode toggle

### 3.8 Admin Route Guard

All routes under `/admin/**` MUST redirect users who do not hold `super_admin` or `admin` role to `/dashboard`.

---

### Phase 4 — Billing & Subscription System

### 4.1 Subscription Entity

A `Subscription` entity MUST be created (OneToOne with User) with fields: `billingModel` (enum: `payg|monthly`), `tier` (enum: `free|starter|pro|business`), `creditBalance` (int), `currentPeriodEnd` (timestamptz|null), `sessionsUsedThisPeriod` (int), `status` (enum: `active|suspended|expired`).

### 4.2 PaymentRequest Entity

A `PaymentRequest` entity MUST be created with fields: `requestType` (enum: `payg_topup|starter|pro|business`), `amountCents` (int), `creditsToAdd` (int), `ownerReference` (text|null), `proofFileUrl` (text|null), `status` (enum: `pending|confirmed|rejected`), `reviewedBy` (ManyToOne User|null), `adminNote` (text|null), `submittedAt`, `reviewedAt` (nullable).

### 4.3 CreditTransaction Entity

A `CreditTransaction` entity MUST be created as an immutable ledger with fields: `delta` (int, positive = credit added, negative = spent), `balanceAfter` (int), `type` (enum: `payment|session_start|player_join|admin_adjustment|refund`), `referenceId` (uuid|null), `note` (text|null), `createdAt`.

### 4.4 Billing Module Services

A `src/billing/` module MUST provide:
- `CreditsService`: `addCredits(userId, amount, type, referenceId)`, `deductCredits(userId, amount, type, referenceId)`, `getBalance(userId)`
- `BillingService.checkLimit(userId, 'session_start' | 'player_join')`: returns `{ allowed: boolean; reason?: string }`
- `BillingService.checkFeature(userId, feature)`: returns `boolean` indicating whether the user's tier grants access to the named feature

### 4.5 Owner Billing Endpoints

- `GET /billing/me` — return the authenticated owner's subscription status, tier, credit balance, and period data
- `POST /billing/payment-requests` — owner submits a new payment request (supports multipart/form-data for proof screenshot upload)
- `GET /billing/payment-requests` — list own payment requests
- `GET /billing/transactions` — list own credit transaction history

### 4.6 Admin Billing Endpoints

- `GET /admin/billing/payment-requests` — list all payment requests (filterable by status)
- `PATCH /admin/billing/payment-requests/:id/confirm` — confirm a request and apply credits to the owner's account
- `PATCH /admin/billing/payment-requests/:id/reject` — reject a request with an admin note
- `POST /admin/billing/credits/adjust` — super_admin manual credit adjustment (add or subtract any amount)

### 4.7 Game Gateway Billing Enforcement

- `create_session` MUST call `BillingService.checkLimit(hostId, 'session_start')` and emit `session_error: 'Insufficient credits'` if not allowed
- `join_session` MUST call `BillingService.checkLimit(hostId, 'player_join')` and emit `join_error: 'Player limit reached'` if the player cap for that tier is exceeded

### 4.8 Auto Subscription Creation

`AuthService.register()` MUST automatically create a `free`-tier `Subscription` record with `creditBalance: 0` for every newly registered user.

### 4.9 Period Reset Cron Job

A scheduled NestJS cron job MUST reset `sessionsUsedThisPeriod` to `0` at the start of each calendar month for all monthly subscribers whose `currentPeriodEnd` has passed.

### 4.10 File Upload

Payment proof screenshots MUST be accepted as multipart file uploads via multer and stored at the path defined by `UPLOAD_LOCAL_PATH` (or an S3-compatible store if `UPLOAD_STORAGE=s3`).

### 4.11 Billing Environment Variables

The following variables MUST be added to `.env`:
- `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_SORT_CODE`, `BANK_IBAN`, `BANK_REFERENCE_PREFIX`
- `CREDIT_RATE_PER_DOLLAR=10`, `CREDIT_COST_SESSION_START=5`, `CREDIT_COST_PER_PLAYER=1`
- `UPLOAD_STORAGE=local`, `UPLOAD_LOCAL_PATH=./uploads`

### 4.12 Billing Frontend Pages

- `BillingPage` at `/settings/billing` — tier badge, credit balance gauge, usage meter, "Add Credits / Upgrade" CTA
- `TopUpPage` at `/settings/billing/topup` — amount input, plan selector, bank account details display, transfer reference input, optional proof screenshot upload, submit button
- `PaymentHistoryPage` at `/settings/billing/history` — table of past payment requests with status badges

### 4.13 Plan Gating UI

The Owner Portal MUST show "Upgrade to unlock" prompts for features that the user's current tier does not include.

### 4.14 Tier Badge in Owner Portal

The owner portal header MUST display the current tier badge and credit balance at all times.

---

### Phase 5 — Analytics

### 5.1 QuestionStat Entity

A `QuestionStat` entity MUST be created with fields: `gameSession` (ManyToOne), `question` (ManyToOne), `correctCount` (int), `totalAnswers` (int), `avgTimeTakenMs` (int).

### 5.2 Session Analytics Service

A `SessionAnalyticsService` MUST write `QuestionStat` rows and update the `GameSession` record when a game ends.

### 5.3 Analytics Endpoints

- `GET /analytics/quiz/:id` — returns sessions list + per-question stats for a quiz owned by the authenticated user
- `GET /analytics/overview` — returns owner totals: total games hosted, total players reached, top quiz
- `GET /admin/analytics` — platform-wide metrics: DAU, MAU, quiz count over time (admin only)

### 5.4 Owner Analytics Page

A page at `/dashboard/quizzes/:id/analytics` MUST show a session history table and a per-question correctness bar chart (using Recharts).

### 5.5 Admin Dashboard Analytics

The admin `DashboardPage` MUST be enhanced with: DAU line chart, tier distribution pie chart, top quizzes bar chart.
