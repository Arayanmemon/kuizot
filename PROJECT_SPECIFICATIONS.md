# Kuizot - Real-Time Gamified Learning Platform

Kuizot is a web-based, real-time gamified learning platform and digital student response system, inspired by Kahoot. It enables Hosts to present interactive quizzes on a shared screen while Players join and submit answers in real-time using their personal devices.

## 🏗️ Technical Architecture

This project is built as an `npm` workspace monorepo encompassing the frontend and backend.

### 1. Database & Transient State (Data Layer)
- **Persistent Database:** PostgreSQL 15, managed via TypeORM. Stores non-volatile data such as `Users`, `Organizations`, `Quizzes`, `Questions`, and `Options`.
- **Transient Memory Cache:** Redis 7. Handles live, highly volatile game state, idempotency checks, and real-time leaderboards.
- **Infrastructure:** Configured natively via a root `docker-compose.yml` for isolated local development.

### 2. Backend (Nest.js)
- **Framework:** Nest.js (Node.js) written in TypeScript.
- **Real-Time Communication:** Utilizes `@nestjs/websockets` and `socket.io` to provide a full-duplex communication channel.
- **Horizontal Scaling:** Implements a custom `RedisIoAdapter` utilizing `@socket.io/redis-adapter` and `ioredis`. This enables multiple backend instances to share the Socket.IO Pub/Sub events dynamically.
- **Namespaces:** WebSockets are scoped to the `/game` namespace.

### 3. Frontend (React)
- **Framework:** React 19 bootstrapped with Vite.
- **Styling:** Tailwind CSS v4.
- **Routing:** `react-router-dom` mapping separate workflows:
  - `/`: Player Join Page
  - `/player`: Player Remote Control
  - `/host`: Host Dashboard & Broadcast Screen
- **State Management:** `zustand` manages the `socket` instance, session tokens, user nicknames, and the synchronization of game phases.

---

## 🎮 Core User Flow & Mechanics

The session lifecycle is heavily reliant on Redis data structures to ensure minimal latency and strict synchronization.

### Lobby Mapping (`HSET`)
Hosts generate unique 6-digit Game PINs on demand. Redis `HSET` maps `session:<pin>` to the session metadata (e.g., `host_id`, `status`, `current_question_id`).

### Atomic Idempotency (`SADD`)
When a player clicks an answer on their device, the backend uses Redis `SADD` against `session:<pin>:question:<question_id>:answers`. This atomic set operation ensures that even if a user double-clicks due to network latency, the answer is only recorded and scored once.

### Real-Time Leaderboards (`ZINCRBY` / `ZREVRANGE`)
Instead of calculating scores in PostgreSQL, player scores are maintained in Redis Sorted Sets (`session:<pin>:leaderboard`). `ZINCRBY` increments a player's score, and `ZREVRANGE` effortlessly returns the top `N` ordered players at the end of every round.

---

## 💯 Scoring Engine

The backend contains a robust `ScoringService` capable of dynamically applying points based on the active question's rule set.

### 1. Classic Mode (Speed & Accuracy)
A competitive mode that applies a time-based decay penalty to the score.
- **Sub-second answers (< 1000ms):** Awarded 100% of the maximum points.
- **Standard answers:** Linear decay between 1 second and the time limit.
- **Last-millisecond answers:** Decays to exactly a 50% minimum threshold.
- **Incorrect answers:** Awarded 0 points.

### 2. Accuracy Mode
An inclusive, low-stress alternative that strips out the speed decay element entirely. Players are awarded a fixed maximum point value purely for answering correctly.

### 3. Answer Streak Multiplier
To discourage blind guessing, the scoring engine utilizes a Redis `INCR` operation to track consecutive correct answers (`session:<pin>:user:<id>:streak`). 
- Multipliers increase by `+0.2x` for each correct answer in a streak.
- The multiplier is hard-capped at a maximum of `2.0x`.
- Any incorrect answer instantly resets the streak back to `0`.