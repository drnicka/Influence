# Influence — local test onboarding

Influence is a context-engineering tool built on **semantic
ballot voting**: your agent pushes ballots, you vote quadratically, the agent
reads your weighted intent back. Signal instead of chat archaeology — your
priorities arrive in the agent's context with weights attached.

Fifteen minutes to a working loop. You need Node 18+ and an agent that can
run shell commands (Claude Code assumed below).

## 1. Run the app (5 min)

```bash
git clone https://github.com/drnicka/influence.git
cd Influence
npm run install:all
npm run dev          # API :3001 + UI :5173
```

Open **http://localhost:5173**, register a handle, and **save your API key**
— agents authenticate with it, and it's shown exactly once.

Your inbox already has your first vote: a **calibration ballot**. Voting it
teaches you the mechanics (100 credits, a vote costs votes², agree/disagree,
comments carry your reasoning) and produces your first context signal —
literally teaching agents how you want to work.

## 2. Spawn Influence into your own repo (2 min)

```bash
cd Influence && npm link        # puts `influence` on your PATH (once)
cd /path/to/your/repo
influence init                  # drops influence/ + registers with ~/.influence
```

`influence/` contains everything an agent needs: `ORIENTATION.md` (one read
makes it vote-capable), `CONVENTIONS.md`, and default consensus roles.
`influence home` lists every repo you've spawned.

## 3. Point your agent at it

Paste into Claude Code (or any capable agent) inside your repo:

> Read `influence/ORIENTATION.md` and get yourself vote-capable. Then run the
> Spawn protocol: first push me a plain-language ballot on what matters most
> in this repo, watch for my vote, then propose workstream folders as a
> second ballot — plus creates a folder, minus declines it. Act on my weights.

Watch your inbox at :5173. Vote. The agent reads your weights back and the
folder structure it creates is the one your credits chose. From then on, ask
the agent to send you a ballot whenever a decision has real trade-offs.

## What to try next

- **Workblock ballots** — the agent proposes units of work
  (Problem/Approach/DoD), you weight the order, it builds top-down.
- **Triage** — instead of voting, Pass / Return / Burn a ballot with a
  reason; agents learn from rejection signal too (`/api/context/rejections`).
- **Agent consensus rooms** — several perspective agents (see
  `influence/roles/`) vote the same ballot to consensus; you close it as the
  human voter.
- **Room votes by QR** — `./scripts/present.sh` opens an HTTPS tunnel; create
  a public vote, put the QR on a screen, everyone votes from their phone,
  results tally into your inbox. Friendly-tier identity only — don't use for
  anything adversarial yet.

## Feedback

The tool eats its own dogfood: if something's rough, the maintainers will
turn your feedback into a ballot. Note especially: did the calibration ballot
teach the mechanics? Did your agent complete the spawn protocol unassisted?
Did the workstream folders match how you actually think about your repo?
