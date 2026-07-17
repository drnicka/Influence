# Context Home — ratified architecture

Source: consensus ballot `e9c6e798` (design-council: drnick + simplicity +
capability + clarity, 4/4 voted 2026-07-07). Results: `d08a486f`. This is the
design spec for meta-Influence; weights below are the mandate strength.

## Ratified commitments

1. **Index, never copy** (+19, near-unanimous — strongest mandate to date)
   The home is a map, not a warehouse: workstream indexes, weighted-intent
   summaries, and paths into host repos. No sync engine, no divergence states.
   Nick's extension: installed globally, the home **navigates agents across
   the whole machine** — repo-scoped instances keep their own file structure;
   the home's job is routing agents to them.

2. **`influence init`** (+16) — one command drops the influence/ skeleton
   into a host repo and registers it with the home. Nick: this is the
   **go-to-market end of this cycle**. Clarity's condition: the dropped
   skeleton IS the documentation. Simplicity's condition: the CLI stays a
   dumb file-copier.

3. **One Voice instance serves all repos** (+14) — one inbox, N data
   sources. Federation returns when there's a second user, not before.

4. **Ontology by consent** (+12) — repo scans arrive as ballots; the human
   ratifies before anything enters the ontology. Nick: "the ballot before the
   first ontology is baked." Capability's condition (accepted): unratified
   scans stay queryable as **drafts** — the gate blocks ratification, not
   reading.

5. **Recursive governance** (+8, contested: capability +5, simplicity −3,
   settled by Nick +4) — the home is itself an Influence instance;
   portfolio-level intent gets weighted with the same QV mechanics.
   Clarity's condition: present it as just another ballot, never as "meta."
   Simplicity's dissent stands on record: watch for the index quietly
   becoming a second app.

## Rejected

6. **Calibration travels** (−1 net — first commitment rejected by
   consensus). Deferred, not killed: Nick wants the flow later, after
   defining what calibration votes actually are. Standing conditions from
   the dissent if revived: imported preferences must be visible and
   overridable in the UI (clarity), and the coupling/staleness cost must
   beat per-repo re-teaching (simplicity).

## Build order implied

`influence init` first (go-to-market), against a global home that starts as
a pure index + agent router. Scan-ballots (ontology by consent) ride on the
existing ballot mechanics. Portfolio ballots once the index exists.
