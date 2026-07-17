const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const { getBallot, listBallots } = require('../lib/ballotStore');
const { readLatestBallotContext } = require('../lib/latestBallotContext');
const { resultsToMarkdown, personalContextMarkdown } = require('../lib/resultsEngine');

// Latest-voted-ballot pointer + its context pack — the "what changed since I
// last looked" endpoint for agents.
router.get('/latest', authRequired, (req, res, next) => {
  try {
    const pointer = readLatestBallotContext();
    if (!pointer) return res.status(404).json({ error: 'No votes recorded yet' });

    const ballot = getBallot(pointer.ballotId);
    if (!ballot) return res.status(404).json({ error: 'Pointed ballot no longer exists', pointer });

    const markdown = ballot.isResults
      ? resultsToMarkdown(ballot)
      : ballot.status === 'completed'
        ? personalContextMarkdown(ballot)
        : null;

    if (req.headers.accept && req.headers.accept.includes('text/markdown') && markdown) {
      res.set('Content-Type', 'text/markdown');
      return res.send(markdown);
    }
    res.json({ pointer, ballotId: ballot.id, status: ballot.status, format: 'markdown', content: markdown });
  } catch (err) { next(err); }
});


// Rejection signal: what the human triaged away and why. Agents learn from
// what was rejected, not only from what was weighted.
router.get('/rejections', authRequired, (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query?.limit) || 20));
    const rows = listBallots()
      .filter(b => b.triageAction)
      .map(b => ({
        ballotId: b.id,
        title: b.title,
        action: b.triageAction,
        reason: b.burnComment || b.returnComment || b.passComment || '',
        at: b.burnedAt || b.returnedAt || b.passedAt || null,
        iterationRequestedAt: b.iterationRequestedAt || null,
      }))
      .sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0))
      .slice(0, limit);
    res.json({ count: rows.length, rejections: rows });
  } catch (err) { next(err); }
});

module.exports = router;
