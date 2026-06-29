# Classroom English Finance Game

Classroom web app for an English multiple-choice betting and personal finance simulation.

The teacher controls the round flow. Students join a numbered slot, answer questions, choose a Classroom Money bet, and see their wallet update after settlement.

## Current Scope

- React + TypeScript + Vite frontend
- Express + Socket.IO central server
- 26 numbered student slots
- Static 12-round English question set
- Teacher dashboard
- Student join and student game pages
- Slot claim/release
- Answer and bet submission
- Custom bet input when `cash + debt >= 100`
- Round timer with `+30 Seconds`, reopen, and restart controls
- Lock, reveal, settle, next round, and finish flow
- Server-authoritative cash, savings, debt, net worth, ranking, and audit log
- No loans, investments, or insurance actions yet

## Local Run

Install dependencies:

```bash
npm install
```

Build the frontend:

```bash
npm run build
```

Start the Express + Socket.IO server:

```bash
npm start
```

Open:

```text
http://localhost:3000/
```

Teacher:

```text
http://localhost:3000/teacher
```

Student join:

```text
http://localhost:3000/student
```

## Railway

Railway should use:

```text
Build Command: npm run build
Start Command: npm start
Healthcheck Path: /health
```

The server reads Railway's `PORT` environment variable automatically.

## Classroom Notes

- Students should join through `/student` and choose their assigned slot.
- The teacher can release a slot if a student chose the wrong one.
- Students cannot change cash, net worth, round status, or settlement from the UI.
- If a student submits nothing for a round, settlement sets their cash to `$0`.
- Current server state is in memory. If the Railway service restarts, the session resets. Add Postgres or Redis snapshot storage before using this for long multi-day sessions.
