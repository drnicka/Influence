const fs = require('fs');
const path = require('path');
const config = require('./config');
const { atomicWriteSync } = require('./fileUtils');

const relayDir = path.join(config.dataDir, 'router-relay');
const stateFile = path.join(relayDir, 'state.json');

function ensureRelayDir() {
  if (!fs.existsSync(relayDir)) {
    fs.mkdirSync(relayDir, { recursive: true });
  }
}

function emptyState() {
  return {
    instances: {},
    envelopes: {},
    directoryRooms: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function readState() {
  ensureRelayDir();
  if (!fs.existsSync(stateFile)) {
    const initial = emptyState();
    atomicWriteSync(stateFile, JSON.stringify(initial, null, 2));
    return initial;
  }

  try {
    const raw = fs.readFileSync(stateFile, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      instances: parsed.instances || {},
      envelopes: parsed.envelopes || {},
      directoryRooms: parsed.directoryRooms || {},
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    const fallback = emptyState();
    atomicWriteSync(stateFile, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

function writeState(next) {
  const state = {
    ...next,
    updatedAt: new Date().toISOString(),
  };
  ensureRelayDir();
  atomicWriteSync(stateFile, JSON.stringify(state, null, 2));
  return state;
}

function getInstanceById(instanceId) {
  const state = readState();
  return state.instances[instanceId] || null;
}

function getInstanceByToken(token) {
  if (!token) return null;
  const state = readState();
  return Object.values(state.instances).find(inst => inst.token === token && inst.enabled !== false) || null;
}

function upsertInstance({
  instanceId,
  token,
  hmacKey,
  enabled = true,
  displayName = null,
  instanceUrl = null,
  summary = null,
  tags = [],
}) {
  const state = readState();
  const prev = state.instances[instanceId] || null;
  const now = new Date().toISOString();

  state.instances[instanceId] = {
    instanceId,
    token,
    hmacKey,
    enabled: enabled !== false,
    displayName: displayName || prev?.displayName || instanceId,
    instanceUrl: instanceUrl || prev?.instanceUrl || null,
    summary: summary || prev?.summary || null,
    tags: Array.isArray(tags) ? tags : prev?.tags || [],
    lastSeenAt: now,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };

  writeState(state);
  return state.instances[instanceId];
}

function listDirectoryInstances({ includeDisabled = false, limit = 200 } = {}) {
  const state = readState();
  const max = Math.max(1, Math.min(500, Number(limit) || 200));

  return Object.values(state.instances)
    .filter(inst => includeDisabled || inst.enabled !== false)
    .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
    .slice(0, max)
    .map(inst => ({
      instanceId: inst.instanceId,
      enabled: inst.enabled !== false,
      displayName: inst.displayName || inst.instanceId,
      instanceUrl: inst.instanceUrl || null,
      summary: inst.summary || null,
      tags: Array.isArray(inst.tags) ? inst.tags : [],
      createdAt: inst.createdAt || null,
      updatedAt: inst.updatedAt || null,
      lastSeenAt: inst.lastSeenAt || inst.updatedAt || null,
    }));
}

function upsertDirectoryRoom({
  ownerInstanceId,
  federatedRoomId,
  name,
  description = null,
  joinPolicy = 'request_to_join',
  visibility = 'discoverable',
  tags = [],
  memberCount = null,
  active = true,
}) {
  if (!ownerInstanceId || !federatedRoomId || !name) {
    const err = new Error('ownerInstanceId, federatedRoomId, and name are required');
    err.statusCode = 400;
    throw err;
  }

  const state = readState();
  const roomKey = `${ownerInstanceId}:${federatedRoomId}`;
  const prev = state.directoryRooms[roomKey] || null;
  const now = new Date().toISOString();

  const record = {
    roomKey,
    ownerInstanceId,
    federatedRoomId,
    name,
    description: description || null,
    joinPolicy: joinPolicy || 'request_to_join',
    visibility: visibility || 'discoverable',
    tags: Array.isArray(tags) ? tags : [],
    memberCount: Number.isFinite(Number(memberCount)) ? Number(memberCount) : null,
    active: active !== false,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };

  state.directoryRooms[roomKey] = record;
  writeState(state);
  return record;
}

function listDirectoryRooms({ ownerInstanceId = null, activeOnly = true, limit = 500 } = {}) {
  const state = readState();
  const max = Math.max(1, Math.min(1_000, Number(limit) || 500));

  return Object.values(state.directoryRooms || {})
    .filter(room => {
      if (ownerInstanceId && room.ownerInstanceId !== ownerInstanceId) return false;
      if (activeOnly && room.active === false) return false;
      return true;
    })
    .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
    .slice(0, max);
}

function upsertEnvelope(envelope) {
  const state = readState();
  const envelopeId = envelope.envelopeId;
  const existing = state.envelopes[envelopeId] || null;

  if (existing) {
    return { created: false, record: existing };
  }

  const targetInstanceId = envelope?.target?.instanceId || null;
  const now = new Date().toISOString();

  const record = {
    envelopeId,
    originInstanceId: envelope?.origin?.instanceId || null,
    targetInstanceId,
    createdAt: now,
    envelope,
    deliveries: targetInstanceId
      ? {
          [targetInstanceId]: {
            status: 'pending',
            attempts: 0,
            lastDeliveredAt: null,
            lastAckAt: null,
            lastError: null,
          },
        }
      : {},
  };

  state.envelopes[envelopeId] = record;
  writeState(state);
  return { created: true, record };
}

function getEnvelopeRecord(envelopeId) {
  const state = readState();
  return state.envelopes[envelopeId] || null;
}

function pullEnvelopesForInstance(instanceId, limit = 50) {
  const state = readState();
  const max = Math.max(1, Math.min(100, Number(limit) || 50));

  const all = Object.values(state.envelopes)
    .filter(rec => rec.deliveries && rec.deliveries[instanceId])
    .filter(rec => {
      const status = rec.deliveries[instanceId].status;
      return status === 'pending' || status === 'delivered';
    })
    .sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0))
    .slice(0, max);

  const now = new Date().toISOString();
  for (const rec of all) {
    const d = rec.deliveries[instanceId];
    d.status = 'delivered';
    d.attempts = Number(d.attempts || 0) + 1;
    d.lastDeliveredAt = now;
  }

  writeState(state);
  return all;
}

function ackEnvelopesForInstance(instanceId, acks = []) {
  const state = readState();
  const now = new Date().toISOString();
  const applied = [];

  for (const ack of acks) {
    const rec = state.envelopes[ack.envelopeId];
    if (!rec || !rec.deliveries[instanceId]) continue;

    const status = ack.status === 'duplicate' ? 'duplicate' : 'accepted';
    rec.deliveries[instanceId].status = status;
    rec.deliveries[instanceId].lastAckAt = now;
    rec.deliveries[instanceId].lastError = null;

    applied.push({ envelopeId: ack.envelopeId, status });
  }

  writeState(state);
  return applied;
}

function rejectEnvelopeForInstance(instanceId, { envelopeId, reasonCode, reason }) {
  const state = readState();
  const rec = state.envelopes[envelopeId];
  if (!rec || !rec.deliveries[instanceId]) return null;

  rec.deliveries[instanceId].status = 'rejected';
  rec.deliveries[instanceId].lastAckAt = new Date().toISOString();
  rec.deliveries[instanceId].lastError = `${reasonCode || 'rejected'}: ${reason || ''}`.trim();

  writeState(state);
  return {
    envelopeId,
    status: 'rejected',
    reasonCode: reasonCode || 'rejected',
  };
}

function replayEnvelope(envelopeId, instanceId = null) {
  const state = readState();
  const rec = state.envelopes[envelopeId];
  if (!rec) return null;

  const now = new Date().toISOString();

  if (instanceId) {
    if (!rec.deliveries[instanceId]) return null;
    rec.deliveries[instanceId].status = 'pending';
    rec.deliveries[instanceId].lastError = null;
    rec.deliveries[instanceId].lastAckAt = now;
  } else {
    for (const d of Object.values(rec.deliveries || {})) {
      d.status = 'pending';
      d.lastError = null;
      d.lastAckAt = now;
    }
  }

  writeState(state);
  return rec;
}

function getQueueStats(instanceId) {
  const state = readState();
  let pending = 0;
  let delivered = 0;
  let accepted = 0;
  let duplicate = 0;
  let rejected = 0;

  for (const rec of Object.values(state.envelopes)) {
    const d = rec.deliveries?.[instanceId];
    if (!d) continue;
    if (d.status === 'pending') pending += 1;
    else if (d.status === 'delivered') delivered += 1;
    else if (d.status === 'accepted') accepted += 1;
    else if (d.status === 'duplicate') duplicate += 1;
    else if (d.status === 'rejected') rejected += 1;
  }

  return { instanceId, pending, delivered, accepted, duplicate, rejected };
}

function listEnvelopeAudit({ instanceId = null, limit = 100 } = {}) {
  const max = Math.max(1, Math.min(500, Number(limit) || 100));
  const state = readState();

  const rows = Object.values(state.envelopes)
    .filter(rec => {
      if (!instanceId) return true;
      return rec.originInstanceId === instanceId || rec.targetInstanceId === instanceId;
    })
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))
    .slice(0, max)
    .map(rec => ({
      envelopeId: rec.envelopeId,
      eventType: rec.envelope?.eventType || null,
      originInstanceId: rec.originInstanceId,
      targetInstanceId: rec.targetInstanceId,
      createdAt: rec.createdAt,
      deliveries: rec.deliveries,
    }));

  return rows;
}

module.exports = {
  getInstanceById,
  getInstanceByToken,
  upsertInstance,
  listDirectoryInstances,
  upsertDirectoryRoom,
  listDirectoryRooms,
  upsertEnvelope,
  getEnvelopeRecord,
  pullEnvelopesForInstance,
  ackEnvelopesForInstance,
  rejectEnvelopeForInstance,
  replayEnvelope,
  getQueueStats,
  listEnvelopeAudit,
};
