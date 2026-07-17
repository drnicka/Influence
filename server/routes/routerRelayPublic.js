const express = require('express');
const crypto = require('crypto');
const {
  getInstanceById,
  getInstanceByToken,
  listDirectoryInstances,
  listDirectoryRooms,
  upsertDirectoryRoom,
  upsertEnvelope,
  getEnvelopeRecord,
  pullEnvelopesForInstance,
  ackEnvelopesForInstance,
  rejectEnvelopeForInstance,
} = require('../lib/routerRelayStore');

const router = express.Router();

function parseBearer(req) {
  const auth = req.header('Authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

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

function timingSafeEqualString(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function verifyEnvelopeSignature(envelope, senderInstance) {
  const mode = envelope?.auth?.mode;
  const signature = envelope?.auth?.signature;
  const keyId = envelope?.auth?.keyId;

  if (mode !== 'hmac-sha256' || !signature || !keyId) {
    const err = new Error('Invalid envelope auth block');
    err.statusCode = 400;
    throw err;
  }

  if (keyId !== senderInstance.instanceId) {
    const err = new Error('Envelope keyId does not match sender instance');
    err.statusCode = 401;
    throw err;
  }

  const { auth, ...unsigned } = envelope;
  const expected = crypto
    .createHmac('sha256', senderInstance.hmacKey)
    .update(canonicalJson(unsigned))
    .digest('base64');

  if (!timingSafeEqualString(signature, expected)) {
    const err = new Error('Envelope signature verification failed');
    err.statusCode = 401;
    throw err;
  }
}

function requireRouterInstance(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const instance = getInstanceByToken(token);
  if (!instance) {
    return res.status(401).json({ error: 'Invalid router token' });
  }

  req.routerInstance = instance;
  next();
}

router.use(requireRouterInstance);

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'voice-router', instanceId: req.routerInstance.instanceId });
});

router.get('/directory/instances', (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 200));
    const items = listDirectoryInstances({ includeDisabled: false, limit });
    res.json({ ok: true, items });
  } catch (err) { next(err); }
});

router.get('/directory/rooms', (req, res, next) => {
  try {
    const ownerInstanceId = req.query?.ownerInstanceId || null;
    const activeOnly = String(req.query?.activeOnly || '1') !== '0';
    const limit = Math.max(1, Math.min(1_000, Number(req.query?.limit) || 500));
    const items = listDirectoryRooms({ ownerInstanceId, activeOnly, limit });
    res.json({ ok: true, items });
  } catch (err) { next(err); }
});

router.post('/directory/rooms', (req, res, next) => {
  try {
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

    const record = upsertDirectoryRoom({
      ownerInstanceId: req.routerInstance.instanceId,
      federatedRoomId,
      name,
      description,
      joinPolicy,
      visibility,
      tags,
      memberCount,
      active,
    });

    res.status(201).json({ ok: true, room: record });
  } catch (err) { next(err); }
});

router.post('/envelopes', (req, res, next) => {
  try {
    const envelope = req.body?.envelope;
    if (!envelope || typeof envelope !== 'object') {
      return res.status(400).json({ error: 'envelope is required' });
    }

    if (!envelope.envelopeId || !envelope.eventType || !envelope.origin?.instanceId || !envelope.target?.instanceId) {
      return res.status(400).json({ error: 'envelope missing required fields' });
    }

    // Sender identity must match bearer token owner.
    if (envelope.origin.instanceId !== req.routerInstance.instanceId) {
      return res.status(403).json({ error: 'origin.instanceId does not match authenticated instance' });
    }

    const sender = getInstanceById(envelope.origin.instanceId);
    const target = getInstanceById(envelope.target.instanceId);

    if (!sender || sender.enabled === false) {
      return res.status(401).json({ error: 'Unknown or disabled sender instance' });
    }

    if (!target || target.enabled === false) {
      return res.status(400).json({ error: 'Unknown or disabled target instance' });
    }

    verifyEnvelopeSignature(envelope, sender);

    const { created, record } = upsertEnvelope(envelope);
    res.status(created ? 201 : 200).json({
      ok: true,
      envelopeId: record.envelopeId,
      status: created ? 'queued' : 'duplicate',
    });
  } catch (err) { next(err); }
});

router.get('/envelopes/pull', (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query?.limit) || 50));
    const records = pullEnvelopesForInstance(req.routerInstance.instanceId, limit);
    const items = records.map(rec => ({ envelope: rec.envelope }));

    res.json({ ok: true, items, nextCursor: null });
  } catch (err) { next(err); }
});

router.post('/envelopes/ack', (req, res, next) => {
  try {
    const acks = req.body?.acks;
    if (!Array.isArray(acks) || acks.length === 0) {
      return res.status(400).json({ error: 'acks[] is required' });
    }

    const applied = ackEnvelopesForInstance(req.routerInstance.instanceId, acks);
    res.json({ ok: true, applied });
  } catch (err) { next(err); }
});

router.post('/envelopes/reject', (req, res, next) => {
  try {
    const { envelopeId, reasonCode, reason } = req.body || {};
    if (!envelopeId) return res.status(400).json({ error: 'envelopeId is required' });

    const applied = rejectEnvelopeForInstance(req.routerInstance.instanceId, { envelopeId, reasonCode, reason });
    if (!applied) return res.status(404).json({ error: 'Envelope not found for this instance' });

    res.json({ ok: true, applied });
  } catch (err) { next(err); }
});

router.get('/envelopes/:envelopeId', (req, res, next) => {
  try {
    const rec = getEnvelopeRecord(req.params.envelopeId);
    if (!rec) return res.status(404).json({ error: 'Envelope not found' });

    const inst = req.routerInstance.instanceId;
    if (rec.originInstanceId !== inst && rec.targetInstanceId !== inst) {
      return res.status(403).json({ error: 'Not authorized to view this envelope' });
    }

    res.json({
      ok: true,
      envelopeId: rec.envelopeId,
      eventType: rec.envelope?.eventType || null,
      originInstanceId: rec.originInstanceId,
      targetInstanceId: rec.targetInstanceId,
      createdAt: rec.createdAt,
      delivery: rec.deliveries?.[inst] || null,
    });
  } catch (err) { next(err); }
});

module.exports = router;
