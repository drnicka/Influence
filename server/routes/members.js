const express = require('express');
const router = express.Router();
const { createMember, updateMember, listMembers } = require('../lib/memberStore');
const { createBallot } = require('../lib/ballotStore');
const { authRequired } = require('../middleware/auth');

// First ballot as calibration vote: a new member's inbox opens with a vote
// that teaches the QV loop and produces their first weighted context signal.
function seedCalibrationBallot(member) {
  return createBallot({
    title: 'Calibration — teach your agents how to work with you',
    description:
      'Your first vote doubles as your first context signal. You have 100 credits; each vote on an item costs votes². ' +
      'Agree (+) or disagree (−), and use comments to say why — agents read the weighted result back to calibrate how they work with you.',
    voteType: 'qv',
    credits: 100,
    visibility: 'personal',
    createdBy: member.id,
    distributedTo: [member.id],
    items: [
      {
        type: 'statement',
        title: 'Ask before acting',
        body: 'Agents should check with me before taking significant actions, even when confident.',
      },
      {
        type: 'statement',
        title: 'Terse over thorough',
        body: 'I prefer short, dense reports over full narratives.',
      },
      {
        type: 'statement',
        title: 'Bold proposals',
        body: 'Bring me ambitious options with risks stated, not just the safe increment.',
      },
      {
        type: 'statement',
        title: 'Push back',
        body: 'When my instruction seems wrong, agents should say so before executing.',
      },
      {
        type: 'statement',
        title: 'Ballots over chat',
        body: 'For prioritisation decisions, send me a ballot instead of asking in conversation.',
      },
    ],
  });
}

// Register a new member (no auth required — this is how you get a key)
router.post('/', (req, res, next) => {
  try {
    const { handle, displayName } = req.body || {};
    const member = createMember({ handle, displayName });

    // Best-effort: a failed seed must never block registration
    let calibrationBallotId = null;
    try {
      calibrationBallotId = seedCalibrationBallot(member).id;
    } catch (err) {
      console.error('[members] calibration ballot seed failed:', err.message);
    }

    // Return the plaintext API key exactly once
    res.status(201).json({
      id: member.id,
      handle: member.handle,
      displayName: member.displayName,
      apiKey: member.apiKey,
      createdAt: member.createdAt,
      calibrationBallotId,
      _notice: 'Save this API key — it will not be shown again.',
    });
  } catch (err) { next(err); }
});

// List all registered members (for discovery / invite)
router.get('/', authRequired, (req, res, next) => {
  try {
    res.json(listMembers());
  } catch (err) { next(err); }
});

// Get current member profile
router.get('/me', authRequired, (req, res) => {
  if (!req.member) {
    return res.json({ mode: 'single-user', member: null });
  }
  res.json(req.member);
});

// Update current member profile
router.patch('/me', authRequired, (req, res, next) => {
  try {
    if (!req.member) {
      return res.status(400).json({ error: 'Single-user mode — no member to update' });
    }
    const updated = updateMember(req.member.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Member not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
