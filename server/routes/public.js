const express = require('express');
const crypto = require('crypto');

const { findBallotByShareSlug, verifyPublicPassword } = require('../lib/ballotStore');
const { validateVoteInput, ValidationError } = require('../lib/validate');
const { savePublicVote, hasPublicVoted } = require('../lib/voteStore');
const { checkExpiredBallots } = require('../lib/expiryCheck');

const router = express.Router();

function sanitizePublicBallot(ballot) {
  return {
    id: ballot.id,
    title: ballot.title,
    description: ballot.description,
    status: ballot.status,
    voteType: ballot.voteType || 'qv',
    credits: ballot.credits || 100,
    endsAt: ballot.endsAt || null,
    items: (ballot.items || []).map(i => ({
      id: i.id,
      type: i.type || 'text',
      title: i.title || '',
      body: i.body || '',
      semanticTag: i.semanticTag || '',
    })),
    shareSlug: ballot.shareSlug,
    passwordRequired: !!ballot.password,
  };
}

function getVoteKey(ballot, req, displayName) {
  const ip = req.headers['x-forwarded-for'] || req.ip || '';
  const ua = req.headers['user-agent'] || '';
  const material = `${ballot.id}|${String(ip)}|${String(ua)}|${String(displayName || '').trim().toLowerCase()}`;
  return crypto.createHash('sha256').update(material).digest('hex').slice(0, 24);
}

function hashMeta(value) {
  if (!value) return '';
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

router.get('/:shareSlug', (req, res, next) => {
  try {
    checkExpiredBallots();

    const ballot = findBallotByShareSlug(req.params.shareSlug);
    if (!ballot) return res.status(404).json({ error: 'Public ballot not found' });
    if (ballot.visibility !== 'public' || ballot.publicationStatus !== 'published') {
      return res.status(404).json({ error: 'Public ballot not found' });
    }

    return res.json(sanitizePublicBallot(ballot));
  } catch (err) { next(err); }
});

router.post('/:shareSlug/vote', (req, res, next) => {
  try {
    const ballot = findBallotByShareSlug(req.params.shareSlug);
    if (!ballot) return res.status(404).json({ error: 'Public ballot not found' });
    if (ballot.visibility !== 'public' || ballot.publicationStatus !== 'published') {
      return res.status(404).json({ error: 'Public ballot not found' });
    }
    if (ballot.status !== 'open') {
      return res.status(409).json({ error: 'This ballot is closed' });
    }

    const displayName = String(req.body?.name || '').trim();
    if (!displayName) {
      throw new ValidationError('name is required');
    }
    if (displayName.length > 64) {
      throw new ValidationError('name must be 64 characters or fewer');
    }

    if (ballot.password) {
      const provided = String(req.body?.password || '');
      if (!verifyPublicPassword(ballot.password, provided)) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    const votes = req.body?.votes;
    validateVoteInput(votes, ballot);

    const voteKey = getVoteKey(ballot, req, displayName);
    if (hasPublicVoted(ballot.id, voteKey)) {
      return res.status(409).json({ error: 'Vote already submitted for this identity/session', duplicate: true });
    }

    const voteType = (ballot.voteType || 'qv').toLowerCase();
    let creditsUsed = 0;
    const processedItems = votes.map(v => {
      const count = v.votes || 0;
      const cost = voteType === 'binary' ? (count ? 1 : 0) : count * count;
      creditsUsed += cost;
      return {
        itemId: v.itemId,
        votes: count,
        creditsCost: cost,
        comment: v.comment || '',
      };
    });

    savePublicVote(ballot.id, voteKey, {
      voteKey,
      source: 'public',
      displayName,
      handle: displayName,
      memberId: null,
      items: processedItems,
      creditsUsed,
      votedAt: new Date().toISOString(),
      meta: {
        ipHash: hashMeta(req.headers['x-forwarded-for'] || req.ip || ''),
        userAgentHash: hashMeta(req.headers['user-agent'] || ''),
      },
    });

    checkExpiredBallots();

    return res.json({ ok: true, ballotId: ballot.id, accepted: true });
  } catch (err) { next(err); }
});

module.exports = router;
