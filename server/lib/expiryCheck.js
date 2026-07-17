const { listBallots, closeBallot } = require('./ballotStore');
const { getVoteCount } = require('./voteStore');
const { generateResults } = require('./resultsEngine');
const { isRemoteOwnedBallot, maybePublishResultsGenerated } = require('./routerPhaseB');

/**
 * Check all open room/public ballots for expiry triggers.
 * Called on-request (middleware) and optionally on an interval.
 *
 * Triggers:
 * 1. Time limit: endsAt has passed
 * 2. 100% voted: all distributedTo members have submitted
 *
 * When triggered: close ballot → generate results ballot.
 */
function checkExpiredBallots() {
  const now = Date.now();
  const allBallots = listBallots();

  const expirable = allBallots.filter(b =>
    b.status === 'open' &&
    (b.visibility === 'room' || b.visibility === 'public')
  );

  const closed = [];

  for (const ballot of expirable) {
    if (isRemoteOwnedBallot(ballot)) {
      // Source instance is canonical for closure/results on imported federated ballots.
      continue;
    }

    let shouldClose = false;
    let reason = '';

    // Trigger 1: time limit
    if (ballot.endsAt) {
      const endsAt = Date.parse(ballot.endsAt);
      if (Number.isFinite(endsAt) && now >= endsAt) {
        shouldClose = true;
        reason = 'time_expired';
      }
    }

    // Trigger 2: 100% voted
    if (!shouldClose && Array.isArray(ballot.distributedTo) && ballot.distributedTo.length > 0) {
      const voteCount = getVoteCount(ballot.id);
      if (voteCount >= ballot.distributedTo.length) {
        shouldClose = true;
        reason = 'all_voted';
      }
    }

    if (shouldClose) {
      try {
        // Generate results first, then close.
        // If votes have not replicated yet, defer closure so next expiry pass can succeed.
        const results = generateResults(ballot.id);
        const closedBallot = closeBallot(ballot.id);
        if (closedBallot) {
          closed.push({ ballotId: ballot.id, reason, resultsId: results.id });

          setImmediate(async () => {
            try {
              const published = await maybePublishResultsGenerated({
                sourceBallot: ballot,
                resultsBallot: results,
                reason,
              });
              if (published?.ok) {
                console.log(`[expiry] Published results.generated for ${ballot.id} to ${published.sent.length} instance(s)`);
              }
            } catch (err) {
              console.error(`[expiry] Failed to publish results.generated for ${ballot.id}:`, err.message);
            }
          });

          console.log(`[expiry] Closed ballot ${ballot.id} (${reason}), results: ${results.id}`);
        }
      } catch (err) {
        if (String(err?.message || '').includes('No votes submitted yet')) {
          console.warn(`[expiry] Deferred closure for ${ballot.id} (${reason}): waiting for replicated votes`);
        } else {
          console.error(`[expiry] Failed to close ballot ${ballot.id}:`, err.message);
        }
      }
    }
  }

  return closed;
}

/**
 * Express middleware that checks expiry on each request.
 * Lightweight — only scans open room/public ballots.
 */
function expiryMiddleware(req, res, next) {
  try {
    checkExpiredBallots();
  } catch (err) {
    console.error('[expiry] Middleware error:', err.message);
  }
  next();
}

module.exports = { checkExpiredBallots, expiryMiddleware };
