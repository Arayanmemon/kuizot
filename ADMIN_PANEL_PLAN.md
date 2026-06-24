# Kuizot — Admin Panel, Roles & Subscription Plan

> **Document purpose:** This is the living product and engineering plan for the next major evolution of Kuizot. It covers everything you need to know before writing a single line of code: what we're building, why, how it maps to the existing codebase, and in what order to implement it.

---

## 1. Context — Where We Are Today

The current codebase is a real-time quiz engine with three moving pieces:

| Layer | What exists |
|---|---|
| **Backend (NestJS)** | WebSocket game gateway, Redis-backed sessions/scoring/leaderboards, TypeORM entities for `User`, `Quiz`, `Question`, `Option`, `Organization` |
| **Frontend (React)** | Three routes: JoinPage `/`, PlayerView `/player`, HostDashboard `/host` |
| **Auth** | None. `userId` is generated client-side as a random string. No JWT, no sessions, no passwords. |

The entities already have a solid foundation — `User`, `Organization`, `Quiz`, `Question`, `Option` — but none of them are wired to REST endpoints or exposed through any authentication layer. Everything runs as an anonymous game engine right now.

---

## 2. What We're Building

Three interrelated product areas, delivered in phases:

```
Phase 1 — Authentication & Identity
Phase 2 — Role System (Admin / Owner / Player)
Phase 3 — Quiz Owner Portal (CRUD for quizzes)
Phase 4 — Admin Panel (user management, platform oversight)
Phase 5 — Subscription & Tier Enforcement
Phase 6 — Analytics & Reporting
```

Each phase is fully usable on its own and unblocks the next one.

---

## 3. Role Model

### 3.1 Roles

| Role | Who | What they can do |
|---|---|---|
| **super_admin** | Platform operator (you) | Full read/write on all users, quizzes, orgs, subscriptions, audit logs |
| **admin** | Org-level administrator | Manage users within their organization, view org analytics |
| **owner** | Quiz creator / educator | Create/edit/delete their own quizzes, host games, view their own analytics |
| **player** | End-user joining a game | Join sessions, submit answers — no persistent account required |

> **Design note:** `player` stays anonymous for now. A player creates a transient session identity (nickname + PIN) that lives only in Redis. Persistent player accounts (for tracking learning history) are a Phase 6+ concern.

### 3.2 Role Storage

Add a `role` column to the existing `User` entity:

```typescript
@Column({ type: 'enum', enum: ['super_admin', 'admin', 'owner'], default: 'owner' })
role: 'super_admin' | 'admin' | 'owner';
```

No separate `Role` entity is needed yet — a simple enum on `User` is sufficient until we need fine-grained permissions per organization.

---

## 4. Authentication Architecture

### 4.1 Strategy: JWT + Refresh Tokens

- **Access token:** Short-lived JWT (15 min), signed with `JWT_SECRET`
- **Refresh token:** Long-lived (7 days), stored in PostgreSQL (`refresh_token` column on `User`), rotated on every use
- No OAuth/SSO in Phase 1 — email + password only, bcrypt hashing

### 4.2 NestJS Modules to Add

```
src/
  auth/
    auth.module.ts
    auth.controller.ts      — POST /auth/register, POST /auth/login, POST /auth/refresh, POST /auth/logout
    auth.service.ts
    strategies/
      jwt.strategy.ts       — @nestjs/passport JwtStrategy
      local.strategy.ts     — username/password validation
    guards/
      jwt-auth.guard.ts
      roles.guard.ts
    decorators/
      roles.decorator.ts    — @Roles('admin', 'owner')
      current-user.decorator.ts
```

### 4.3 Dependencies to Add (Backend)

```json
"@nestjs/jwt": "^10.x",
"@nestjs/passport": "^10.x",
"passport": "^0.7.x",
"passport-jwt": "^4.x",
"passport-local": "^1.x",
"bcrypt": "^5.x",
"@types/bcrypt": "^5.x",
"@types/passport-jwt": "^4.x",
"@types/passport-local": "^1.x"
```

---

## 5. Owner Portal (Quiz CRUD)

### 5.1 What Owners Need

Owners are the quiz creators — the educators, trainers, or content makers using Kuizot to run sessions. They need:

- Create, edit, delete their own quizzes
- Add/edit/reorder questions and answer options
- Mark the correct answer per question
- Set scoring mode (classic/accuracy) and time limit per question
- View session history for their quizzes
- See per-question performance analytics (% correct, avg time)

### 5.2 New Backend Modules

```
src/
  quizzes/
    quizzes.module.ts
    quizzes.controller.ts   — CRUD: /quizzes, /quizzes/:id, /quizzes/:id/questions
    quizzes.service.ts
  questions/
    questions.module.ts
    questions.controller.ts — /questions/:id, /questions/:id/options
    questions.service.ts
  sessions-history/
    sessions-history.module.ts
    sessions-history.controller.ts
    sessions-history.service.ts
```

The `GameGateway` currently starts questions with a hardcoded mock. Phase 3 replaces that with a real quiz lookup: when the host emits `start_question`, the backend loads the question from PostgreSQL and broadcasts it — the frontend no longer needs to send `questionText` or `options`.

### 5.3 Entity Changes

**Quiz** — add `isPublic: boolean` and `playCount: number`

**Question** — already has most fields; add `imageUrl: string | null` for image questions (Pro tier feature)

**New: `GameSession` entity** — persists completed game sessions for analytics:

```typescript
@Entity()
export class GameSession {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() pin: string;
  @ManyToOne(() => Quiz) quiz: Quiz;
  @ManyToOne(() => User) host: User;
  @Column() playerCount: number;
  @Column('jsonb') leaderboardSnapshot: LeaderboardEntry[];
  @CreateDateColumn() playedAt: Date;
}
```

---

## 6. Admin Panel

### 6.1 Scope

The admin panel is a separate React SPA (or a protected route group in the existing frontend) reachable at `/admin`. Only `super_admin` and `admin` roles can access it.

### 6.2 Admin Panel Pages

| Page | What it shows |
|---|---|
| **Dashboard** | Platform KPIs: total users, quizzes, active sessions, revenue MRR, new signups chart |
| **Users** | Searchable/sortable table of all users with role, plan tier, created date, last active; actions: edit role, suspend, delete |
| **Quizzes** | All quizzes across all owners; sortable by play count, created date, owner; actions: view, delete, feature |
| **Organizations** | Org list; create/edit orgs; assign users to orgs |
| **Subscriptions** | All active/cancelled subscriptions; plan breakdown pie chart; manage individual user plans |
| **Audit Log** | Immutable log of admin actions (role changes, deletions, plan overrides) with timestamp and actor |
| **Settings** | Platform config: max players per plan tier, feature flags, maintenance mode toggle |

### 6.3 Frontend Tech Stack for Admin

The existing frontend uses Vite + React 19 + Tailwind CSS v4. The admin panel will live in the **same `packages/frontend` app** as a separate route group `/admin/**`, protected by a route guard.

New libraries to add:
- **shadcn/ui** — copy-paste component library (Dialog, Table, Badge, Select, Tabs, etc.) built on Radix UI + Tailwind. Zero extra bundle cost since it's source-copied.
- **TanStack Table v8** — headless table for the Users and Quizzes pages with server-side pagination, sorting, filtering
- **TanStack Query v5** (`@tanstack/react-query`) — data fetching/caching for all admin REST calls
- **Recharts** — lightweight chart library for the dashboard KPI widgets (already in ecosystem)
- **React Hook Form + Zod** — forms and validation for user edit, quiz edit modals

### 6.4 Admin Frontend Structure

```
src/
  pages/
    admin/
      AdminLayout.tsx        — sidebar nav + top bar wrapper
      DashboardPage.tsx
      UsersPage.tsx
      QuizzesPage.tsx
      OrganizationsPage.tsx
      SubscriptionsPage.tsx
      AuditLogPage.tsx
      SettingsPage.tsx
  components/
    admin/
      StatCard.tsx           — KPI widget
      DataTable.tsx          — TanStack Table wrapper
      UserEditModal.tsx
      PlanBadge.tsx
  hooks/
    admin/
      useUsers.ts
      useQuizzes.ts
      useSubscriptions.ts
```

---

## 7. Billing & Subscription System

### 7.1 Our Differentiator — Hybrid Billing Model

Competitors (Kahoot, Mentimeter) use a single axis: a flat monthly subscription that unlocks a player cap. We're doing something different: **two billing axes that can be combined**.

| Axis | What it charges | Who it suits |
|---|---|---|
| **Per-quiz + per-player** | Pay only for what you actually use — a fixed fee per quiz session started, plus a per-player fee for everyone who joins | Occasional users, teachers running one-off events, organisations hosting rare large sessions |
| **Monthly subscription** | Flat monthly fee that includes a quota of quiz sessions and players | Regular users who host frequently and want predictable costs |

An owner can be on either model at any time. The admin can switch them. Both models enforce the same feature set based on their active plan tier.

---

### 7.2 Pricing Structure

#### Pay-as-you-go (Per-Quiz + Per-Player)

| Component | Rate | Notes |
|---|---|---|
| **Session start fee** | $0.50 / quiz session | Charged every time a host starts a new game |
| **Player fee** | $0.10 / player / session | Charged per unique player who joins |
| **Free allowance** | 2 sessions / month, up to 10 players each | Always free — no credit needed |

> **Example:** A teacher runs a quiz with 35 students → $0.50 session fee + (35 × $0.10) = **$4.00 total**

#### Monthly Subscription Tiers

| Tier | Price | Sessions included | Players / session | Rollover |
|---|---|---|---|---|
| **Free** | $0 | 2 | 10 | No |
| **Starter** | $8 / mo | 20 | 50 | No |
| **Pro** | $20 / mo | 100 | 200 | No |
| **Business** | $50 / mo | Unlimited | 500 | — |

If a subscriber exceeds their included sessions or player cap in a given month, overage is charged at the pay-as-you-go rates above.

#### Feature Access by Tier

| Feature | Free / Pay-as-you-go | Starter | Pro | Business |
|---|---|---|---|---|
| Classic scoring | ✅ | ✅ | ✅ | ✅ |
| Accuracy mode | ❌ | ✅ | ✅ | ✅ |
| Image questions | ❌ | ❌ | ✅ | ✅ |
| Session history & analytics | ❌ | ✅ | ✅ | ✅ |
| Per-question analytics | ❌ | ❌ | ✅ | ✅ |
| Team orgs / multi-admin | ❌ | ❌ | ❌ | ✅ |
| Custom branding | ❌ | ❌ | ❌ | ✅ |

---

### 7.3 Manual Payment Flow (No Payment Gateway)

Since payments are collected manually via bank transfer, we need an internal approval workflow. Here is the complete lifecycle:

```
Owner requests plan / top-up
       ↓
System creates a pending PaymentRequest record
       ↓
Owner receives bank account details (shown in UI + email)
       ↓
Owner transfers money to the bank account
       ↓
Owner marks transfer as "submitted" and optionally uploads a screenshot / reference number
       ↓
Admin reviews the submission in the Admin Panel
       ↓
Admin clicks "Confirm Payment" → credits are applied to the owner's account
       ↓  (or)
Admin clicks "Reject" with a note → owner is notified to retry
```

This keeps full control with you and costs zero in payment processing fees.

---

### 7.4 Credit & Balance System

Rather than activating a time-limited subscription directly, confirmed payments load a **credit balance** onto the owner account. Credits are then spent automatically as sessions are used.

**Why credits instead of direct activation?**
- Handles partial payments gracefully
- Works equally for both billing models (subscription quota and pay-as-you-go both deduct from the same pool)
- Admin can add bonus credits manually (e.g., refunds, promotions)
- Transparent to the owner — they always see exactly how much credit remains

**Credit rates:**
- $1 = 10 credits
- Starting a session: 5 credits
- Each player joining: 1 credit
- Subscription tiers: each tier purchase loads a credit bundle that covers the monthly quota

---

### 7.5 New Entities

#### `Subscription` — tracks the owner's current plan and credit balance

```typescript
@Entity()
export class Subscription {
  @PrimaryGeneratedColumn('uuid') id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  // Billing model: 'payg' = pay-as-you-go, 'monthly' = flat subscription
  @Column({ type: 'enum', enum: ['payg', 'monthly'], default: 'payg' })
  billingModel: 'payg' | 'monthly';

  // Active feature tier — set by admin after payment confirmation
  @Column({ type: 'enum', enum: ['free', 'starter', 'pro', 'business'], default: 'free' })
  tier: 'free' | 'starter' | 'pro' | 'business';

  // Credit balance (integer units). Deducted per session start and per player join.
  @Column({ type: 'int', default: 0 })
  creditBalance: number;

  // For monthly subscribers: when does the current period end?
  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodEnd: Date | null;

  // How many sessions have been used in the current billing period
  @Column({ type: 'int', default: 0 })
  sessionsUsedThisPeriod: number;

  @Column({ default: 'active' })
  status: 'active' | 'suspended' | 'expired';

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

#### `PaymentRequest` — one record per payment submission by an owner

```typescript
@Entity()
export class PaymentRequest {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  // What they're paying for
  @Column({ type: 'enum', enum: ['payg_topup', 'starter', 'pro', 'business'] })
  requestType: 'payg_topup' | 'starter' | 'pro' | 'business';

  // Amount the owner claims to have sent (in USD, stored as cents)
  @Column({ type: 'int' })
  amountCents: number;

  // Credits to be added on approval (calculated from amountCents)
  @Column({ type: 'int' })
  creditsToAdd: number;

  // Reference number or note provided by the owner (e.g., bank transfer ref)
  @Column({ type: 'text', nullable: true })
  ownerReference: string | null;

  // Optional proof screenshot stored as a file path / URL
  @Column({ type: 'text', nullable: true })
  proofFileUrl: string | null;

  @Column({ type: 'enum', enum: ['pending', 'confirmed', 'rejected'], default: 'pending' })
  status: 'pending' | 'confirmed' | 'rejected';

  // Admin who reviewed this request
  @ManyToOne(() => User, { nullable: true })
  reviewedBy: User | null;

  // Admin note on rejection
  @Column({ type: 'text', nullable: true })
  adminNote: string | null;

  @CreateDateColumn() submittedAt: Date;
  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;
}
```

#### `CreditTransaction` — immutable ledger of every credit movement

```typescript
@Entity()
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  // Positive = credit added, Negative = credit spent
  @Column({ type: 'int' })
  delta: number;

  @Column({ type: 'int' })
  balanceAfter: number;

  @Column({ type: 'enum', enum: ['payment', 'session_start', 'player_join', 'admin_adjustment', 'refund'] })
  type: 'payment' | 'session_start' | 'player_join' | 'admin_adjustment' | 'refund';

  // Optional reference: PaymentRequest id, GameSession id, etc.
  @Column({ type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn() createdAt: Date;
}
```

---

### 7.6 Backend: Billing Module

```
src/
  billing/
    billing.module.ts
    billing.controller.ts
    billing.service.ts
    payment-requests/
      payment-requests.controller.ts   — POST /billing/payment-requests (owner submits)
      payment-requests.service.ts
    credits/
      credits.service.ts               — deductCredits(), addCredits(), getBalance()
```

**Key endpoints:**

| Method | Path | Role | Purpose |
|---|---|---|---|
| `GET` | `/billing/me` | owner | Get own subscription status, credit balance, tier |
| `POST` | `/billing/payment-requests` | owner | Submit a new payment request |
| `GET` | `/billing/payment-requests` | owner | List own payment requests |
| `GET` | `/billing/transactions` | owner | Credit transaction history |
| `GET` | `/admin/billing/payment-requests` | admin | List all pending requests |
| `PATCH` | `/admin/billing/payment-requests/:id/confirm` | admin | Approve request, credit the account |
| `PATCH` | `/admin/billing/payment-requests/:id/reject` | admin | Reject with a note |
| `POST` | `/admin/billing/credits/adjust` | super_admin | Manually add/remove credits |

---

### 7.7 Credit Deduction in the Game Gateway

The `GameGateway` calls `CreditsService` at two points:

1. **`create_session` event** — deduct session-start credits (5 credits). If balance is insufficient and the owner is on pay-as-you-go with no credits, emit `session_error: 'Insufficient credits'` and block session creation.

2. **`join_session` event** — deduct per-player credit (1 credit). If the session has already hit the owner's player cap (based on tier), emit `join_error: 'Player limit reached'` to the joining player.

Monthly subscribers with active period get these deductions waived until their included quota is exhausted, at which point the same credit deduction kicks in as overage.

---

### 7.8 Frontend: Billing Pages

```
src/pages/settings/
  BillingPage.tsx          — current plan, credit balance, usage meter, upgrade CTA
  TopUpPage.tsx            — enter amount, show bank details, submit reference
  PaymentHistoryPage.tsx   — list of past payment requests + status badges
```

**BillingPage** shows:
- Current tier badge (Free / Starter / Pro / Business)
- Credit balance with a visual gauge (e.g., "340 credits remaining")
- Billing model toggle (Pay-as-you-go vs Monthly) — switching model sends a request to the admin
- Sessions used this period (for monthly subscribers)
- "Add Credits / Upgrade" button → goes to TopUpPage

**TopUpPage** shows:
- Amount input (min $5)
- Plan selection (pay-as-you-go credit top-up or select a monthly tier)
- Bank account details (account number, sort code, reference to include)
- Transfer reference input + optional screenshot upload
- Submit button creates the `PaymentRequest`

**Admin Panel — Payment Requests page** (added to the existing admin section 6.2):
- Table of all pending `PaymentRequest` records with: owner name, amount, type, submitted date, reference, proof link
- "Confirm" and "Reject" actions inline
- Rejected requests show an admin note field before confirming rejection
- Confirmed requests show a success toast and trigger the credit addition server-side

---

### 7.9 Subscription Enforcement Architecture

`BillingService.checkLimit()` and `BillingService.checkFeature()` are injected into the gateway and REST controllers:

```typescript
// Returns true if the action is allowed, false if blocked
async checkLimit(userId: string, limit: 'session_start' | 'player_join'): Promise<{ allowed: boolean; reason?: string }>
async checkFeature(userId: string, feature: 'accuracy_mode' | 'image_questions' | 'session_history' | 'per_question_analytics' | 'team_orgs'): Promise<boolean>
```

The logic inside `checkLimit`:
1. Load the user's `Subscription`
2. For monthly subscribers in an active period: check `sessionsUsedThisPeriod` against the tier quota
3. For pay-as-you-go or overages: check `creditBalance >= cost`
4. Return `{ allowed: false, reason: 'Insufficient credits' }` if blocked

A seeder (or the `AuthService.register()` method) creates a default `free`-tier `Subscription` with `creditBalance: 0` for every new user.

---

## 8. Analytics

### 8.1 What to Track

- **Per quiz:** play count, avg score, avg completion rate, per-question correctness %
- **Per session:** player count, duration, final leaderboard snapshot
- **Per owner:** total games hosted, total players reached, top-performing quiz
- **Platform-wide (admin):** DAU, MAU, quiz creation rate, session count over time, revenue

### 8.2 How to Store It

- **Real-time session data** stays in Redis (existing pattern)
- **Post-game analytics** are written to PostgreSQL when a game ends via a `SessionAnalyticsService`
- **New entity: `QuestionStat`** — records correctness %, avg answer time per question per session

### 8.3 Frontend Charts

Use **Recharts** (small, composable, Tailwind-friendly). Charts needed:
- Line chart: new users / sessions over time (Dashboard)
- Bar chart: top quizzes by play count (Quizzes page)
- Pie chart: subscription tier distribution (Subscriptions page)
- Heatmap table: per-question performance (Owner analytics page)

---

## 9. Implementation Phases — Detailed Order

### Phase 1 — Authentication (Backend + Frontend)

**Backend tasks:**
1. Add `passwordHash`, `role`, `refreshToken` columns to `User` entity
2. Create `AuthModule` with `AuthService`, `LocalStrategy`, `JwtStrategy`
3. Add `JwtAuthGuard` and `RolesGuard`
4. Expose `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
5. Add `@nestjs/jwt`, `passport-jwt`, `passport-local`, `bcrypt` dependencies
6. Add `JWT_SECRET` and `JWT_EXPIRES_IN` to `.env`

**Frontend tasks:**
7. Create `AuthContext` (or Zustand slice) storing `accessToken`, `user` (id, role, email)
8. Create `LoginPage` at `/login` and `RegisterPage` at `/register` with the existing gradient design system
9. Create a `PrivateRoute` wrapper that redirects unauthenticated users to `/login`
10. Protect `/host` route behind auth — only `owner` and above can access it
11. Add `Authorization: Bearer <token>` header to all future REST calls via an Axios/fetch interceptor
12. Add token refresh logic (intercept 401, refresh, retry)

---

### Phase 2 — Owner Quiz CRUD Portal

**Backend tasks:**
1. Create `QuizzesModule` with full CRUD endpoints protected by `JwtAuthGuard` + `owner` role check
2. Create `QuestionsModule` for managing questions and options within a quiz
3. Modify `GameGateway`: when host emits `start_question`, look up the question from PostgreSQL using `quizId` stored in Redis session — no more client-sent `questionText`/`options`
4. Add `GameSession` entity and write to it when `end_game` fires

**Frontend tasks:**
5. Create Owner Portal at `/dashboard` with quiz list, create/edit quiz forms
6. Quiz editor: add/remove questions, reorder (drag-and-drop), set correct answer
7. Host flow: host selects a quiz, then the existing lobby/game flow uses the real quiz data
8. Session history page showing past games per quiz

---

### Phase 3 — Admin Panel (Frontend + Backend)

**Backend tasks:**
1. Add admin-only REST endpoints: `GET /admin/users`, `PATCH /admin/users/:id`, `GET /admin/quizzes`, `GET /admin/stats`, `GET /admin/audit-log`
2. Create `AuditLogModule` — interceptor that logs all admin mutations to a `audit_log` table
3. Create `StatsService` aggregating platform-wide KPIs from PostgreSQL + Redis

**Frontend tasks:**
4. Install shadcn/ui components (copy Dialog, Table, Badge, Select, Tabs, Button, Input into `src/components/ui/`)
5. Install TanStack Query v5 and TanStack Table v8
6. Build `AdminLayout` with collapsible sidebar
7. Build all 7 admin pages (Dashboard, Users, Quizzes, Orgs, Subscriptions, Audit Log, Settings)
8. Add admin route guard: redirect non-admin users back to `/dashboard`

---

### Phase 4 — Billing & Subscription System

**Backend tasks:**
1. Add `Subscription`, `PaymentRequest`, and `CreditTransaction` entities
2. Create `BillingModule` with `BillingService`, `CreditsService`, `PaymentRequestsService`
3. Expose owner billing endpoints: `GET /billing/me`, `POST /billing/payment-requests`, `GET /billing/transactions`
4. Expose admin billing endpoints: `GET /admin/billing/payment-requests`, `PATCH /admin/billing/payment-requests/:id/confirm`, `PATCH /admin/billing/payment-requests/:id/reject`, `POST /admin/billing/credits/adjust`
5. Implement `BillingService.checkLimit()` and `checkFeature()` — inject into `GameGateway` and quiz controllers
6. Wire credit deduction into `GameGateway`: deduct on `create_session` (session-start cost) and `join_session` (per-player cost); block with descriptive errors if insufficient
7. Auto-create a `free`-tier `Subscription` with zero credit balance for every new user in `AuthService.register()`
8. Implement period reset job: a scheduled task (NestJS `@nestjs/schedule` cron) resets `sessionsUsedThisPeriod` at the start of each billing period for monthly subscribers

**Frontend tasks:**
9. Create `BillingPage` at `/settings/billing` — tier badge, credit balance gauge, usage meter, "Add Credits / Upgrade" CTA
10. Create `TopUpPage` at `/settings/billing/topup` — amount input, plan selector, bank account details display, transfer reference input, optional proof screenshot upload
11. Create `PaymentHistoryPage` at `/settings/billing/history` — table of past payment requests with status badges (pending / confirmed / rejected)
12. Add "Payment Requests" page to the Admin Panel (extends Phase 3 admin pages) — table of all pending requests with inline Confirm/Reject actions and admin note field
13. Add plan gating UI throughout the Owner Portal — show "Upgrade to unlock" prompts when a feature is blocked by tier
14. Show tier badge and credit balance in the owner portal header

---

### Phase 5 — Analytics

**Backend tasks:**
1. Create `SessionAnalyticsService` that writes to `QuestionStat` and `GameSession` on game end
2. Add analytics endpoints: `GET /analytics/quiz/:id`, `GET /analytics/overview`

**Frontend tasks:**
3. Owner analytics page: session history table, per-question correctness bar chart
4. Admin dashboard charts: DAU line chart, tier distribution pie, top quizzes bar

---

## 10. Database Migration Strategy

The project currently uses `synchronize: true` (TypeORM auto-sync). This is fine for development but must be switched to **TypeORM migrations** before any production data exists.

**Steps when ready:**
1. Set `synchronize: false` in `TypeOrmModule` config
2. Add `migrations: [__dirname + '/migrations/**/*{.ts,.js}']` to config
3. Generate migrations: `npx typeorm migration:generate -n AddAuthFields`
4. Run: `npx typeorm migration:run`

Until then, `synchronize: true` remains convenient — every entity change auto-applies on restart.

---

## 11. New Environment Variables

```env
# Auth
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Billing — bank account details shown in the UI to owners making transfers
BANK_ACCOUNT_NAME="Kuizot Ltd"
BANK_ACCOUNT_NUMBER=00000000
BANK_SORT_CODE=00-00-00
BANK_IBAN=GB00XXXX00000000000000
BANK_REFERENCE_PREFIX=KZT   # prepended to userId so admins can match transfers

# Billing — credit rates (can be tuned without code changes)
CREDIT_RATE_PER_DOLLAR=10        # 1 USD = 10 credits
CREDIT_COST_SESSION_START=5      # credits deducted when a session is created
CREDIT_COST_PER_PLAYER=1         # credits deducted per player who joins

# File upload for payment proof screenshots (local or S3-compatible)
UPLOAD_STORAGE=local             # 'local' | 's3'
UPLOAD_LOCAL_PATH=./uploads
```

---

## 12. New File/Module Map (Full Picture)

```
packages/backend/src/
  auth/                         ← Phase 1
  users/                        ← Phase 1 (expose user management endpoints)
  quizzes/                      ← Phase 2
  questions/                    ← Phase 2
  sessions-history/             ← Phase 2
  admin/                        ← Phase 3
    admin.module.ts
    admin.controller.ts
    admin.service.ts
    audit-log/
  subscription/                 ← Phase 4
  billing/                      ← Phase 4 (manual payments, credits)
    billing.module.ts
    billing.controller.ts
    billing.service.ts
    credits/
      credits.service.ts
    payment-requests/
      payment-requests.controller.ts
      payment-requests.service.ts
  analytics/                    ← Phase 5
  common/
    guards/                     ← Phase 1 (shared across all modules)
    decorators/
    interceptors/
    dto/

packages/frontend/src/
  pages/
    LoginPage.tsx               ← Phase 1
    RegisterPage.tsx            ← Phase 1
    OwnerDashboard.tsx          ← Phase 2
    QuizEditor.tsx              ← Phase 2
    admin/                      ← Phase 3
      AdminLayout.tsx
      DashboardPage.tsx
      UsersPage.tsx
      ...
    settings/
      BillingPage.tsx           ← Phase 4 (plan, credits, usage)
      TopUpPage.tsx             ← Phase 4 (bank details + proof upload)
      PaymentHistoryPage.tsx    ← Phase 4 (request status tracking)
  store/
    authStore.ts                ← Phase 1 (new Zustand slice)
  components/
    ui/                         ← shadcn/ui components (Phase 3)
    admin/                      ← admin-specific components (Phase 3)
  hooks/
    useAuth.ts                  ← Phase 1
    admin/                      ← Phase 3
```

---

## 13. Recommended Tech Additions Summary

| Layer | Addition | Reason |
|---|---|---|
| Backend | `@nestjs/jwt`, `passport-jwt`, `bcrypt` | Authentication |
| Backend | `@nestjs/passport`, `passport-local` | Login strategy |
| Backend | `@nestjs/schedule` | Cron job to reset monthly billing periods |
| Backend | `multer` + `@types/multer` | Payment proof screenshot uploads |
| Backend | `class-validator`, `class-transformer` | DTO validation on all new endpoints |
| Backend | TypeORM migrations | Safe schema evolution |
| Frontend | `shadcn/ui` (copied components) | Admin UI primitives |
| Frontend | `@tanstack/react-query` v5 | REST data fetching/caching |
| Frontend | `@tanstack/react-table` v8 | Admin data tables |
| Frontend | `recharts` | Analytics charts |
| Frontend | `react-hook-form` + `zod` | Form validation |
| Frontend | `axios` | HTTP client with interceptors for JWT refresh |

---

## 14. What to Build First

The single most important unlock is **Phase 1 (Authentication)**. Nothing else — admin panel, quiz CRUD, subscriptions — makes sense without knowing *who* the user is. Every subsequent phase depends on a real `User` identity with a `role`.

**Suggested sprint order:**
1. JWT auth backend (register + login + refresh) — 1–2 days
2. Frontend login/register pages + authStore — 1 day
3. Quiz CRUD backend + owner portal frontend — 3–4 days
4. Admin panel (backend endpoints + React pages) — 4–5 days
5. Billing system (entities + credit engine + manual payment flow + admin approval UI) — 3–4 days
6. Analytics (post-game writes + charts) — 2–3 days

---

*This document should be revisited and updated as each phase ships. Phase definitions are intentionally scope-limited so that each phase can be delivered, tested, and used independently.*
