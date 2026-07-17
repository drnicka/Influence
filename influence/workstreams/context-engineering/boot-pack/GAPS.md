# Boot test gaps log

## Draft 1 → 2 (2026-07-07, fresh-agent boot test)
Agent completed the loop but graded draft 1 as failing "vote-capable in one
read". Fixed in draft 2:
- Vote endpoint was entirely undocumented (critical) → added Cast a vote
  section with payload, item-id provenance, credit math, overwrite semantics
- Member id needed for distributedTo but not called out → documented + /me
- /context id semantics (personal = ballot id, room = results id) → stated
- Port hardcoded in examples → note to substitute VOICE_PORT
- Empty votes[] silently completed a ballot → server now rejects (400)
- Calibration ballot wording said humans-only → every member

Still open: workblock heading format is convention-only (nothing validates
body structure); triage of personal ballots by agents untested.
