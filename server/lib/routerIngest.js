const crypto = require('crypto');
const config = require('./config');
const { getBallot, createBallot } = require('./ballotStore');
const { saveVote } = require('./voteStore');
const { generateResults } = require('./resultsEngine');
const { hasSeenEnvelope, markEnvelopeSeen } = require('./routerStore');

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(sortKeysDeep(value));
}

function stripAuth(envelope) {
  const { auth, ...rest } = envelope || {};
  return rest;
}

function verifyEnvelopeSignature(envelope) {
  const mode = envelope?.auth?.mode;
  if (mode !== 'hmac-sha256') {
    const err = new Error('Unsupported envelope auth mode');
    err.statusCode = 400;
    throw err;
  }

  const key = config.router.hmacKey;
  if (!key) {
    const err = new Error('Router HMAC key not configured (VOICE_ROUTER_HMAC_KEY)');
    err.statusCode = 400;
    throw err;
  }

  const body = canonicalJson(stripAuth(envelope));
  const expected = crypto.createHmac('sha256', key).update(body).digest('base64');
  const given = envelope?.auth?.signature || '';

  if (!given || expected !== given) {
    const err = new Error('Invalid envelope signature');
    err.statusCode = 401;
    throw err;
  }
}

function ensureNotExpired(envelope) {
  const iso = envelope?.timestamps?.expiresAt;
  if (!iso) return;
  const ts = Date.parse(iso);
  if (Number.isFinite(ts) && Date.now() > ts) {
    const err = new Error('Envelope expired');
    err.statusCode = 410;
    throw err;
  }
}

function validateEnvelopeShape(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    const err = new Error('envelope is required');
    err.statusCode = 400;
    throw err;
  }
  if (!envelope.envelopeId || typeof envelope.envelopeId !== 'string') {
    const err = new Error('envelope.envelopeId is required');
    err.statusCode = 400;
    throw err;
  }
  if (!envelope.eventType || typeof envelope.eventType !== 'string') {
    const err = new Error('envelope.eventType is required');
    err.statusCode = 400;
    throw err;
  }
  if (!envelope.timestamps || typeof envelope.timestamps.createdAt !== 'string') {
    const err = new Error('envelope.timestamps.createdAt is required');
    err.statusCode = 400;
    throw err;
  }
}

function ensureKnownEventType(eventType) {
  const known = new Set([
    'ballot.created',
    'vote.submitted',
    'results.generated',
    'ballot.closed',
  ]);
  if (!known.has(eventType)) {
    const err = new Error(`Unknown eventType: ${eventType}`);
    err.statusCode = 400;
    throw err;
  }
}

function ingestBallotCreated(envelope) {
  const ballot = envelope?.payload?.ballot;
  if (!ballot || typeof ballot !== 'object') {
    const err = new Error('ballot.created requires payload.ballot');
    err.statusCode = 400;
    throw err;
  }

  const sourceBallotId = envelope?.entity?.sourceBallotId || envelope?.entity?.ballotId || ballot.id;
  const withRouterMeta = {
    ...ballot,
    routerOriginInstanceId: ballot.routerOriginInstanceId || envelope?.origin?.instanceId || null,
    routerSourceBallotId: ballot.routerSourceBallotId || sourceBallotId || null,
  };

  if (getBallot(withRouterMeta.id)) {
    return { status: 'duplicate', detail: 'ballot already exists' };
  }

  const created = createBallot(withRouterMeta);
  return { status: 'accepted', createdBallotId: created.id };
}

function ingestVoteSubmitted(envelope) {
  const ballotId = envelope?.payload?.ballotId;
  const vote = envelope?.payload?.vote;
  const voter = envelope?.payload?.voter || {};

  if (!ballotId || !vote || !Array.isArray(vote.items)) {
    const err = new Error('vote.submitted requires payload.ballotId and payload.vote.items[]');
    err.statusCode = 400;
    throw err;
  }

  const ballot = getBallot(ballotId);
  if (!ballot) {
    const err = new Error('Target ballot not found for vote.submitted');
    err.statusCode = 404;
    throw err;
  }

  const voterId = voter.memberId || voter.handle;
  if (!voterId) {
    const err = new Error('vote.submitted requires voter.memberId or voter.handle');
    err.statusCode = 400;
    throw err;
  }

  saveVote(ballot.id, voterId, {
    memberId: voter.memberId || null,
    handle: voter.handle || 'anonymous',
    instanceId: envelope?.origin?.instanceId || null,
    items: vote.items,
    creditsUsed: vote.creditsUsed || 0,
    votedAt: vote.votedAt || new Date().toISOString(),
  });

  return { status: 'accepted', ballotId, voterId };
}

function ingestResultsGenerated(envelope) {
  const sourceBallotId = envelope?.payload?.sourceBallotId;
  if (!sourceBallotId) {
    const err = new Error('results.generated requires payload.sourceBallotId');
    err.statusCode = 400;
    throw err;
  }

  const providedResults = envelope?.payload?.resultsBallot || null;
  const existingResults = (providedResults?.id && getBallot(providedResults.id)) || null;
  if (existingResults) {
    return { status: 'duplicate', detail: 'results ballot already exists', resultsBallotId: existingResults.id };
  }

  if (providedResults && typeof providedResults === 'object') {
    const created = createBallot({
      ...providedResults,
      id: providedResults.id,
      isResults: true,
      sourceBallotId,
      routerOriginInstanceId: envelope?.origin?.instanceId || null,
      routerSourceBallotId: sourceBallotId,
    });
    return { status: 'accepted', resultsBallotId: created.id };
  }

  const source = getBallot(sourceBallotId);
  if (!source) {
    const err = new Error('Source ballot not found for results.generated');
    err.statusCode = 404;
    throw err;
  }

  const generated = generateResults(sourceBallotId);
  return { status: 'accepted', resultsBallotId: generated.id };
}

function ingestBallotClosed(envelope) {
  const ballotId = envelope?.payload?.ballotId || envelope?.entity?.ballotId;
  if (!ballotId) {
    const err = new Error('ballot.closed requires ballotId');
    err.statusCode = 400;
    throw err;
  }

  const ballot = getBallot(ballotId);
  if (!ballot) {
    return { status: 'accepted', detail: 'ballot missing locally; close noop' };
  }

  // Close is advisory in v0.1; local expiry logic remains source-of-truth for transition timing.
  return { status: 'accepted', detail: `close advisory received for ${ballotId}` };
}

function dispatchIngest(envelope) {
  switch (envelope.eventType) {
    case 'ballot.created':
      return ingestBallotCreated(envelope);
    case 'vote.submitted':
      return ingestVoteSubmitted(envelope);
    case 'results.generated':
      return ingestResultsGenerated(envelope);
    case 'ballot.closed':
      return ingestBallotClosed(envelope);
    default:
      return { status: 'rejected', detail: `unsupported eventType: ${envelope.eventType}` };
  }
}

function ingestEnvelope(envelope) {
  validateEnvelopeShape(envelope);
  ensureKnownEventType(envelope.eventType);
  verifyEnvelopeSignature(envelope);
  ensureNotExpired(envelope);

  if (hasSeenEnvelope(envelope.envelopeId)) {
    return {
      envelopeId: envelope.envelopeId,
      status: 'duplicate',
      detail: 'envelope already processed',
    };
  }

  const result = dispatchIngest(envelope);
  markEnvelopeSeen(envelope.envelopeId);

  return {
    envelopeId: envelope.envelopeId,
    eventType: envelope.eventType,
    ...result,
  };
}

module.exports = { ingestEnvelope, verifyEnvelopeSignature };
