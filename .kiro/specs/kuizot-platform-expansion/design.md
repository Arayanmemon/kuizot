# Design: Kuizot Platform Expansion

## Overview

This document describes the technical design for the five-phase Kuizot platform expansion. The existing stack is NestJS 11 + TypeORM + PostgreSQL + Redis + Socket.IO on the backend, and React 19 + Vite + Tailwind CSS v4 + Zustand v5 + React Router v7 on the frontend. All new backend code is TypeScript/NestJS. All new frontend code is TypeScript/React.

## Architecture

The system uses a monorepo with two packages: `packages/backend` (NestJS) and `packages/frontend` (React/Vite). The backend exposes REST endpoints (JWT-protected) and a Socket.IO gateway (`/game` namespace). PostgreSQL stores all persistent data. Redis handles live game session state. Frontend communicates via Axios for REST and socket.io-client for WebSocket events.

New modules are added as NestJS feature modules and registered in `AppModule`. New frontend pages are added as React Router routes guarded by `PrivateRoute`. No existing architecture is removed — only extended.

## Components and Interfaces

### Backend Module Boundaries

| Module | Path | Depends on |
|--------|------|-----------|
| AuthModule | `src/auth/` | User entity, JwtModule, PassportModule |
| QuizzesModule | `src/quizzes/` | Quiz, Question, Option entities, JwtAuthGuard |
| QuestionsModule | `src/questions/` | Question, Option entities, JwtAuthGuard |
| AdminModule | `src/admin/` | User, Quiz, AuditLog entities, JwtAuthGuard, RolesGuard |
| BillingModule | `src/billing/` | Subscription, PaymentRequest, CreditTransaction entities |
| AnalyticsModule | `src/analytics/` | GameSession, QuestionStat entities |
| GameModule (existing) | `src/game/` | SessionService, BillingService (Phase 4+) |

### Key TypeScript Interfaces

```typescript
// Auth token payload
interface JwtPayload { sub: string; role: UserRole; email: string; }

// Auth store shape
interface AuthState {
  accessToken: string | null;
  user: { id: string; role: UserRole; email: string; username: string } | null;
  setAuth(token: string, user: AuthUser): void;
  clearAuth(): void;
}

// Billing check result
interface LimitCheckResult { allowed: boolean; reason?: string; }

// Paginated response
interface PaginatedResponse<T> { data: T[]; total: number; page: number; limit: number; }
```

## Data Models

### Entity Changes Summary

| Entity | Change | Phase |
|--------|--------|-------|
| User | Add `passwordHash`, `role` enum, `refreshToken` | 1 |
| Quiz | Add `isPublic`, `playCount` | 2 |
| Question | Add `imageUrl` | 2 |
| GameSession (new) | pin, quiz, host, playerCount, leaderboardSnapshot, playedAt | 2 |
| AuditLog (new) | action, actorId, targetType, targetId, metadata | 3 |
| Subscription (new) | billingModel, tier, creditBalance, currentPeriodEnd, sessionsUsedThisPeriod, status | 4 |
| PaymentRequest (new) | requestType, amountCents, creditsToAdd, ownerReference, proofFileUrl, status, reviewedBy, adminNote | 4 |
| CreditTransaction (new) | delta, balanceAfter, type, referenceId, note | 4 |
| QuestionStat (new) | gameSession, question, correctCount, totalAnswers, avgTimeTakenMs | 5 |

### Subscription Tier Feature Matrix

| Feature | free | starter | pro | business |
|---------|------|---------|-----|----------|
| accuracy_mode | ❌ | ✅ | ✅ | ✅ |
| image_questions | ❌ | ❌ | ✅ | ✅ |
| session_history | ❌ | ✅ | ✅ | ✅ |
| per_question_analytics | ❌ | ❌ | ✅ | ✅ |
| team_orgs | ❌ | ❌ | ❌ | ✅ |

## Error Handling

- All NestJS controllers use `class-validator` DTOs; invalid requests return 400 with field-level error messages
- Ownership violations on quiz/question mutations return 403 Forbidden
- Invalid or expired JWT returns 401; the frontend interceptor auto-retries with a refreshed token
- Insufficient credits in GameGateway emits a typed error event (`session_error` / `join_error`) rather than throwing, so the WebSocket connection stays open
- Failed credit deductions throw `BadRequestException` (HTTP 400) from REST endpoints
- All admin mutations are wrapped in try/catch; failures do not write partial AuditLog entries

## Testing Strategy

- Unit tests (Jest) for `AuthService`, `CreditsService`, `BillingService.checkLimit`, and `BillingService.checkFeature`
- Property-based tests for the six correctness properties defined in the Correctness Properties section
- Integration tests for auth endpoints (register → login → refresh → logout flow)
- TypeORM `synchronize: true` is used throughout development; entity changes apply automatically on restart

---

## Phase 1 — Authentication & Identity

### Backend Architecture

#### Entity Changes (`packages/backend/src/entities/user.entity.ts`)

Add three columns to the existing `User` entity:

```typescript
@Column({ select: false })
passwordHash: string;

@Column({ type: 'enum', enum: ['super_admin', 'admin', 'owner'], default: 'owner' })
role: 'super_admin' | 'admin' | 'owner';

@Column({ type: 'text', nullable: true, select: false })
refreshToken: string | null;
```

`select: false` ensures password hash and refresh token are never returned in default queries.

#### Auth Module Structure

```
src/auth/
  auth.module.ts
  auth.controller.ts
  auth.service.ts
  strategies/
    local.strategy.ts       — passport-local, validates email+password
    jwt.strategy.ts         — passport-jwt, validates Bearer token
  guards/
    jwt-auth.guard.ts       — wraps AuthGuard('jwt')
    roles.guard.ts          — checks req.user.role against @Roles() metadata
  decorators/
    roles.decorator.ts      — @Roles(...roles)
    current-user.decorator.ts — @CurrentUser() extracts req.user
  dto/
    register.dto.ts         — { email, username, password }
    login.dto.ts            — { email, password }
```

#### AuthService Logic

```
register(dto):
  1. Check email not already taken (throw ConflictException if so)
  2. Hash password: bcrypt.hash(password, 10)
  3. Create User { email, username, passwordHash, role: 'owner' }
  4. Create free Subscription (Phase 4 prerequisite — auto-created here)
  5. Issue access token + refresh token
  6. Store refresh token on User
  7. Return { accessToken, refreshToken, user: { id, email, username, role } }

login(email, password):
  1. Find user by email (include passwordHash via addSelect)
  2. Throw UnauthorizedException if not found
  3. bcrypt.compare(password, user.passwordHash)
  4. Throw UnauthorizedException if mismatch
  5. Issue access token + refresh token
  6. Store refresh token on User
  7. Return { accessToken, refreshToken, user }

refresh(refreshToken):
  1. Find user by stored refreshToken
  2. Throw UnauthorizedException if not found or expired
  3. Rotate: issue new pair, update User.refreshToken
  4. Return new { accessToken, refreshToken }

logout(userId):
  1. Set User.refreshToken = null
```

#### JWT Strategy

The JwtStrategy reads `JWT_SECRET` from ConfigService and extracts the Bearer token from the `Authorization` header. It attaches `{ sub, role, email }` as `req.user`.

#### Endpoints

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | /auth/register | none | Register new owner account |
| POST | /auth/login | LocalGuard | Validate credentials, return tokens |
| POST | /auth/refresh | none (token in body) | Rotate refresh token |
| POST | /auth/logout | JwtAuthGuard | Clear refresh token |

#### Dependencies to Add (Backend)

```json
"@nestjs/jwt": "^10.2.0",
"@nestjs/passport": "^10.0.3",
"passport": "^0.7.0",
"passport-jwt": "^4.0.1",
"passport-local": "^1.0.0",
"bcrypt": "^5.1.1",
"@types/bcrypt": "^5.0.2",
"@types/passport-jwt": "^4.0.1",
"@types/passport-local": "^1.0.38",
"class-validator": "^0.14.1",
"class-transformer": "^0.5.1"
```

### Frontend Architecture

#### Auth Store (`src/store/authStore.ts`)

Zustand slice:

```typescript
interface AuthState {
  accessToken: string | null;
  user: { id: string; role: 'super_admin' | 'admin' | 'owner'; email: string; username: string } | null;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}
```

Persisted to `localStorage` via `zustand/middleware persist` so the user stays logged in across page reloads.

#### API Client (`src/lib/api.ts`)

Axios instance with:
1. Request interceptor: reads `accessToken` from `authStore`, sets `Authorization: Bearer <token>`
2. Response interceptor: on 401, calls `POST /auth/refresh`, updates store, retries original request once; if refresh also 401s, calls `clearAuth()` and navigates to `/login`

#### Pages

- `LoginPage` at `/login` — reuses the existing dark gradient + glass-card design language from `JoinPage`/`HostDashboard`
- `RegisterPage` at `/register` — same design
- Both pages call `api.post('/auth/login')` / `api.post('/auth/register')`, then call `setAuth(token, user)` and navigate to `/dashboard`

#### PrivateRoute Component

```typescript
// Renders outlet if authenticated, otherwise navigates to /login
function PrivateRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/login" />;
  return <Outlet />;
}
```

---

## Phase 2 — Owner Quiz CRUD Portal

### Backend Architecture

#### Entity Changes

**Quiz entity additions:**
```typescript
@Column({ default: false })
isPublic: boolean;

@Column({ type: 'int', default: 0 })
playCount: number;
```

**Question entity addition:**
```typescript
@Column({ type: 'text', nullable: true })
imageUrl: string | null;
```

**New `GameSession` entity** (`src/entities/game-session.entity.ts`):
```typescript
@Entity()
export class GameSession {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() pin: string;
  @ManyToOne(() => Quiz) quiz: Quiz;
  @ManyToOne(() => User) host: User;
  @Column({ type: 'int' }) playerCount: number;
  @Column({ type: 'jsonb' }) leaderboardSnapshot: LeaderboardEntry[];
  @CreateDateColumn() playedAt: Date;
}
```

#### QuizzesModule

`QuizzesService` performs all DB operations. `QuizzesController` is protected by `JwtAuthGuard`. Every write operation verifies `quiz.creator.id === req.user.sub` (ownership check) and throws `ForbiddenException` if it fails.

#### QuestionsModule

Handles question and option CRUD. All mutations verify the question belongs to a quiz owned by the authenticated user. `PATCH /questions/:id/reorder` accepts `{ order: number }` and updates the `order` column; service can reorder adjacent questions to maintain a contiguous sequence.

#### GameGateway Modifications

The `CreateSessionPayload` gains `quizId: string`. The `SessionService.createSession()` stores `quiz_id` in the Redis session hash:

```
HSET session:<pin> host_id <id> quiz_id <quizId> status waiting
```

The `StartQuestionPayload` is simplified to `{ pin: string; questionIndex: number }`. The handler:
1. Loads `quiz_id` from Redis
2. Queries `QuestionsService.getQuestionByIndex(quizId, questionIndex)` from PostgreSQL
3. Broadcasts `question_started` with data from the DB

The `end_game` handler:
1. Gets the final leaderboard from `LeaderboardService`
2. Creates a `GameSession` record via `SessionHistoryService`
3. Increments `quiz.playCount` by 1

### Frontend Architecture

#### Owner Dashboard (`src/pages/OwnerDashboard.tsx`)

Uses `@tanstack/react-query` (`useQuery`) to fetch `GET /quizzes`. Renders quiz cards. Each card has "Edit", "History", and "Host" actions.

#### Quiz Editor (`src/pages/QuizEditor.tsx`)

Loads `GET /quizzes/:id/questions`. Uses local state for the question list. Drag-to-reorder uses browser native drag events or a lightweight approach (no extra dep). On save, calls `PATCH /questions/:id/reorder` for each reordered item.

#### Host Flow

`HostDashboard` renders a quiz selector (list of own quizzes) before showing the lobby. On "Start Session", emits `create_session` with `{ hostId, quizId }`. The PIN generation flow is otherwise unchanged.

---

## Phase 3 — Admin Panel

### Backend Architecture

#### AdminModule

`src/admin/admin.module.ts` imports `TypeOrmModule.forFeature([User, Quiz, AuditLog, GameSession])`. All routes have `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('super_admin', 'admin')`.

#### AuditLog Entity (`src/entities/audit-log.entity.ts`)

```typescript
@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() action: string;         // e.g. 'UPDATE_USER_ROLE'
  @Column('uuid') actorId: string;
  @Column() targetType: string;     // e.g. 'User', 'Quiz'
  @Column('uuid') targetId: string;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown>;
  @CreateDateColumn() createdAt: Date;
}
```

#### AuditLogInterceptor

Implements `NestInterceptor`. Applied to all admin `PATCH` / `DELETE` routes via `@UseInterceptors(AuditLogInterceptor)`. Captures the route params, request body, and actor from `req.user`, then writes an `AuditLog` record after the handler resolves.

#### Stats Endpoint

`GET /admin/stats` aggregates:
- `COUNT(*)` on User table
- `COUNT(*)` on Quiz table
- Active sessions count from Redis (iterate `session:*` keys with status `active`)
- Revenue: sum of confirmed `PaymentRequest.amountCents`

#### Pagination Pattern

All list endpoints accept query params `?page=1&limit=20&search=&sortBy=createdAt&sortOrder=DESC`. The service uses TypeORM `findAndCount` with `skip`/`take`. Response shape: `{ data: T[]; total: number; page: number; limit: number }`.

### Frontend Architecture

#### TanStack Query Setup

`QueryClientProvider` wraps the app in `main.tsx`. A shared `queryClient` with `staleTime: 30_000`.

#### Admin Layout (`src/pages/admin/AdminLayout.tsx`)

React Router `<Outlet />` pattern. Sidebar links use `<NavLink>` for active highlighting. Collapsible state stored in `localStorage`. Sidebar nav items:
- Dashboard, Users, Quizzes, Organizations, Subscriptions, Payment Requests, Audit Log, Settings

#### Admin Pages Implementation

Each page uses a pattern of:
1. `useQuery` fetching paginated data
2. `DataTable` component (TanStack Table v8) rendering the response
3. `useMutation` for write actions (confirm, reject, delete, role change)

`UserEditModal` uses `react-hook-form` + `zod` for the edit form.

#### Admin Route Guard

Added in `App.tsx` as a nested `PrivateRoute` wrapping the `/admin/*` routes with `allowedRoles={['super_admin', 'admin']}`.

---

## Phase 4 — Billing & Subscription System

### Backend Architecture

#### New Entities

**Subscription** (`src/entities/subscription.entity.ts`) — OneToOne with User.
**PaymentRequest** (`src/entities/payment-request.entity.ts`) — ManyToOne with User; immutable status transitions: `pending → confirmed | rejected`.
**CreditTransaction** (`src/entities/credit-transaction.entity.ts`) — append-only ledger.

#### BillingModule Structure

```
src/billing/
  billing.module.ts
  billing.controller.ts       — owner endpoints
  billing.service.ts          — checkLimit, checkFeature
  credits/
    credits.service.ts        — addCredits, deductCredits, getBalance
  payment-requests/
    payment-requests.controller.ts   — admin + owner endpoints
    payment-requests.service.ts
```

#### CreditsService

All credit mutations are wrapped in a TypeORM transaction to maintain consistency:

```typescript
async deductCredits(userId, amount, type, referenceId?): Promise<void> {
  // transaction:
  // 1. SELECT FOR UPDATE subscription WHERE userId
  // 2. Assert creditBalance >= amount (throw InsufficientCreditsException otherwise)
  // 3. UPDATE subscription SET creditBalance = creditBalance - amount
  // 4. INSERT CreditTransaction { delta: -amount, balanceAfter: newBalance, type, referenceId }
}
```

#### BillingService.checkLimit

```typescript
async checkLimit(userId, limit):
  1. Load subscription
  2. If monthly + period active:
     a. session_start: sessionsUsedThisPeriod < tier.sessionQuota → allowed, else check credits
     b. player_join: check per-session player count in Redis < tier.playerCap → allowed, else check credits
  3. If payg or overage: check creditBalance >= CREDIT_COST_SESSION_START or CREDIT_COST_PER_PLAYER
  4. Free tier: 2 sessions/month, 10 players each — enforced same way
```

#### BillingService.checkFeature

Returns `true`/`false` based on a static feature matrix mapped to tiers:
```typescript
const FEATURE_MATRIX = {
  accuracy_mode: ['starter', 'pro', 'business'],
  image_questions: ['pro', 'business'],
  session_history: ['starter', 'pro', 'business'],
  per_question_analytics: ['pro', 'business'],
  team_orgs: ['business'],
};
```

#### File Upload (Multer)

`POST /billing/payment-requests` uses `@UseInterceptors(FileInterceptor('proof'))`. File is saved to `UPLOAD_LOCAL_PATH`. The absolute path (or relative URL) is stored in `PaymentRequest.proofFileUrl`.

#### Cron Job

`@nestjs/schedule` cron: `@Cron(CronExpression.FIRST_DAY_OF_MONTH_AT_NOON)` — queries all monthly subscriptions where `currentPeriodEnd < NOW()`, resets `sessionsUsedThisPeriod = 0`, advances `currentPeriodEnd` by 30 days.

#### Payment Confirmation Flow

`PATCH /admin/billing/payment-requests/:id/confirm`:
1. Set `PaymentRequest.status = 'confirmed'`, `reviewedAt = now`, `reviewedBy = actorId`
2. Call `CreditsService.addCredits(request.user.id, request.creditsToAdd, 'payment', request.id)`
3. If `requestType` is a tier (starter/pro/business): update `Subscription.tier`, set `currentPeriodEnd = now + 30 days`, set `billingModel = 'monthly'`

### Frontend Architecture

#### Billing Pages

Three new pages under `src/pages/settings/`:

**BillingPage**: Calls `GET /billing/me`. Shows tier badge (colour-coded), credit balance with a simple progress bar, sessions used / quota, and "Add Credits" CTA that navigates to `TopUpPage`.

**TopUpPage**: 
- Amount input (min $5)
- Plan radio group (Pay-as-you-go top-up, Starter $8, Pro $20, Business $50)
- Static bank details section rendered from environment variables passed through a `GET /billing/bank-details` endpoint (keeps secrets server-side)
- Reference input pre-filled with `KZT-<userId>`
- File input for proof screenshot
- On submit: `POST /billing/payment-requests` as `multipart/form-data`

**PaymentHistoryPage**: `useQuery` on `GET /billing/payment-requests`, rendered as a table with status badges (pending=yellow, confirmed=green, rejected=red).

---

## Phase 5 — Analytics

### Backend Architecture

#### QuestionStat Entity (`src/entities/question-stat.entity.ts`)

```typescript
@Entity()
export class QuestionStat {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => GameSession, { onDelete: 'CASCADE' }) gameSession: GameSession;
  @ManyToOne(() => Question, { onDelete: 'CASCADE' }) question: Question;
  @Column({ type: 'int' }) correctCount: number;
  @Column({ type: 'int' }) totalAnswers: number;
  @Column({ type: 'int' }) avgTimeTakenMs: number;
  @CreateDateColumn() createdAt: Date;
}
```

#### SessionAnalyticsService

Lives in `src/analytics/`. When `end_game` fires in `GameGateway`:
1. Collects all answers from Redis (`session:<pin>:question:<qId>:answers` sets + a new `answers_detail` hash written during `submit_answer`)
2. Computes per-question `correctCount`, `totalAnswers`, `avgTimeTakenMs`
3. Bulk-inserts `QuestionStat` rows
4. Updates `GameSession.playerCount`

To capture answer detail for analytics, `submit_answer` handler MUST additionally write to Redis:
```
HSET session:<pin>:question:<qId>:detail:<userId>  correct <0|1>  timeTakenMs <ms>
```
These keys expire with the session TTL (24h).

#### Analytics Endpoints

`GET /analytics/quiz/:id` — joins `GameSession` + `QuestionStat`, returns:
```json
{
  "sessions": [{ "id", "playedAt", "playerCount", "leaderboardSnapshot" }],
  "questionStats": [{ "questionId", "text", "correctPercent", "avgTimeTakenMs", "sessionId" }]
}
```

`GET /analytics/overview` — aggregates per owner:
```json
{ "totalSessions": number, "totalPlayers": number, "topQuiz": { id, title, playCount } }
```

`GET /admin/analytics` — admin-only, returns DAU/MAU from `GameSession.playedAt` grouped by day/month, quiz count over time, and subscription tier counts.

### Frontend Architecture

#### Owner Analytics Page (`src/pages/OwnerAnalyticsPage.tsx`)

Route: `/dashboard/quizzes/:id/analytics`. Fetches `GET /analytics/quiz/:id`. Renders:
- Sessions table with columns: date, player count, top scorer
- Recharts `<BarChart>` with one bar per question showing correctness percentage

#### Admin Dashboard Enhancements

Adds three chart components to `DashboardPage`:
- `<LineChart>` for DAU over 30 days (data from `GET /admin/analytics`)
- `<PieChart>` for tier distribution
- `<BarChart>` for top 10 quizzes by play count

---

## Data Flow Diagrams

### Auth Token Flow

```
Client                     Backend
  │  POST /auth/login          │
  │ ─────────────────────────► │ validate credentials
  │                            │ issue accessToken (15m JWT)
  │                            │ issue refreshToken (7d, store in DB)
  │ ◄───────────────────────── │ { accessToken, refreshToken }
  │                            │
  │  [15m later] 401 response  │
  │  POST /auth/refresh        │
  │ ─────────────────────────► │ validate refreshToken from DB
  │                            │ rotate (new pair, update DB)
  │ ◄───────────────────────── │ { accessToken, refreshToken }
```

### Billing Credit Deduction Flow (Game Session Start)

```
Host emits create_session { hostId, quizId }
        │
        ▼
GameGateway.handleCreateSession
        │
        ▼
BillingService.checkLimit(hostId, 'session_start')
        │
   allowed? ──No──► emit session_error: 'Insufficient credits'
        │
       Yes
        │
        ▼
CreditsService.deductCredits(hostId, CREDIT_COST_SESSION_START, 'session_start')
        │
        ▼
SessionService.createSession(hostId, quizId)  → generate PIN, store in Redis
        │
        ▼
emit session_created { pin }
```

---

## Correctness Properties

### Property 1: Credit Balance Consistency
After any `addCredits` or `deductCredits` call, the sum of all `CreditTransaction.delta` values for a user MUST equal the user's current `Subscription.creditBalance`. The ledger is the source of truth.

**Validates: Requirements 4.3, 4.4**

### Property 2: Refresh Token Single-Use
A refresh token that has been used once MUST be invalidated. Replaying the same refresh token a second time MUST return a 401. No two valid sessions should share the same refresh token.

**Validates: Requirements 1.4**

### Property 3: Role Monotonicity
A user's effective permissions with role `super_admin` MUST be a strict superset of `admin`, which MUST be a strict superset of `owner`. No route accessible to `owner` should be inaccessible to `admin` or `super_admin`.

**Validates: Requirements 1.5, 3.1**

### Property 4: Ownership Isolation
An authenticated owner MUST only be able to read, modify, or delete quizzes where `quiz.creator.id === user.id`. Any attempt to access another owner's quiz MUST result in a 403 Forbidden response.

**Validates: Requirements 2.3, 2.4**

### Property 5: Session Credit Non-Negativity
`Subscription.creditBalance` MUST never go below 0 after a deduction. If the requested deduction would make it negative, the deduction MUST be rejected with an `InsufficientCreditsException`.

**Validates: Requirements 4.4, 4.7**

### Property 6: Audit Log Completeness
Every admin `PATCH` or `DELETE` request that returns a 2xx response MUST have a corresponding `AuditLog` entry with the correct `actorId`, `targetType`, and `targetId`.

**Validates: Requirements 3.4**
