const express = require('express');
const config = require('../lib/config');
const {
  getInstanceById,
  upsertInstance,
  listDirectoryInstances,
  listDirectoryRooms,
  replayEnvelope,
  getQueueStats,
  listEnvelopeAudit,
} = require('../lib/routerRelayStore');

const router = express.Router();

function parseBearer(req) {
  const auth = req.header('Authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

function requireAdmin(req, res, next) {
  const adminToken = config.router.adminToken;
  if (!adminToken) {
    return res.status(400).json({ error: 'Router admin not configured (VOICE_ROUTER_ADMIN_TOKEN missing)' });
  }

  const provided = parseBearer(req) || req.header('X-Voice-Router-Admin') || null;
  if (!provided || provided !== adminToken) {
    return res.status(401).json({ error: 'Router admin authentication failed' });
  }

  next();
}

router.use(requireAdmin);

router.post('/instances/register', (req, res, next) => {
  try {
    const {
      instanceId,
      token,
      hmacKey,
      enabled = true,
      displayName = null,
      instanceUrl = null,
      summary = null,
      tags = [],
    } = req.body || {};
    if (!instanceId || !token || !hmacKey) {
      return res.status(400).json({ error: 'instanceId, token, and hmacKey are required' });
    }

    const record = upsertInstance({
      instanceId,
      token,
      hmacKey,
      enabled,
      displayName,
      instanceUrl,
      summary,
      tags,
    });
    res.status(201).json({
      ok: true,
      instance: {
        instanceId: record.instanceId,
        enabled: record.enabled,
        displayName: record.displayName,
        instanceUrl: record.instanceUrl,
        summary: record.summary,
        tags: record.tags,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    });
  } catch (err) { next(err); }
});

router.post('/instances/:instanceId/keys/rotate', (req, res, next) => {
  try {
    const instanceId = req.params.instanceId;
    const existing = getInstanceById(instanceId);
    if (!existing) return res.status(404).json({ error: 'Instance not found' });

    const token = req.body?.token || existing.token;
    const hmacKey = req.body?.hmacKey || existing.hmacKey;
    const enabled = req.body?.enabled !== undefined ? !!req.body.enabled : existing.enabled;
    const displayName = req.body?.displayName !== undefined ? req.body.displayName : existing.displayName;
    const instanceUrl = req.body?.instanceUrl !== undefined ? req.body.instanceUrl : existing.instanceUrl;
    const summary = req.body?.summary !== undefined ? req.body.summary : existing.summary;
    const tags = req.body?.tags !== undefined ? req.body.tags : existing.tags;

    const record = upsertInstance({ instanceId, token, hmacKey, enabled, displayName, instanceUrl, summary, tags });
    res.json({
      ok: true,
      instance: {
        instanceId: record.instanceId,
        enabled: record.enabled,
        displayName: record.displayName,
        instanceUrl: record.instanceUrl,
        summary: record.summary,
        tags: record.tags,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    });
  } catch (err) { next(err); }
});

router.get('/queues/:instanceId', (req, res, next) => {
  try {
    const instanceId = req.params.instanceId;
    const existing = getInstanceById(instanceId);
    if (!existing) return res.status(404).json({ error: 'Instance not found' });

    res.json({ ok: true, stats: getQueueStats(instanceId) });
  } catch (err) { next(err); }
});

router.get('/directory/instances', (req, res, next) => {
  try {
    const includeDisabled = String(req.query?.includeDisabled || '0') === '1';
    const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 200));
    const items = listDirectoryInstances({ includeDisabled, limit });
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

router.post('/envelopes/:envelopeId/replay', (req, res, next) => {
  try {
    const envelopeId = req.params.envelopeId;
    const instanceId = req.body?.instanceId || null;

    const replayed = replayEnvelope(envelopeId, instanceId);
    if (!replayed) {
      return res.status(404).json({ error: 'Envelope not found (or target instance not mapped)' });
    }

    res.json({ ok: true, envelopeId: replayed.envelopeId, targetInstanceId: instanceId || null });
  } catch (err) { next(err); }
});

router.get('/audit/envelopes', (req, res, next) => {
  try {
    const instanceId = req.query?.instanceId || null;
    const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 100));
    const rows = listEnvelopeAudit({ instanceId, limit });
    res.json({ ok: true, items: rows });
  } catch (err) { next(err); }
});

module.exports = router;
