const config = require('./config');
const { isRouterConfigured } = require('./routerClient');
const { publishDomainEvent } = require('./routerOutbound');
const { getAllVotes } = require('./voteStore');

function sourceBallotIdFor(ballot) {
  return ballot?.routerSourceBallotId || ballot?.id || null;
}

function isRemoteOwnedBallot(ballot) {
  const origin = ballot?.routerOriginInstanceId;
  if (!origin) return false;
  return origin !== config.router.instanceId;
}

async function maybePublishVoteSubmitted({ ballot, voter, vote }) {
  if (!isRouterConfigured()) {
    return { ok: false, skipped: 'router_not_configured' };
  }

  if (!isRemoteOwnedBallot(ballot)) {
    return { ok: false, skipped: 'not_remote_owned' };
  }

  const sourceBallotId = sourceBallotIdFor(ballot);
  if (!sourceBallotId) {
    return { ok: false, skipped: 'missing_source_ballot_id' };
  }

  const out = await publishDomainEvent({
    eventType: 'vote.submitted',
    targetInstanceId: ballot.routerOriginInstanceId,
    roomId: ballot.roomId || null,
    entity: {
      ballotId: sourceBallotId,
      sourceBallotId,
    },
    payload: {
      ballotId: sourceBallotId,
      voter: {
        memberId: voter?.memberId || null,
        handle: voter?.handle || 'anonymous',
      },
      vote: {
        items: Array.isArray(vote?.items) ? vote.items : [],
        creditsUsed: Number(vote?.creditsUsed) || 0,
        votedAt: vote?.votedAt || new Date().toISOString(),
      },
    },
    memberId: voter?.memberId || null,
  });

  return {
    ok: true,
    published: {
      eventType: 'vote.submitted',
      targetInstanceId: ballot.routerOriginInstanceId,
      sourceBallotId,
      envelopeId: out.envelope.envelopeId,
      localId: out.localId,
    },
  };
}

async function maybePublishResultsGenerated({ sourceBallot, resultsBallot, reason = 'generated' }) {
  if (!isRouterConfigured()) {
    return { ok: false, skipped: 'router_not_configured' };
  }

  const votes = getAllVotes(sourceBallot.id);
  const targets = new Set();

  for (const vote of votes) {
    const instanceId = vote?.instanceId;
    if (!instanceId) continue;
    if (instanceId === config.router.instanceId) continue;
    targets.add(instanceId);
  }

  if (targets.size === 0) {
    return { ok: false, skipped: 'no_remote_targets' };
  }

  const sourceBallotId = sourceBallotIdFor(sourceBallot);
  if (!sourceBallotId) {
    return { ok: false, skipped: 'missing_source_ballot_id' };
  }

  const payload = {
    sourceBallotId,
    reason,
    resultsBallot: {
      ...resultsBallot,
      sourceBallotId,
    },
  };

  const sent = [];
  const failed = [];

  for (const targetInstanceId of targets) {
    try {
      const out = await publishDomainEvent({
        eventType: 'results.generated',
        targetInstanceId,
        roomId: sourceBallot.roomId || null,
        entity: {
          ballotId: sourceBallotId,
          sourceBallotId,
        },
        payload,
        memberId: null,
      });

      sent.push({
        targetInstanceId,
        envelopeId: out.envelope.envelopeId,
        localId: out.localId,
      });
    } catch (err) {
      failed.push({ targetInstanceId, error: err.message });
    }
  }

  return {
    ok: failed.length === 0,
    sourceBallotId,
    targets: Array.from(targets),
    sent,
    failed,
  };
}

module.exports = {
  isRemoteOwnedBallot,
  maybePublishVoteSubmitted,
  maybePublishResultsGenerated,
};
