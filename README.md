# SaralBuy Backend (backend_v2)

Express 5 + Mongoose API for SaralBuy, a B2B construction-materials RFQ marketplace. Deployed on Render; MongoDB on Atlas.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in at least MONGODB_URI
npm run dev                  # nodemon, http://localhost:8000
```

See `.env.example` for every environment variable the app reads and which are required vs. optional. `JWT_SECRET` and `MONGODB_URI` are the only two that matter for local dev to boot; everything else degrades gracefully when unset (Redis caching falls back to in-memory, file uploads fall back to storing buffers in Mongo, non-dev NODE_ENV routes OTP through a real SMS provider instead of the dev stub).

## Testing

```bash
npm test
```

Runs the Vitest suite (`tests/`) against a real, isolated, in-memory MongoDB (`mongodb-memory-server`) spun up automatically per run — no external database or `.env` file needed to run tests, and nothing in the suite ever touches the real Atlas cluster. Tests import `src/app.js` directly via `supertest`, not `server.js`, so no port is bound and no socket/Redis connection is required.

When adding a test: hit the route through `supertest` against the exported `app`, not by calling controller functions directly — that way tests exercise the same middleware chain (auth, CORS, rate limiting) that real requests go through.

## CI

`.github/workflows/ci.yml` runs `npm test` on every push/PR to `main` — this is a required check, not advisory. If a change breaks it, fix the change or the test; don't disable the workflow.

## Architecture

For the current-state audit, forward-looking architecture strategy, and the phased implementation plan this project is executing against, see the reference documents linked from `CLAUDE.md` at the repository root (`../CLAUDE.md`) — Architecture Audit, Vision 2.0, and the Implementation Master Plan.

## Project structure

```
src/
  controllers/   business logic + request handling (service-layer extraction in progress, see Implementation Master Plan M3)
  routes/        Express route definitions, one file per resource
  models/        Mongoose schemas
  middleware/    auth, admin auth, rate limiting, request logging
  config/        env loading, secrets, DB/Redis/socket connection setup
  helpers/       shared response envelope (ApiResponse), Redis helper
  socket/        Socket.IO event handlers (chat, deal closure)
scripts/         one-off ops scripts (category seed/sync, admin seed) — not part of the app runtime
tests/           Vitest suite + shared setup (in-memory Mongo lifecycle)
```
