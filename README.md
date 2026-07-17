# Influence — local-first

Semantic ballot voting for agent context engineering. Agents push ballots;
you vote quadratically; agents read your weighted intent back. Local-first:
no LLM inside the app, no public surface, no cloud dependency — the agents
live outside and speak to the app through its API.

```
Agent pushes ballot → you vote (QV) → enriched markdown → agent reads weighted context
```

**Agents: read `influence/ORIENTATION.md` — one page makes you vote-capable.**

## Quick start

```bash
npm run install:all    # server + client deps
npm run dev            # API :3001 + UI :5173 (VOICE_PORT changes both)
```

Production: `npm run build && npm start` (API serves the built client).

First run is single-user (no auth). Registering the first member switches on
multi-user mode: every member gets an API key (`X-Voice-Key` header) and a
calibration ballot — their first vote teaches agents how to work with them.

## Semantic ballot voting

- **Quadratic**: 100 credits per ballot, a vote costs votes². Forces real
  prioritisation — you can't want everything equally.
- **Signed**: negative votes are deprioritization signal.
- **`creditsCost` is the weight**; comments carry reasoning. Results are
  weighted preference *at that time* — the full distribution is kept, low
  weights included. All signal is signal.
- **Binary** mode for pick-one execution decisions.

## Surfaces

| Surface | What it is |
|---------|-----------|
| Inbox | Personal ballots addressed to you (`distributedTo`) |
| Subscribed | Room ballots — multi-voter, auto-close at 100% turnout |
| Voted | Completed ballots + aggregated results ("weighted intents") |
| Triage | `pass` / `return` / `burn` instead of voting |

Rooms enable consensus: N voters (human or agent members) each spend their
own credits; the results ballot aggregates with per-voter breakdown. Default
perspective roles for agent voters live in `influence/roles/`.

## API (core)

| Method | Endpoint | |
|--------|----------|---|
| POST | `/api/members` | Register → API key (shown once) + calibration ballot |
| GET | `/api/ballots?feed=inbox\|subscribed\|all` | Member-scoped feeds |
| POST | `/api/ballots` | Push a ballot (set `distributedTo` on personal) |
| POST | `/api/ballots/:id/vote` | `{ votes: [{ itemId, votes, comment }] }` |
| GET | `/api/ballots/:id/context` | Aggregated context pack (markdown/JSON) |
| POST | `/api/ballots/:id/pass` | Triage `{ action: pass\|return\|burn, comment }` |
| POST | `/api/rooms` / `:id/invite` | Rooms for multi-voter consensus |
| POST | `/api/round/new` | Queue returned ballots for regeneration |
| GET | `/api/health` | `{ mode: "local-first", multiUser }` |

Full agent protocol, workblock format, and conventions: `influence/`.

## Storage

Flat markdown with YAML frontmatter — git-diffable, agent-readable, no
database. `data/ballots/*.md` (current), `data/history/` (every version),
per-voter votes as JSON beside room ballots. Writes are atomic.

## Router (optional)

An HMAC-signed envelope layer lets multiple instances federate rooms over a
local network (`/router/v1` relay + per-instance outbox/poller). Off unless
configured — see `.env.example`. A single instance needs none of it: agents
POST the API directly.

## Repo layout

```
server/          Express API (lib/ = engines, routes/ = surface)
client/          React + Vite + Tailwind UI
influence/       Agent boot pack: orientation, conventions, roles, ontology
shared/          Typed card builders
docs/            Specs and signoffs (includes pre-fork history)
```

## Lineage

This branch is the local-first fork (2026-07). The pre-fork product — in-app
BOSS agent, public ballots, slides export, cross-instance federation — lives
intact in git history and on `main`. Scope was set by vote: see ballots
`08c87a5d` (stays/goes) and `24c880f9` (UI consensus) in `data/ballots/`.
