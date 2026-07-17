# Context home v2 — plan (not yet built)

Mandate: ballot c8c4e644 (+3, "important, the ux will be important so it
doesn't get confusing — do this as a plan to start"). Builds on the ratified
architecture in DESIGN.md.

## What v2 adds

1. **Workstream indexing.** After an ontology vote lands in a spawned repo,
   the agent appends to `~/.influence/home.json` under that repo's entry:
   workstream names, weights from the vote, one-line intents, updatedAt.
   The home stays a map — summaries and pointers, never content.

2. **`influence home` becomes readable.** Today it lists repos; v2 prints
   the tree: repo → workstreams ordered by weight, with age markers so
   stale ontologies are visible ("voted 40 days ago").

3. **First portfolio ballot.** Generated *from* the index: one card per
   repo-workstream pair that's seen recent activity, question: "Across your
   repos, what gets attention this week?" Results write back to the home so
   any agent in any repo can read the current portfolio directive.

## UX guardrails (the "confusing" risk)

- Portfolio ballots appear in the same inbox as everything else, presented
  as just another ballot — never a separate "meta" surface (clarity
  condition from the ratified consensus).
- One naming rule: a workstream is always shown as `repo/workstream` at
  portfolio level, bare `workstream` inside its repo.
- The home index is regenerable from the repos at any time (`influence
  reindex`, future) — it must never become the thing you're afraid to
  delete.

## Sequence

1. Home schema: `repos[].workstreams[] = { name, weight, intent, votedAt }`
2. Agent convention in ORIENTATION: after vote 2, write the index entry
3. `influence home` tree view
4. Portfolio ballot generator (agent-side prompt pattern, no server change)
5. Results-to-home writeback

Effort: ~2h code + one live portfolio vote to validate. No server changes
required until writeback (5).
