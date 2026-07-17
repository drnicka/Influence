const fs = require('fs');
const path = require('path');
const config = require('./config');
const { atomicWriteSync } = require('./fileUtils');

const routerDir = path.join(config.dataDir, 'router');
const outboxFile = path.join(routerDir, 'outbox.json');
const dedupeFile = path.join(routerDir, 'dedupe.json');

function ensureRouterDir() {
  if (!fs.existsSync(routerDir)) {
    fs.mkdirSync(routerDir, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureRouterDir();
  atomicWriteSync(filePath, JSON.stringify(value, null, 2));
}

function listOutbox() {
  ensureRouterDir();
  return readJson(outboxFile, []);
}

function saveOutbox(entries) {
  writeJson(outboxFile, entries);
}

function enqueueOutbox(envelope) {
  const entries = listOutbox();
  const now = new Date().toISOString();
  const entry = {
    localId: `out_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    envelope,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: now,
    lastError: null,
  };
  entries.push(entry);
  saveOutbox(entries);
  return entry;
}

function markOutboxResult(localId, { status, error = null, delayMs = 0 } = {}) {
  const entries = listOutbox();
  const idx = entries.findIndex(e => e.localId === localId);
  if (idx === -1) return null;

  const now = Date.now();
  const updated = {
    ...entries[idx],
    status: status || entries[idx].status,
    attempts: (entries[idx].attempts || 0) + 1,
    updatedAt: new Date(now).toISOString(),
    nextAttemptAt: new Date(now + Math.max(0, delayMs)).toISOString(),
    lastError: error ? String(error) : null,
  };

  entries[idx] = updated;
  saveOutbox(entries);
  return updated;
}

function getPendingOutbox(limit = 50) {
  const now = Date.now();
  return listOutbox()
    .filter(e => {
      if (e.status !== 'pending' && e.status !== 'error') return false;
      const nextAt = Date.parse(e.nextAttemptAt || 0);
      return !Number.isFinite(nextAt) || nextAt <= now;
    })
    .slice(0, Math.max(1, Number(limit) || 50));
}

function listDedupe() {
  ensureRouterDir();
  return readJson(dedupeFile, {});
}

function saveDedupe(index) {
  writeJson(dedupeFile, index);
}

function pruneDedupe(days = 30) {
  const maxAgeMs = Math.max(1, days) * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - maxAgeMs;
  const dedupe = listDedupe();

  for (const [id, iso] of Object.entries(dedupe)) {
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts) || ts < cutoff) {
      delete dedupe[id];
    }
  }

  saveDedupe(dedupe);
  return dedupe;
}

function hasSeenEnvelope(envelopeId) {
  if (!envelopeId) return false;
  const dedupe = pruneDedupe(30);
  return !!dedupe[envelopeId];
}

function markEnvelopeSeen(envelopeId) {
  if (!envelopeId) return;
  const dedupe = pruneDedupe(30);
  dedupe[envelopeId] = new Date().toISOString();
  saveDedupe(dedupe);
}

module.exports = {
  enqueueOutbox,
  markOutboxResult,
  getPendingOutbox,
  listOutbox,
  hasSeenEnvelope,
  markEnvelopeSeen,
};
