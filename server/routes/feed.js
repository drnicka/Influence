const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const { listBallotsForFeed } = require('../lib/ballotStore');

// Inbox: personal/agent-created ballots
router.get('/inbox', authRequired, (req, res, next) => {
  try {
    const memberId = req.member?.id || null;
    res.json(listBallotsForFeed({ feed: 'inbox', memberId }));
  } catch (err) { next(err); }
});

// Subscribed: room ballots where you're a recipient
router.get('/subscribed', authRequired, (req, res, next) => {
  try {
    const memberId = req.member?.id || null;
    res.json(listBallotsForFeed({ feed: 'subscribed', memberId }));
  } catch (err) { next(err); }
});

// Public: ballots you created with visibility=public + vote counts
router.get('/public', authRequired, (req, res, next) => {
  try {
    const memberId = req.member?.id || null;
    res.json(listBallotsForFeed({ feed: 'public', memberId }));
  } catch (err) { next(err); }
});

module.exports = router;
