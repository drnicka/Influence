# Conventions

Rules established through use. Each traces to a vote or a live failure.

## Ballots
- Personal ballots MUST set `distributedTo` — inboxes are member-scoped
  (consensus vote 24c880f9). Ballots without owner or audience are
  legacy-visible to everyone; don't create new ones.
- Workblock body headings: **Problem / Approach / DoD / Files / Effort**.
- State your recommendation on decision cards — the human's weights confirm
  or override; voting against the author is a first-class move.
- 3–6 cards per ballot. Credit resolution degrades beyond that.

## Reading results
- `creditsCost` desc = priority. Signed votes carry direction; magnitude is
  conviction. 100 credits, cost = votes².
- Results are weighted preference **at that time**. Show and keep the full
  distribution — low-weight intents are still signal.
- Credits-per-vote across voters = controversy meter. Expensive disagreement
  (many credits, few net votes) means escalate to the human.
- The highest-credit comment is constitutional; read it as a directive that
  may override the ballot's framing.

## Consensus rooms
- Human sponsor joins the room BEFORE ballot creation (learned the hard way:
  late voters currently require file surgery).
- Perspective agents vote independently, are prompted to a genuine lens, and
  must not hedge toward the middle.
- Default roles live in `roles/`; users craft their own on top of the default
  behaviour set.

## The influence/ folder pattern
- This folder was spawned by `influence init`. The ontology arrives by the
  two-vote Spawn protocol (see ORIENTATION.md): vote 1 weights repo
  priorities in plain language; vote 2 proposes workstreams as folders —
  + creates the folder, − declines it. Voting leads folder creation;
  nothing enters the ontology unvoted.
- After pushing any ballot, watch for its completion and act on the result.
  Push-and-stop is a protocol violation — a ballot nobody reads back is
  context thrown away.
- Review ballots (edit cards): + ratifies the document as written, − returns
  it with the comment as the correction. Re-push only returned documents.
  Drafted READMEs get reviewed in spawn-protocol vote 3.
- Workstream folders nest: `workstreams/<workstream>/<project>/<sub-project>`.
  Each level carries a short README stating intent — the rapid
  context-direction path.
- The context home (`~/.influence`) is a map, not a warehouse: it indexes
  registered repos and routes agents to them. Content lives here, in the
  host repo.
