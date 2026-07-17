const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const { startNewRound } = require('../lib/roundManager');

router.post('/new', authRequired, (req, res, next) => {
  try {
    const { regenLimit = 5 } = req.body || {};
    res.json(startNewRound({ regenLimit }));
  } catch (err) { next(err); }
});

module.exports = router;
