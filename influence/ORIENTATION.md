# Influence — Agent Orientation

You are an agent working with Influence, a local-first
governance surface for context engineering. One page is enough to become
vote-capable. Read this, then act.

## The loop

```
You push a ballot → the human votes (quadratic) → you read weighted intent back
```

Votes are the context signal. `creditsCost` (votes²) is the weight; comments
carry the reasoning; negative votes are deprioritization signal. All signal is
signal — never discard low-weight items, and treat results as *weighted
preference at that time*, not permanent truth.

All examples use port 3001 — this repo's actual instance URL is in
`influence/influence.json` (`apiUrl`). Use that.

## Become a member

```bash
curl -X POST http://localhost:3001/api/members \
  -H 'Content-Type: application/json' \
  -d '{"handle":"my-agent","displayName":"My Agent"}'
# → { id: "<your-member-id>", apiKey: "vk_...", calibrationBallotId: ... }
```

The key is shown exactly once — send it as `X-Voice-Key` on every call.
**Save the `id` too**: it's your member id, needed for `distributedTo`
(recover it later via `GET /api/members/me`). Every new member gets a
calibration ballot — a human's first vote teaches you how they want to work.

## Push a ballot

```bash
curl -X POST http://localhost:3001/api/ballots \
  -H 'Content-Type: application/json' -H "X-Voice-Key: $KEY" \
  -d '{
    "title": "...",
    "description": "what this vote decides and how to spend credits",
    "voteType": "qv",
    "credits": 100,
    "visibility": "personal",
    "distributedTo": ["<recipient-member-id>"],
    "items": [ { "type": "workblock", "title": "...", "body": "..." } ]
  }'
```

Rules that matter:
- **Always set `distributedTo`** on personal ballots — inboxes are
  member-scoped; a ballot without an audience is visible only to you.
- Workblock bodies use the headings **Problem / Approach / DoD / Files /
  Effort**. Optional semantic fields: `workstream`, `ontologyKind`
  (`obligation|intent|experiment`), `costOfDrop` (`low|medium|high|critical`).
- Card types: `statement` (rapid ranking), `workblock` (executable slice),
  `question`, `theory`, `edit`, `image`, `decision`, `text`. Vote types:
  `qv` (default), `binary` (pick exactly one), `execution` (independent
  yes/no per card — see below).
- **Execution ballots (`"voteType": "execution"`)**: a queue of binary
  decisions, one Yes/No per card. Use after workblock votes to line up
  every decision you need for your best possible next turn — batch them
  into ONE ballot instead of asking one-by-one in chat. votes: 1 = yes,
  -1 = no, 0/absent = undecided. Each card declares its action; on close
  you execute the yes items (server stays inert), receipt the outcomes.
- The create response assigns item ids (`item-1`, `item-2`, …) — you need
  them to vote, so keep the response.

## Cast a vote

```bash
curl -X POST http://localhost:3001/api/ballots/<id>/vote \
  -H 'Content-Type: application/json' -H "X-Voice-Key: $KEY" \
  -d '{
    "votes": [
      { "itemId": "item-1", "votes": 5,  "comment": "why — agents read this" },
      { "itemId": "item-2", "votes": -2, "comment": "deprioritize because…" }
    ]
  }'
```

Mechanics: each item costs votes² credits; costs sum against the ballot's
`credits` budget (default 100) and the server rejects overspend. Under-
spending is fine — unspent credits are signal too. Submitting completes a
personal ballot; a later submit overwrites (use `POST /:id/revote` to reopen
properly). Room ballots accept one vote per member (409 on repeat).

## Watch for the vote — never push and stop

A pushed ballot is half a loop. After pushing, WAIT for the human's vote and
then act on it — poll until the status leaves `open`:

```bash
until [ "$(curl -s -H "X-Voice-Key: $KEY" $API/api/ballots/<id> \
        | grep -o '"status":"[^"]*"' | head -1)" != '"status":"open"' ]; do
  sleep 10
done
# now read the weighted result and ACT on it
```

If you can run background watchers, use one; otherwise poll in the
foreground. Either way: pushing a ballot obligates you to consume its
result. A ballot nobody reads back is context thrown away.

## Read the signal back

```bash
curl -H "X-Voice-Key: $KEY" http://localhost:3001/api/ballots/<id>            # full ballot + votes (JSON)
curl -H "X-Voice-Key: $KEY" -H 'Accept: text/markdown' \
     http://localhost:3001/api/ballots/<id>/context                           # weighted context pack
curl -H "X-Voice-Key: $KEY" http://localhost:3001/api/context/latest          # most recently voted ballot
curl -H "X-Voice-Key: $KEY" http://localhost:3001/api/context/rejections      # triage verdicts + reasons
```

`/context` takes the ballot's own id for completed personal ballots; room
ballots aggregate into a separate results ballot (id in the Subscribed feed)
— use that id.

Sort items by `creditsCost` descending for priority. Read every comment —
the highest-credit comment is load-bearing; comments often correct the
ballot's own framing.

## Rooms & consensus

Rooms hold multi-voter ballots. `POST /api/rooms` (name), `POST
/api/rooms/:id/invite` (by handle), then push with `"visibility":"room",
"roomId":...`. The ballot closes when every `distributedTo` member votes,
auto-generating a results ballot with per-voter breakdown.

Conventions learned in production:
- **The human sponsor joins the room BEFORE the ballot is created** — they
  vote as part of the consensus, they don't spectate it.
- Credits-per-vote is a controversy meter: cheap consensus (high votes, low
  credits) is a mandate; expensive disagreement flags where the human's
  judgment is needed.
- Triage verbs via `POST /api/ballots/:id/pass` `{ action: "pass"|"return"|"burn", comment }`:
  `pass` = weak rejection, `return` = regenerate from this feedback, `burn` =
  didn't meet standards. Read them back from `/api/context/rejections` —
  rejection is signal you must learn from.
- Late voter? `POST /api/ballots/:id/reopen` (room members/creator) syncs the
  audience with room membership; results regenerate in place on re-close.

## Spawn protocol — the first two votes in a fresh repo

When you arrive in a newly-spawned repo (this folder exists, `workstreams/`
is empty), run exactly this sequence. Keep the language concrete — these
ballots are for a person, not for you.

**Vote 1 — Repo priorities.** Scan the repo. Push a personal QV ballot
titled "What matters first in <repo-name>?" with 4–6 `statement` cards, each
a plain-language candidate priority you found in the code (features to
finish, debt to pay, questions to answer). No jargon, no ontology talk.
Watch for the vote, read the weights back.

**Vote 2 — Workstream folders.** Using the priority weights, push a second
ballot titled "Create workstreams for <repo-name>?" with description:
"Each card is a folder this vote creates under influence/workstreams/.
Vote + to create it, − to not create it. Your weights set the order of
attention." Each card = one proposed folder: kebab-case name as the title,
body saying in one or two sentences what work would live there. Watch for
the vote.

**Then act — the vote leads the folder creation:**
- net-positive item → create `workstreams/<name>/` with a README stating
  intent (include the vote weight and any comment)
- zero or negative item → do NOT create the folder; the ballot itself is
  the record of what was declined
- order the index in `workstreams/README.md` by weight

**Vote 3 — Review the drafted READMEs.** The READMEs you just wrote are the
one artifact every future agent reads — they don't skip the vote either.
Push a review ballot: one `edit` card per drafted document, the card body
IS the full markdown. Sign semantics: **+ ratifies the document as written;
− returns it, and the voter's comment is the correction** — revise the
returned docs and re-push only those until everything is ratified.

This review pattern isn't just for spawning: any agent-drafted markdown
(specs, plans, PR descriptions) can arrive as an edit-card review ballot.

**Image ballots — voting as curation.** Spawned in a folder of images?
Push items `{ "type": "image", "title": "<filename>", "imagePath":
"<absolute path>" }` — the server copies each image into the ballot (the
path never persists) and the UI renders them as votable cards. After the
vote, YOU execute the curation per the execution-ballot rules: weights are
the ranking, comments carry theme hints, and any file moves must have been
declared in the ballot description before the vote.

Nothing enters the ontology unvoted — not the folders, not the words in
them. The human's credits, not your scan, decide both.

## The ontology (`influence/workstreams/`)

The file system is the ontology: `workstreams/<workstream>/<project>/` nests
sub-projects. It is your rapid context-direction path — scan it before
proposing ballots, extend it as work develops. Folders exist because a vote
created them (see Spawn protocol above). See `CONVENTIONS.md` for the rules,
`roles/` for consensus perspective agents.
