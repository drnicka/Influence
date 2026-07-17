const express = require('express');
const router = express.Router();
const { listBallots, listBallotsForFeed, getBallot, createBallot, getHistory, updateBallotFields, publishPublicBallot } = require('../lib/ballotStore');
const { submitVotes, reopenBallot } = require('../lib/voteEngine');
const { passBallot } = require('../lib/triageEngine');
const { synthesizeExecutionBallot } = require('../lib/synthesizer');
const { authRequired } = require('../middleware/auth');
const { saveVote, getAllVotesForBallot, hasVoted, getVoteCount } = require('../lib/voteStore');
const { validateVoteInput } = require('../lib/validate');
const { isMember, getRoom } = require('../lib/roomStore');
const { checkExpiredBallots } = require('../lib/expiryCheck');
const { getComments, addReply } = require('../lib/commentStore');
const { closeBallot } = require('../lib/ballotStore');
const QRCode = require('qrcode');
const { resultsToMarkdown, personalContextMarkdown, generateResults } = require('../lib/resultsEngine');
const config = require('../lib/config');
const { maybePublishVoteSubmitted } = require('../lib/routerPhaseB');
const { writeLatestBallotContext } = require('../lib/latestBallotContext');

router.get('/', authRequired, (req, res, next) => {
  try {
    // Check expiry on each list request
    checkExpiredBallots();

    const feed = req.query.feed || 'all';
    const memberId = req.member?.id || null;
    res.json(listBallotsForFeed({ feed, memberId }));
  } catch (err) { next(err); }
});

function publicUrlFor(req, ballot) {
  const host = req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const baseUrl = config.publicBaseUrl || `${proto}://${host}`;
  return ballot?.shareSlug ? `${baseUrl}/vote/${ballot.shareSlug}` : null;
}

// Publish a draft public ballot: mints the share slug and public URL.
router.post('/:id/publish-public', authRequired, (req, res, next) => {
  try {
    const ballot = getBallot(req.params.id);
    if (!ballot) return res.status(404).json({ error: 'Ballot not found' });
    if (ballot.visibility !== 'public') {
      return res.status(400).json({ error: 'Only public ballots can be published' });
    }
    if (req.member && ballot.createdBy && ballot.createdBy !== req.member.id) {
      return res.status(403).json({ error: 'Only the creator can publish this public ballot' });
    }

    const updated = publishPublicBallot(req.params.id);
    res.json({
      id: updated.id,
      publicationStatus: updated.publicationStatus,
      shareSlug: updated.shareSlug,
      publishedAt: updated.publishedAt,
      publicUrl: publicUrlFor(req, updated),
    });
  } catch (err) { next(err); }
});

// QR code (SVG) for the public vote URL — point a phone at the projector.
router.get('/:id/qr.svg', authRequired, async (req, res, next) => {
  try {
    const ballot = getBallot(req.params.id);
    if (!ballot) return res.status(404).json({ error: 'Ballot not found' });
    const url = publicUrlFor(req, ballot);
    if (!url) return res.status(400).json({ error: 'Ballot has no public URL — publish it first' });

    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 480 });
    res.set('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) { next(err); }
});

// Close an ephemeral public vote and tally: results land in the creator's feed.
router.post('/:id/close-public', authRequired, (req, res, next) => {
  try {
    const ballot = getBallot(req.params.id);
    if (!ballot) return res.status(404).json({ error: 'Ballot not found' });
    if (ballot.visibility !== 'public') {
      return res.status(400).json({ error: 'Only public ballots can be closed this way' });
    }
    if (req.member && ballot.createdBy && ballot.createdBy !== req.member.id) {
      return res.status(403).json({ error: 'Only the creator can close this ballot' });
    }
    if (ballot.status !== 'open') {
      return res.status(409).json({ error: 'Ballot is not open' });
    }

    const results = generateResults(ballot.id);
    closeBallot(ballot.id);
    res.json({ ok: true, ballotId: ballot.id, resultsBallotId: results.id, voterCount: results.voterCount });
  } catch (err) { next(err); }
});

// Serve a ballot's ingested images (no auth: <img> tags can't send headers,
// and public image votes need them anonymously). Only files ingested at
// ballot creation are reachable — never arbitrary paths.
router.get('/:id/images/:itemId', (req, res, next) => {
  try {
    const ballot = getBallot(req.params.id);
    if (!ballot) return res.status(404).json({ error: 'Ballot not found' });
    const item = (ballot.items || []).find(i => i.id === req.params.itemId);
    if (!item || !item.imageFile) return res.status(404).json({ error: 'No image for this item' });

    const path = require('path');
    const imagesDir = path.resolve(config.ballotsDir, ballot.id, 'images');
    const file = path.join(imagesDir, path.basename(item.imageFile));
    res.sendFile(file, err => { if (err) next(); });
  } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {
  try {
    const ballot = getBallot(req.params.id);
    if (!ballot) return res.status(404).json({ error: 'Ballot not found' });
    res.json(ballot);
  } catch (err) { next(err); }
});

router.post('/', authRequired, (req, res, next) => {
  try {
    const body = { ...req.body };

    // Attach creator identity if in multi-user mode
    if (req.member) {
      body.createdBy = req.member.id;
    }

    // Room ballot: validate room membership, set distributedTo
    if (body.visibility === 'room' && body.roomId) {
      if (req.member && !isMember(body.roomId, req.member.id)) {
        return res.status(403).json({ error: 'You are not a member of this room' });
      }
      const room = getRoom(body.roomId);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      // Distribute to all room members
      body.distributedTo = room.members;
    }

    // Public ballots always start as draft and are published explicitly.
    if (body.visibility === 'public') {
      body.publicationStatus = 'draft';
      delete body.shareSlug;
      delete body.publishedAt;
    }

    const ballot = createBallot(body);
    res.status(201).json(ballot);
  } catch (err) { next(err); }
});

router.post('/:id/vote', authRequired, (req, res, next) => {
  try {
    const { votes } = req.body;
    if (!votes || !Array.isArray(votes) || votes.length === 0) {
      return res.status(400).json({ error: 'votes array required (non-empty)' });
    }

    const ballot = getBallot(req.params.id);
    if (!ballot) return res.status(404).json({ error: 'Ballot not found' });

    const visibility = ballot.visibility || 'personal';

    // --- Room/public ballot: per-voter storage ---
    if (visibility === 'room' || visibility === 'public') {
      const memberId = req.member?.id;
      const handle = req.member?.handle || 'anonymous';

      if (visibility === 'room' && memberId) {
        if (!Array.isArray(ballot.distributedTo) || !ballot.distributedTo.includes(memberId)) {
          return res.status(403).json({ error: 'You are not a recipient of this ballot' });
        }
        if (hasVoted(ballot.id, memberId)) {
          return res.status(409).json({ error: 'You have already voted on this ballot' });
        }
      }

      // Validate votes against ballot
      validateVoteInput(votes, ballot);

      // Calculate credits
      const voteType = (ballot.voteType || 'qv').toLowerCase();
      let creditsUsed = 0;
      const processedItems = votes.map(v => {
        const cost = voteType === 'execution'
          ? (v.votes ? 1 : 0)
          : voteType === 'binary' ? (v.votes ? 1 : 0) : (v.votes || 0) * (v.votes || 0);
        creditsUsed += cost;
        return {
          itemId: v.itemId,
          votes: voteType === 'execution' ? Math.sign(v.votes || 0) : (v.votes || 0),
          creditsCost: cost,
          comment: v.comment || '',
        };
      });

      saveVote(ballot.id, memberId || handle, {
        memberId: memberId || null,
        handle,
        instanceId: config.router.instanceId || null,
        items: processedItems,
        creditsUsed,
        votedAt: new Date().toISOString(),
      });

      const votePayload = {
        items: processedItems,
        creditsUsed,
        votedAt: new Date().toISOString(),
      };

      writeLatestBallotContext({
        ballotId: ballot.id,
        source: visibility === 'room' ? 'vote.submit.room' : 'vote.submit.public',
        memberId: memberId || null,
        votedAt: votePayload.votedAt,
      });

      setImmediate(async () => {
        try {
          const out = await maybePublishVoteSubmitted({
            ballot,
            voter: { memberId: memberId || null, handle },
            vote: votePayload,
          });
          if (out?.ok) {
            console.log(`[router] Published vote.submitted for ballot ${ballot.id} -> ${out.published.targetInstanceId}`);
          }
        } catch (err) {
          console.error(`[router] Failed to publish vote.submitted for ballot ${ballot.id}:`, err.message);
        }
      });

      // Check if all voted → trigger close + results
      checkExpiredBallots();

      const count = getVoteCount(ballot.id);
      const total = Array.isArray(ballot.distributedTo) ? ballot.distributedTo.length : 0;

      return res.json({
        ok: true,
        ballotId: ballot.id,
        votesSubmitted: count,
        votesExpected: total,
      });
    }

    // --- Personal ballot: inline vote (existing behavior) ---
    const result = submitVotes(req.params.id, votes);
    if (!result) return res.status(404).json({ error: 'Ballot not found' });

    writeLatestBallotContext({
      ballotId: result.id,
      source: 'vote.submit.personal',
      memberId: req.member?.id || null,
      votedAt: result.votedAt || new Date().toISOString(),
    });

    // Optional: auto-generate an execution ballot when a QV ballot completes.
    const vt = String(result.voteType || 'qv').toLowerCase();
    const autoExec = String(process.env.VOICE_AUTO_EXECUTION_BALLOTS || '').trim() === '1';
    let executionBallot = null;

    if (autoExec && result.status === 'completed' && vt === 'qv') {
      try {
        executionBallot = synthesizeExecutionBallot(result.id, { topN: 3 });
      } catch (e) {
        console.error('[synthesizer] execution ballot synthesis failed', e);
      }
    }

    res.json({
      ...result,
      executionBallotId: executionBallot?.id || null,
      executionBallotTitle: executionBallot?.title || null,
    });
  } catch (err) { next(err); }
});

// Get all votes for a ballot (room members or creator only)
router.get('/:id/votes', authRequired, (req, res, next) => {
  try {
    const ballot = getBallot(req.params.id);
    if (!ballot) return res.status(404).json({ error: 'Ballot not found' });
    res.json(getAllVotesForBallot(ballot));
  } catch (err) { next(err); }
});


// Reopen a room ballot for late voters. Syncs distributedTo with current room
// membership; on re-close the results ballot regenerates in place.
router.post('/:id/reopen', authRequired, (req, res, next) => {
  try {
    const ballot = getBallot(req.params.id);
    if (!ballot) return res.status(404).json({ error: 'Ballot not found' });
    if (ballot.visibility !== 'room') {
      return res.status(400).json({ error: 'Only room ballots can be reopened' });
    }

    const room = getRoom(ballot.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (req.member && !room.members.includes(req.member.id) && ballot.createdBy !== req.member.id) {
      return res.status(403).json({ error: 'Only room members or the creator can reopen' });
    }

    const audience = Array.from(new Set([...(ballot.distributedTo || []), ...room.members]));
    const updated = updateBallotFields(ballot.id, {
      status: 'open',
      distributedTo: audience,
      reopenedAt: new Date().toISOString(),
    });

    res.json({ ok: true, id: updated.id, status: updated.status, distributedTo: updated.distributedTo });
  } catch (err) { next(err); }
});

router.post('/:id/revote', authRequired, (req, res, next) => {
  try {
    const result = reopenBallot(req.params.id);
    if (!result) return res.status(404).json({ error: 'Ballot not found' });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/:id/pass', authRequired, (req, res, next) => {
  try {
    const { action, comment } = req.body || {};
    const result = passBallot(req.params.id, { action, comment });
    if (!result) return res.status(404).json({ error: 'Ballot not found' });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/:id/synthesize-execution', authRequired, (req, res, next) => {
  try {
    const { topN = 3 } = req.body || {};
    const result = synthesizeExecutionBallot(req.params.id, { topN: Number(topN) });
    if (!result) return res.status(404).json({ error: 'Ballot not found' });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

router.get('/:id/history', authRequired, (req, res, next) => {
  try {
    res.json(getHistory(req.params.id));
  } catch (err) { next(err); }
});

// Get agent context pack (markdown) for a results ballot
router.get('/:id/context', authRequired, (req, res, next) => {
  try {
    const ballot = getBallot(req.params.id);
    if (!ballot) return res.status(404).json({ error: 'Ballot not found' });

    let markdown;
    if (ballot.isResults) {
      markdown = resultsToMarkdown(ballot);
    } else if (ballot.status === 'completed') {
      markdown = personalContextMarkdown(ballot);
    } else {
      return res.status(400).json({ error: 'Context packs are available for results ballots and completed ballots' });
    }

    // Return as markdown or JSON depending on Accept header
    if (req.headers.accept && req.headers.accept.includes('text/markdown')) {
      res.set('Content-Type', 'text/markdown');
      return res.send(markdown);
    }
    res.json({ ballotId: ballot.id, sourceBallotId: ballot.sourceBallotId, format: 'markdown', content: markdown });
  } catch (err) { next(err); }
});

// Get threaded comments for a ballot
router.get('/:id/comments', authRequired, (req, res, next) => {
  try {
    const ballot = getBallot(req.params.id);
    if (!ballot) return res.status(404).json({ error: 'Ballot not found' });
    res.json(getComments(req.params.id));
  } catch (err) { next(err); }
});

// Add a threaded reply to a comment
router.post('/:id/comments', authRequired, (req, res, next) => {
  try {
    const ballot = getBallot(req.params.id);
    if (!ballot) return res.status(404).json({ error: 'Ballot not found' });

    const { parentId, itemId, text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

    const reply = addReply(req.params.id, {
      parentId: parentId || null,
      itemId: itemId || null,
      handle: req.member?.handle || 'anonymous',
      memberId: req.member?.id || null,
      text: text.trim(),
    });
    res.status(201).json(reply);
  } catch (err) { next(err); }
});

module.exports = router;
