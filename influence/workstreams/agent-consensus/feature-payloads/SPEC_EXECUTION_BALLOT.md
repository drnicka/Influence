# Execution ballot — spec draft v0 (voted +9: "spec it out")

A ballot whose completion triggers an action. Vote as the trigger; the
artifact as the receipt.

## Shape
- Ballot carries `executionKind` (e.g. `generate-deck`, `scaffold`, `sort-files`)
  and `binary` or `qv` vote mode. Items are the candidate outcomes.
- On close, the WATCHING AGENT executes the winning item — the server never
  executes anything. Voting stays inert data; agency stays with the agent
  that pushed the ballot. (This answers simplicity's side-effect objection:
  no new server surface at all.)
- The agent writes back a `receipt` comment on the results ballot: what was
  executed, where the artifact lives.

## Guardrails
- Execution is agent-side convention, documented in ORIENTATION — exactly
  like folder creation in spawn vote 2 (which is already an execution ballot
  in disguise; this spec just names the pattern).
- Destructive executions (delete/overwrite) require the ballot description
  to say so explicitly before the vote.

## First implementations
1. Spawn vote 2 (folders) — already live, retroactively the reference case.
2. Image ballot sort (thematic folders) — lands with the image payload.
3. Deck generation — revives the slides affordance when wanted.
