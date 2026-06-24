# Implementation Plan: Kuizot Platform Expansion

## Overview

Five-phase implementation following the plan in `ADMIN_PANEL_PLAN.md`. Phases are strictly ordered — each phase builds on the previous. All backend code is TypeScript/NestJS; all frontend code is TypeScript/React 19 with Tailwind CSS v4.

## Tasks

---

### Phase 1 — Authentication & Identity

- [ ] 1. Extend User entity and install backend auth dependencies
  - [ ] 1.1 Add `passwordHash`, `role` enum, and `refreshToken` columns to `src/entities/user.entity.ts`
    - `role` enum: `'super_admin' | 'admin' | 'owner'`, default `'owner'`
    - `select: false` on `passwordHash` and `refreshToken` to exclude from default queries
    - _Requirements: 1.1_
  - [ ] 1.2 Install backend auth packages
    - `@nestjs/jwt ^10.2.0`, `@nestjs/passport ^10.0.3`, `passport ^0.7.0`, `passport-jwt ^4.0.1`, `passport-local ^1.0.0`, `bcrypt ^5.1.1`
    - Dev types: `@types/bcrypt ^5.0.2`, `@types/passport-jwt ^4.0.1`, `@types/passport-local ^1.0.38`
    - Also install `class-validator ^0.14.1` and `class-transformer ^0.5.1`
    - _Requirements: 1.2_


- [ ] 2. Implement AuthModule (backend)
  - [ ] 2.1 Create DTOs: `RegisterDto` (`email`, `username`, `password`) and `LoginDto` (`email`, `password`) in `src/auth/dto/` with `class-validator` decorators
    - _Requirements: 1.2_
  - [ ] 2.2 Create `LocalStrategy` (`src/auth/strategies/local.strategy.ts`) — validates email + password against DB, returns user or throws `UnauthorizedException`
    - _Requirements: 1.2_
  - [ ] 2.3 Create `JwtStrategy` (`src/auth/strategies/jwt.strategy.ts`) — reads `JWT_SECRET` from ConfigService, extracts Bearer token, attaches `{ sub, role, email }` to request
    - _Requirements: 1.4_
  - [ ] 2.4 Create `JwtAuthGuard`, `RolesGuard`, `@Roles()` decorator, and `@CurrentUser()` decorator in `src/auth/guards/` and `src/auth/decorators/`
    - _Requirements: 1.5_
  - [ ] 2.5 Implement `AuthService` with `register`, `login`, `refresh`, and `logout` methods using bcrypt + JwtService
    - `register`: hash password (cost 10), create User, issue token pair, store refresh token
    - `login`: find user with `addSelect` for passwordHash, compare, issue token pair
    - `refresh`: find user by refreshToken, rotate (new pair, update DB)
    - `logout`: set `refreshToken = null`
    - _Requirements: 1.2, 1.3, 1.4_
  - [ ]* 2.6 Write property test for refresh token single-use (Property 2)
    - **Property 2: Refresh Token Single-Use**
    - **Validates: Requirements 1.4**
  - [ ] 2.7 Create `AuthController` exposing `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`; register `AuthModule` in `AppModule`
    - _Requirements: 1.2_


- [ ] 3. Update .env and implement frontend auth
  - [ ] 3.1 Add `JWT_SECRET`, `JWT_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=7d` to `packages/backend/.env`
    - _Requirements: 1.10_
  - [ ] 3.2 Install frontend packages: `axios ^1.7.0`
    - _Requirements: 1.9_
  - [ ] 3.3 Create `src/store/authStore.ts` — Zustand slice with `accessToken`, `user` (id, role, email, username), `setAuth`, `clearAuth`; persist to localStorage
    - _Requirements: 1.6_
  - [ ] 3.4 Create `src/lib/api.ts` — axios instance with `Authorization: Bearer` request interceptor and 401 → refresh → retry response interceptor
    - _Requirements: 1.9_
  - [ ] 3.5 Create `LoginPage` at `/login` and `RegisterPage` at `/register` using existing gradient/glass design patterns
    - Forms call `api.post('/auth/login')` or `api.post('/auth/register')`, then `setAuth()` and navigate to `/dashboard`
    - _Requirements: 1.7_
  - [ ] 3.6 Create `PrivateRoute` component; protect `/host` route with `allowedRoles={['owner','admin','super_admin']}`; add `/admin/*` route guard with `allowedRoles={['super_admin','admin']}`; update `App.tsx` routing
    - _Requirements: 1.8_

- [ ] 4. Phase 1 Checkpoint — Ensure all tests pass, ask the user if questions arise.


---

### Phase 2 — Owner Quiz CRUD Portal

- [ ] 5. Extend entities and create QuizzesModule
  - [ ] 5.1 Add `isPublic: boolean` and `playCount: number` to `Quiz` entity; add `imageUrl: string | null` to `Question` entity
    - _Requirements: 2.1, 2.2_
  - [ ] 5.2 Create `GameSession` entity in `src/entities/game-session.entity.ts` with fields: `id`, `pin`, `quiz` (ManyToOne), `host` (ManyToOne User), `playerCount`, `leaderboardSnapshot` (jsonb), `playedAt`
    - _Requirements: 2.5_
  - [ ] 5.3 Create `QuizzesModule` with `QuizzesService` and `QuizzesController` — full CRUD (`GET /quizzes`, `POST /quizzes`, `GET /quizzes/:id`, `PATCH /quizzes/:id`, `DELETE /quizzes/:id`, `GET /quizzes/:id/questions`) protected by `JwtAuthGuard` + ownership check
    - _Requirements: 2.3_
  - [ ]* 5.4 Write property test for ownership isolation (Property 4)
    - **Property 4: Ownership Isolation**
    - **Validates: Requirements 2.3**


- [ ] 6. Create QuestionsModule and update GameGateway
  - [ ] 6.1 Create `QuestionsModule` with `QuestionsController` and `QuestionsService`
    - Endpoints: `POST /quizzes/:id/questions`, `PATCH /questions/:id`, `DELETE /questions/:id`, `PATCH /questions/:id/reorder`
    - Option endpoints: `POST /questions/:id/options`, `PATCH /options/:id`, `DELETE /options/:id`
    - All mutations verify question belongs to an owned quiz (throw `ForbiddenException` otherwise)
    - _Requirements: 2.4_
  - [ ] 6.2 Update `GameGateway.handleCreateSession` to accept `quizId` in payload and store it in the Redis session hash (`quiz_id` field)
    - _Requirements: 2.6_
  - [ ] 6.3 Update `GameGateway.handleStartQuestion` to load question by index from PostgreSQL via `QuestionsService.getQuestionByIndex(quizId, questionIndex)` instead of accepting question data from the client
    - _Requirements: 2.6_
  - [ ] 6.4 Update `GameGateway.handleEndGame` to write a `GameSession` record (pin, quiz, host, playerCount, leaderboardSnapshot) and increment `quiz.playCount`
    - _Requirements: 2.6_

- [ ] 7. Build Owner Portal frontend
  - [ ] 7.1 Create `OwnerDashboard` page at `/dashboard` — quiz list cards using `useQuery` on `GET /quizzes`; each card has Edit, History, Host, and Analytics actions
    - _Requirements: 2.7_
  - [ ] 7.2 Create `QuizEditor` page at `/dashboard/quizzes/:id/edit` — question list with add/remove/reorder (drag handles), per-question editor (text, timeLimit, scoringMode, options with correct-answer toggle)
    - _Requirements: 2.8_
  - [ ] 7.3 Update `HostDashboard` to show quiz selector before lobby; pass `quizId` in `create_session` event
    - _Requirements: 2.9_
  - [ ] 7.4 Create `SessionHistoryPage` at `/dashboard/quizzes/:id/history` — table of past game sessions
    - _Requirements: 2.10_

- [ ] 8. Phase 2 Checkpoint — Ensure all tests pass, ask the user if questions arise.


---

### Phase 3 — Admin Panel

- [ ] 9. Implement AdminModule (backend)
  - [ ] 9.1 Create `AuditLog` entity in `src/entities/audit-log.entity.ts` with fields: `id`, `action`, `actorId`, `targetType`, `targetId`, `metadata` (jsonb), `createdAt`
    - _Requirements: 3.3_
  - [ ] 9.2 Create `AuditLogInterceptor` in `src/admin/interceptors/audit-log.interceptor.ts` — logs all admin PATCH/DELETE mutations with actor, target type/id, and metadata snapshot
    - _Requirements: 3.4_
  - [ ]* 9.3 Write property test for audit log completeness (Property 6)
    - **Property 6: Audit Log Completeness**
    - **Validates: Requirements 3.4**
  - [ ] 9.4 Create `AdminModule` with `AdminController` and `AdminService` protected by `JwtAuthGuard + RolesGuard(['super_admin','admin'])`
    - Endpoints: `GET /admin/users`, `PATCH /admin/users/:id`, `DELETE /admin/users/:id`, `GET /admin/quizzes`, `DELETE /admin/quizzes/:id`, `GET /admin/stats`, `GET /admin/audit-log`
    - All list endpoints support `?page`, `?limit`, `?search`, `?sortBy`, `?sortOrder` query params
    - `GET /admin/stats` aggregates user count, quiz count, active Redis sessions count, confirmed payment revenue
    - _Requirements: 3.1, 3.2_
  - [ ]* 9.5 Write property test for role monotonicity (Property 3)
    - **Property 3: Role Monotonicity**
    - **Validates: Requirements 1.5, 3.1**


- [ ] 10. Install frontend admin dependencies and build admin UI
  - [ ] 10.1 Install frontend packages: `@tanstack/react-query ^5`, `@tanstack/react-table ^8`, `recharts ^2`, `react-hook-form ^7`, `zod ^3`, `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-tabs`
    - Copy shadcn/ui component source files (Button, Badge, Dialog, Input, Select, Table, Tabs) into `src/components/ui/`
    - Wrap app root in `<QueryClientProvider>` in `main.tsx`
    - _Requirements: 3.5_
  - [ ] 10.2 Create `AdminLayout` at `src/pages/admin/AdminLayout.tsx` — collapsible sidebar with nav links (Dashboard, Users, Quizzes, Organizations, Subscriptions, Payment Requests, Audit Log, Settings) and top bar with authenticated user info
    - _Requirements: 3.6_
  - [ ] 10.3 Create `admin/DashboardPage.tsx` — 4 StatCards (users, quizzes, sessions, revenue) + Recharts `<LineChart>` for signups over time
    - _Requirements: 3.7_
  - [ ] 10.4 Create `admin/UsersPage.tsx` — TanStack Table with server-side pagination/search/sort; `UserEditModal` with `react-hook-form` + `zod` for role and suspension editing
    - _Requirements: 3.7_
  - [ ] 10.5 Create `admin/QuizzesPage.tsx`, `admin/OrganizationsPage.tsx`, `admin/SubscriptionsPage.tsx` (with tier distribution pie chart), `admin/AuditLogPage.tsx`, `admin/SettingsPage.tsx`
    - _Requirements: 3.7_
  - [ ] 10.6 Wire admin routes in `App.tsx` behind `PrivateRoute allowedRoles={['super_admin','admin']}` at `/admin/*`
    - _Requirements: 3.8_

- [ ] 11. Phase 3 Checkpoint — Ensure all tests pass, ask the user if questions arise.


---

### Phase 4 — Billing & Subscription System

- [ ] 12. Create billing entities and install dependencies
  - [ ] 12.1 Create `Subscription` entity — OneToOne with User; fields: `billingModel` enum, `tier` enum, `creditBalance` int, `currentPeriodEnd` timestamptz|null, `sessionsUsedThisPeriod` int, `status` enum
    - _Requirements: 4.1_
  - [ ] 12.2 Create `PaymentRequest` entity — ManyToOne User; fields: `requestType` enum, `amountCents` int, `creditsToAdd` int, `ownerReference` text|null, `proofFileUrl` text|null, `status` enum, `reviewedBy` ManyToOne|null, `adminNote` text|null, `submittedAt`, `reviewedAt`
    - _Requirements: 4.2_
  - [ ] 12.3 Create `CreditTransaction` entity — append-only ledger; fields: `delta` int, `balanceAfter` int, `type` enum, `referenceId` uuid|null, `note` text|null, `createdAt`
    - _Requirements: 4.3_
  - [ ] 12.4 Install `@nestjs/schedule ^4` and `multer` + `@types/multer`; add `ScheduleModule.forRoot()` to `AppModule`
    - _Requirements: 4.9, 4.10_


- [ ] 13. Implement BillingModule services and endpoints
  - [ ] 13.1 Implement `CreditsService` — `addCredits`, `deductCredits` (both wrapped in TypeORM transaction with pessimistic lock), `getBalance`
    - Deduction must assert `creditBalance >= amount` before subtracting; throw `BadRequestException` if insufficient
    - Each mutation inserts an immutable `CreditTransaction` row
    - _Requirements: 4.4_
  - [ ]* 13.2 Write property test for credit balance consistency (Property 1)
    - **Property 1: Credit Balance Consistency**
    - **Validates: Requirements 4.3, 4.4**
  - [ ]* 13.3 Write property test for credit non-negativity (Property 5)
    - **Property 5: Session Credit Non-Negativity**
    - **Validates: Requirements 4.4, 4.7**
  - [ ] 13.4 Implement `BillingService.checkLimit` and `BillingService.checkFeature` with the static feature matrix (see design)
    - _Requirements: 4.4_
  - [ ] 13.5 Implement `PaymentRequestsService` — `submit` (owner), `list` (owner), `confirm` (admin: set status, call `addCredits`, upgrade tier if applicable), `reject` (admin: set status + note)
    - _Requirements: 4.5, 4.6_
  - [ ] 13.6 Create `BillingController` (owner endpoints: `GET /billing/me`, `POST /billing/payment-requests` with multer `FileInterceptor`, `GET /billing/payment-requests`, `GET /billing/transactions`, `GET /billing/bank-details`)
    - _Requirements: 4.5, 4.10_
  - [ ] 13.7 Add admin billing endpoints to `AdminController` (or a sub-controller): `GET /admin/billing/payment-requests`, `PATCH /admin/billing/payment-requests/:id/confirm`, `PATCH /admin/billing/payment-requests/:id/reject`, `POST /admin/billing/credits/adjust`
    - _Requirements: 4.6_
  - [ ] 13.8 Update `AuthService.register()` to auto-create a `free`-tier `Subscription` with `creditBalance: 0` for every new user
    - _Requirements: 4.8_
  - [ ] 13.9 Implement cron job in `BillingModule` using `@Cron(CronExpression.FIRST_DAY_OF_MONTH_AT_NOON)` — resets `sessionsUsedThisPeriod = 0` for all monthly subscribers whose period has ended
    - _Requirements: 4.9_
  - [ ] 13.10 Wire billing enforcement into `GameGateway` — call `checkLimit('session_start')` in `create_session` and `checkLimit('player_join')` in `join_session`; emit error events and return early if blocked
    - _Requirements: 4.7_
  - [ ] 13.11 Add billing environment variables to `packages/backend/.env`: `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_SORT_CODE`, `BANK_IBAN`, `BANK_REFERENCE_PREFIX`, `CREDIT_RATE_PER_DOLLAR=10`, `CREDIT_COST_SESSION_START=5`, `CREDIT_COST_PER_PLAYER=1`, `UPLOAD_STORAGE=local`, `UPLOAD_LOCAL_PATH=./uploads`
    - _Requirements: 4.11_


- [ ] 14. Build billing frontend pages and add admin payment UI
  - [ ] 14.1 Create `BillingPage` at `/settings/billing` — tier badge, credit balance gauge (progress bar), sessions used/quota, "Add Credits / Upgrade" CTA
    - Fetches `GET /billing/me`
    - _Requirements: 4.12_
  - [ ] 14.2 Create `TopUpPage` at `/settings/billing/topup` — amount input, plan radio group, static bank details section (from `GET /billing/bank-details`), reference input pre-filled with `KZT-<userId>`, optional proof file upload, submit button posting `multipart/form-data`
    - _Requirements: 4.12_
  - [ ] 14.3 Create `PaymentHistoryPage` at `/settings/billing/history` — table of past payment requests with colour-coded status badges (pending=yellow, confirmed=green, rejected=red)
    - _Requirements: 4.12_
  - [ ] 14.4 Create `admin/PaymentRequestsPage.tsx` — table of pending requests with inline Confirm/Reject actions and admin-note input field before confirming rejection
    - _Requirements: 3.7_
  - [ ] 14.5 Add plan gating UI to Owner Portal pages — show "Upgrade to unlock" prompts when `BillingService.checkFeature` would return false for the user's tier
    - _Requirements: 4.13_
  - [ ] 14.6 Display tier badge and credit balance in owner portal header (fetch from `GET /billing/me`)
    - _Requirements: 4.14_

- [ ] 15. Phase 4 Checkpoint — Ensure all tests pass, ask the user if questions arise.


---

### Phase 5 — Analytics

- [ ] 16. Implement analytics backend
  - [ ] 16.1 Create `QuestionStat` entity in `src/entities/question-stat.entity.ts` — fields: `id`, `gameSession` (ManyToOne), `question` (ManyToOne), `correctCount` int, `totalAnswers` int, `avgTimeTakenMs` int, `createdAt`
    - _Requirements: 5.1_
  - [ ] 16.2 Update `GameGateway.handleSubmitAnswer` to additionally write per-answer detail to Redis (`HSET session:<pin>:question:<qId>:detail:<userId> correct <0|1> timeTakenMs <ms>`) for analytics aggregation
    - _Requirements: 5.2_
  - [ ] 16.3 Create `SessionAnalyticsService` in `src/analytics/` — reads answer detail from Redis after `end_game`, computes per-question correctCount/totalAnswers/avgTimeTakenMs, bulk-inserts `QuestionStat` rows
    - _Requirements: 5.2_
  - [ ] 16.4 Create `AnalyticsModule` with `AnalyticsController` exposing `GET /analytics/quiz/:id` (quiz sessions + per-question stats, ownership-checked), `GET /analytics/overview` (owner totals), and `GET /admin/analytics` (platform-wide DAU/MAU/tier counts, admin-only)
    - _Requirements: 5.3_

- [ ] 17. Build analytics frontend pages
  - [ ] 17.1 Create `OwnerAnalyticsPage` at `/dashboard/quizzes/:id/analytics` — sessions table and Recharts `<BarChart>` of per-question correctness percentages
    - _Requirements: 5.4_
  - [ ] 17.2 Enhance `admin/DashboardPage.tsx` with: DAU `<LineChart>` (30 days), tier distribution `<PieChart>`, top quizzes `<BarChart>` — data from `GET /admin/analytics`
    - _Requirements: 5.5_

- [ ] 18. Final Checkpoint — Ensure all tests pass, ask the user if questions arise.


---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Phases MUST execute in order (1 → 2 → 3 → 4 → 5) — each phase depends on the previous
- The backend runs `synchronize: true` in development so entity changes auto-apply on restart
- All new REST endpoints must use `class-validator` DTOs for request validation
- All property tests reference specific correctness properties defined in `design.md`
- The `PrivateRoute` component (3.6) gates ALL protected routes across phases

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["2.4", "2.5"] },
    { "id": 3, "tasks": ["2.6", "2.7"] },
    { "id": 4, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 5, "tasks": ["3.4", "3.5", "3.6"] },
    { "id": 6, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 7, "tasks": ["5.4", "6.1"] },
    { "id": 8, "tasks": ["6.2", "6.3"] },
    { "id": 9, "tasks": ["6.4", "7.1"] },
    { "id": 10, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 11, "tasks": ["9.1", "9.2"] },
    { "id": 12, "tasks": ["9.3", "9.4"] },
    { "id": 13, "tasks": ["9.5", "10.1"] },
    { "id": 14, "tasks": ["10.2"] },
    { "id": 15, "tasks": ["10.3", "10.4", "10.5"] },
    { "id": 16, "tasks": ["10.6"] },
    { "id": 17, "tasks": ["12.1", "12.2", "12.3", "12.4"] },
    { "id": 18, "tasks": ["13.1"] },
    { "id": 19, "tasks": ["13.2", "13.3", "13.4"] },
    { "id": 20, "tasks": ["13.5"] },
    { "id": 21, "tasks": ["13.6", "13.7"] },
    { "id": 22, "tasks": ["13.8", "13.9", "13.11"] },
    { "id": 23, "tasks": ["13.10"] },
    { "id": 24, "tasks": ["14.1", "14.2", "14.3", "14.4"] },
    { "id": 25, "tasks": ["14.5", "14.6"] },
    { "id": 26, "tasks": ["16.1"] },
    { "id": 27, "tasks": ["16.2"] },
    { "id": 28, "tasks": ["16.3", "16.4"] },
    { "id": 29, "tasks": ["17.1", "17.2"] }
  ]
}
```
