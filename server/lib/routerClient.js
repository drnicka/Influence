const crypto = require('crypto');
const config = require('./config');

function routerConfig() {
  return config.router || {};
}

function isRouterConfigured() {
  const rc = routerConfig();
  return !!(rc.url && rc.instanceId && rc.token && rc.hmacKey);
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

function signEnvelopePayload(envelopeWithoutAuth) {
  const rc = routerConfig();
  const body = canonicalJson(envelopeWithoutAuth);
  return crypto.createHmac('sha256', rc.hmacKey).update(body).digest('base64');
}

function buildEnvelope({ eventType, targetInstanceId, roomId = null, entity = {}, payload = {}, expiresInHours = 48, memberId = null }) {
  const rc = routerConfig();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + Math.max(1, Number(expiresInHours) || 48) * 60 * 60 * 1000);

  const envelopeWithoutAuth = {
    envelopeId: crypto.randomUUID(),
    specVersion: 'voice-router/v0.1',
    eventType,
    origin: {
      instanceId: rc.instanceId,
      memberId,
    },
    target: {
      instanceId: targetInstanceId,
      roomId,
    },
    entity,
    timestamps: {
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
    payload,
  };

  const signature = signEnvelopePayload(envelopeWithoutAuth);

  return {
    ...envelopeWithoutAuth,
    auth: {
      mode: 'hmac-sha256',
      keyId: rc.instanceId,
      signature,
    },
  };
}

async function routerRequest(path, opts = {}) {
  const rc = routerConfig();
  if (!rc.url || !rc.token) {
    const err = new Error('Router not configured (VOICE_ROUTER_URL/VOICE_ROUTER_TOKEN)');
    err.statusCode = 400;
    throw err;
  }

  const headers = {
    Authorization: `Bearer ${rc.token}`,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };

  const base = String(rc.url).endsWith('/') ? String(rc.url) : `${String(rc.url)}/`;
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  const url = new URL(normalizedPath, base).toString();
  const res = await fetch(url, { ...opts, headers });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }

  if (!res.ok) {
    const err = new Error(json?.error || `Router request failed: ${res.status}`);
    err.statusCode = res.status;
    err.meta = { path, status: res.status, body: json };
    throw err;
  }

  return json;
}

async function publishEnvelope(envelope) {
  return routerRequest('/v1/envelopes', {
    method: 'POST',
    body: JSON.stringify({ envelope }),
  });
}

async function pullEnvelopes({ limit = 50, cursor = null } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(Math.max(1, Math.min(100, Number(limit) || 50))));
  if (cursor) params.set('cursor', String(cursor));
  return routerRequest(`/v1/envelopes/pull?${params.toString()}`, { method: 'GET' });
}

async function ackEnvelopes(acks) {
  return routerRequest('/v1/envelopes/ack', {
    method: 'POST',
    body: JSON.stringify({ acks }),
  });
}

async function rejectEnvelope({ envelopeId, reasonCode, reason }) {
  return routerRequest('/v1/envelopes/reject', {
    method: 'POST',
    body: JSON.stringify({ envelopeId, reasonCode, reason }),
  });
}

async function checkRouterHealth() {
  return routerRequest('/v1/health', { method: 'GET' });
}

async function listDirectoryInstances({ limit = 200 } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(Math.max(1, Math.min(500, Number(limit) || 200))));
  return routerRequest(`/v1/directory/instances?${params.toString()}`, { method: 'GET' });
}

async function listDirectoryRooms({ ownerInstanceId = null, activeOnly = true, limit = 500 } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(Math.max(1, Math.min(1_000, Number(limit) || 500))));
  if (ownerInstanceId) params.set('ownerInstanceId', String(ownerInstanceId));
  if (!activeOnly) params.set('activeOnly', '0');
  return routerRequest(`/v1/directory/rooms?${params.toString()}`, { method: 'GET' });
}

async function publishDirectoryRoom({
  federatedRoomId,
  name,
  description = null,
  joinPolicy = 'request_to_join',
  visibility = 'discoverable',
  tags = [],
  memberCount = null,
  active = true,
}) {
  return routerRequest('/v1/directory/rooms', {
    method: 'POST',
    body: JSON.stringify({
      federatedRoomId,
      name,
      description,
      joinPolicy,
      visibility,
      tags,
      memberCount,
      active,
    }),
  });
}

module.exports = {
  isRouterConfigured,
  buildEnvelope,
  publishEnvelope,
  pullEnvelopes,
  ackEnvelopes,
  rejectEnvelope,
  checkRouterHealth,
  listDirectoryInstances,
  listDirectoryRooms,
  publishDirectoryRoom,
};
