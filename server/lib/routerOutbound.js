const { buildEnvelope, publishEnvelope } = require('./routerClient');
const { enqueueOutbox, markOutboxResult } = require('./routerStore');

function nextBackoffMs(attempts) {
  return Math.min(60_000, Math.pow(2, Math.max(1, Number(attempts) || 1)) * 1000);
}

async function enqueueAndPublishEnvelope(envelope) {
  const entry = enqueueOutbox(envelope);

  try {
    const remote = await publishEnvelope(envelope);
    const updated = markOutboxResult(entry.localId, { status: 'sent' });
    return {
      localId: entry.localId,
      envelope,
      remote,
      outbox: updated,
    };
  } catch (err) {
    const attempts = (entry.attempts || 0) + 1;
    const delayMs = nextBackoffMs(attempts);
    markOutboxResult(entry.localId, { status: 'error', error: err.message, delayMs });

    err.localId = entry.localId;
    err.envelopeId = envelope?.envelopeId || null;
    throw err;
  }
}

async function publishDomainEvent({
  eventType,
  targetInstanceId,
  roomId = null,
  entity = {},
  payload = {},
  expiresInHours = 48,
  memberId = null,
}) {
  const envelope = buildEnvelope({
    eventType,
    targetInstanceId,
    roomId,
    entity,
    payload,
    expiresInHours,
    memberId,
  });

  return enqueueAndPublishEnvelope(envelope);
}

module.exports = {
  enqueueAndPublishEnvelope,
  publishDomainEvent,
};
