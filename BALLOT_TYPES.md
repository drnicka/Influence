# Ballot Types (Influence / Voice)

This doc captures *ballot-level* patterns and *card/item types* that inform both UX and data model.

## Mental model

- **Room** (future): container for people + norms + boards/views + ballots
- **Ballot**: a timeboxed voting session that produces a ranked/weighted signal
- **Card / Item**: the atom inside a ballot (what you vote on)

## Ballot-level vote modes

Ballots can specify a top-level `voteType` in frontmatter:
- `qv` (default): quadratic voting, signed integer votes per item, credits cost = votes².
- `binary`: choose exactly one item. Convention: selected item has `votes: 1` and costs `1` credit, all others `0`.

## Ballot types (product patterns)

### 1) Theory Ballot
**Use:** Compare explanatory frames (e.g., theories of mind, theories of consciousness).

- Items are `type: theory`
- Cards are markdown-first knowledge blocks
- Primary action: allocate credits to “usefulness / explanatory power / design relevance”

### 2) Statement Ballot
**Use:** Elicit a person’s working model by ranking statements.

- Items are `type: statement`
- Title-first (scanable), minimal/no body
- Comments are the *real payload*: definitions, edge cases, counterexamples, what would change your mind

### 3) Decision Ballot
**Use:** Choose a direction.

Two flavors:
- **QV decision**: allocate credits across options to express intensity (good for multi-constraint choices)
- **Yes/No decision**: binary vote per proposal (good for approvals / gating / checklists)

### 4) Workblock Ballot
**Use:** Pick the best next 60–120 minute slice.

- Items look like: verb + object + DoD
- Strong tie to “work produces tooling” and closure stamps

### 5) Triage Ballot
**Use:** Turn a messy backlog into a ranked short list.

- Items are short titles, possibly with tag + estimated effort
- Goal is to reduce ambiguity and set WIP limits

### 6) Calibration Ballot
**Use:** Capture preferences, principles, policies, thresholds.

- Items are statements about desired assistant/system behavior
- Output is durable constraints for future behavior

## Card / item types (render + schema)

These are `items[].type` values that should drive distinct rendering and (later) workflows.

### `theory`
Markdown knowledge block. Suggested sections:
- Core claim
- Mechanism
- Predictions/signatures
- Link to intelligence/design
- Critiques

### `statement`
Title-dominant, designed for rapid ranking.

UI notes:
- Bigger title typography ("impact" feel)
- Body optional, often empty
- Comment prompt tuned to: define terms, edge case, counterexample, update rule

### `question` (DRAFT)
Prompt-style card: designed to elicit a high-quality comment answer.

### `option`
Concrete choice with tradeoffs.

### `decision`
Yes/No oriented proposal; can include a recommended default.

### `experiment`
Hypothesis + method + stop condition + success metric.

### `obligation`
Due date + cost-of-drop + next action.

### `spec`
Structured requirements block (DoD, constraints, interfaces).

### `slide`
Slide card for building a deck (Voice → Slides → Labs).

Data fields (persisted on ballot create + on vote submit):
- `layout`: `bg-hero` | `two-col` (default explainer) | `text`
- `bullets`: string[] (3–5 ideal)
- `imagePrompt`: string (optional, used to generate image on export)
- `imageUrl`: string (optional, can be generated during export)

UI routing:
- `type: slide` → `SlideCard` (`client/src/components/SlideCard.jsx`)
- Vote controls support per-item `layout` + `imagePrompt` overrides

Export behavior:
- Only items with `votes > 0` are included in the exported deck, ordered by votes desc.

## Triggering typed cards (how the UI decides what to render)

- The server persists `items[].type` into ballot markdown frontmatter.
- The client routes rendering by `item.type`.

Current routing (client):
- `type: slide` → `SlideCard` (`client/src/components/SlideCard.jsx`)
- `type: statement` → `StatementCard` (`client/src/components/StatementCard.jsx`)
- `type: question` → `QuestionPromptCard` (`client/src/components/QuestionPromptCard.jsx`) **(draft)**
- other → default card renderer (`client/src/components/QuestionCard.jsx`) with markdown body rendering

## Formatting / rendering rules (current)

- Main card view can be rich markdown.
- VoteDistributor should remain one-line and scannable (titles only, optional tag).
- Typed rendering should route by `item.type`.

## Status

- StatementCard is **live**.
- QuestionPromptCard is **draft** (subject to redesign).
