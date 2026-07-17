const express = require('express');
const config = require('../lib/config');
const {
  isRouterConfigured,
  publishEnvelope,
  pullEnvelopes,
  ackEnvelopes,
  rejectEnvelope,
  checkRouterHealth,
  listDirectoryInstances,
  listDirectoryRooms,
  publishDirectoryRoom,
} = require('../lib/routerClient');
const { ingestEnvelope } = require('../lib/routerIngest');
const { markOutboxResult, getPendingOutbox, listOutbox } = require('../lib/routerStore');
const { publishDomainEvent } = require('../lib/routerOutbound');

const router = express.Router();

function internalAuth(req, res, next) {
  const expected = config.router.internalKey;
  if (!expected) return next();

  const provided = req.header('X-Voice-Internal-Key');
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Internal router API authentication failed' });
  }

  next();
}

router.use(internalAuth);

router.get('/health', async (req, res, next) => {
  try {
    const configured = isRouterConfigured();
    let routerHealth = null;

    if (configured) {
      try {
        routerHealth = await checkRouterHealth();
      } catch (err) {
        routerHealth = {
          ok: false,
          error: err.message,
          statusCode: err.statusCode || null,
        };
      }
    }

    res.json({
      ok: true,
      configured,
      instanceId: config.router.instanceId || null,
      routerUrl: config.router.url || null,
      pullLimit: config.router.pullLimit || 50,
      routerHealth,
    });
  } catch (err) { next(err); }
});

router.get('/outbox', (req, res, next) => {
  try {
    res.json({ ok: true, items: listOutbox() });
  } catch (err) { next(err); }
});

router.get('/discovery/instances', async (req, res, next) => {
  try {
    if (!isRouterConfigured()) {
      return res.status(400).json({ error: 'Router not configured' });
    }

    const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 200));
    const out = await listDirectoryInstances({ limit });
    res.json({ ok: true, items: Array.isArray(out?.items) ? out.items : [] });
  } catch (err) { next(err); }
});

router.get('/discovery/rooms', async (req, res, next) => {
  try {
    if (!isRouterConfigured()) {
      return res.status(400).json({ error: 'Router not configured' });
    }

    const ownerInstanceId = req.query?.ownerInstanceId || null;
    const activeOnly = String(req.query?.activeOnly || '1') !== '0';
    const limit = Math.max(1, Math.min(1_000, Number(req.query?.limit) || 500));
    const out = await listDirectoryRooms({ ownerInstanceId, activeOnly, limit });
    res.json({ ok: true, items: Array.isArray(out?.items) ? out.items : [] });
  } catch (err) { next(err); }
});

router.post('/discovery/rooms', async (req, res, next) => {
  try {
    if (!isRouterConfigured()) {
      return res.status(400).json({ error: 'Router not configured' });
    }

    const {
      federatedRoomId,
      name,
      description = null,
      joinPolicy = 'request_to_join',
      visibility = 'discoverable',
      tags = [],
      memberCount = null,
      active = true,
    } = req.body || {};

    if (!federatedRoomId || !name) {
      return res.status(400).json({ error: 'federatedRoomId and name are required' });
    }

    const out = await publishDirectoryRoom({
      federatedRoomId,
      name,
      description,
      joinPolicy,
      visibility,
      tags,
      memberCount,
      active,
    });

    res.status(201).json({ ok: true, room: out?.room || null });
  } catch (err) { next(err); }
});

router.post('/publish', async (req, res, next) => {
  try {
    if (!isRouterConfigured()) {
      return res.status(400).json({ error: 'Router not configured' });
    }

    const {
      eventType,
      targetInstanceId,
      roomId = null,
      entity = {},
      payload = {},
      expiresInHours = 48,
      memberId = null,
    } = req.body || {};

    if (!eventType || !targetInstanceId) {
      return res.status(400).json({ error: 'eventType and targetInstanceId are required' });
    }

    let outboundPayload = payload;
    if (eventType === 'ballot.created' && payload?.ballot && typeof payload.ballot === 'object') {
      outboundPayload = {
        ...payload,
        ballot: {
          ...payload.ballot,
          // Persist source ownership metadata on federated copies.
          routerOriginInstanceId: config.router.instanceId || null,
          routerSourceBallotId: payload.ballot.routerSourceBallotId || entity.ballotId || payload.ballot.id || null,
        },
      };
    }

    try {
      const published = await publishDomainEvent({
        eventType,
        targetInstanceId,
        roomId,
        entity,
        payload: outboundPayload,
        expiresInHours,
        memberId,
      });

      return res.status(201).json({
        ok: true,
        localId: published.localId,
        envelopeId: published.envelope.envelopeId,
        remote: published.remote,
      });
    } catch (err) {
      return res.status(502).json({
        ok: false,
        localId: err.localId || null,
        envelopeId: err.envelopeId || null,
        error: err.message,
      });
    }
  } catch (err) { next(err); }
});

router.post('/outbox/flush', async (req, res, next) => {
  try {
    if (!isRouterConfigured()) {
      return res.status(400).json({ error: 'Router not configured' });
    }

    const limit = Math.max(1, Math.min(100, Number(req.body?.limit) || 50));
    const pending = getPendingOutbox(limit);

    const result = {
      ok: true,
      attempted: pending.length,
      sent: 0,
      failed: 0,
      items: [],
    };

    for (const item of pending) {
      try {
        await publishEnvelope(item.envelope);
        markOutboxResult(item.localId, { status: 'sent' });
        result.sent += 1;
        result.items.push({ localId: item.localId, envelopeId: item.envelope?.envelopeId, status: 'sent' });
      } catch (err) {
        const attempts = (item.attempts || 0) + 1;
        const delayMs = Math.min(60_000, Math.pow(2, attempts) * 1000);
        markOutboxResult(item.localId, { status: 'error', error: err.message, delayMs });
        result.failed += 1;
        result.items.push({ localId: item.localId, envelopeId: item.envelope?.envelopeId, status: 'error', error: err.message });
      }
    }

    res.json(result);
  } catch (err) { next(err); }
});

router.post('/ingest', (req, res, next) => {
  try {
    const envelope = req.body?.envelope;
    const result = ingestEnvelope(envelope);
    res.json({ ok: true, result });
  } catch (err) { next(err); }
});

router.post('/pull', async (req, res, next) => {
  try {
    if (!isRouterConfigured()) {
      return res.status(400).json({ error: 'Router not configured' });
    }

    const limit = Math.max(1, Math.min(100, Number(req.body?.limit || req.query?.limit) || config.router.pullLimit || 50));
    const cursor = req.body?.cursor || req.query?.cursor || null;

    const pulled = await pullEnvelopes({ limit, cursor });
    const items = Array.isArray(pulled?.items) ? pulled.items : [];

    const acks = [];
    const rejects = [];
    const processed = [];

    for (const wrapped of items) {
      const envelope = wrapped?.envelope || wrapped;
      try {
        const applied = ingestEnvelope(envelope);
        const status = applied.status === 'duplicate' ? 'duplicate' : 'accepted';
        acks.push({ envelopeId: envelope.envelopeId, status });
        processed.push({ envelopeId: envelope.envelopeId, status, detail: applied.detail || null, eventType: envelope.eventType });
      } catch (err) {
        rejects.push({
          envelopeId: envelope?.envelopeId || null,
          reasonCode: 'ingest_failed',
          reason: err.message,
        });
        processed.push({
          envelopeId: envelope?.envelopeId || null,
          status: 'rejected',
          eventType: envelope?.eventType || null,
          detail: err.message,
        });
      }
    }

    if (acks.length > 0) {
      await ackEnvelopes(acks);
    }

    for (const r of rejects) {
      try {
        if (r.envelopeId) await rejectEnvelope(r);
      } catch (_) {
        // Best effort to report reject status back to router.
      }
    }

    res.json({
      ok: true,
      pulled: items.length,
      acked: acks.length,
      rejected: rejects.length,
      nextCursor: pulled?.nextCursor || null,
      processed,
    });
  } catch (err) { next(err); }
});

router.post('/ack', async (req, res, next) => {
  try {
    if (!isRouterConfigured()) {
      return res.status(400).json({ error: 'Router not configured' });
    }

    const acks = req.body?.acks;
    if (!Array.isArray(acks) || acks.length === 0) {
      return res.status(400).json({ error: 'acks[] is required' });
    }

    const out = await ackEnvelopes(acks);
    res.json({ ok: true, remote: out });
  } catch (err) { next(err); }
});

module.exports = router;
