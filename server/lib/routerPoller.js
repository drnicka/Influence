const config = require('./config');
const { isRouterConfigured, pullEnvelopes, ackEnvelopes, rejectEnvelope, publishEnvelope } = require('./routerClient');
const { ingestEnvelope } = require('./routerIngest');
const { getPendingOutbox, markOutboxResult } = require('./routerStore');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function flushOutbox(limit = 50) {
  const pending = getPendingOutbox(limit);
  const result = { attempted: pending.length, sent: 0, failed: 0 };

  for (const item of pending) {
    try {
      await publishEnvelope(item.envelope);
      markOutboxResult(item.localId, { status: 'sent' });
      result.sent += 1;
    } catch (err) {
      const attempts = (item.attempts || 0) + 1;
      const delayMs = Math.min(60_000, Math.pow(2, attempts) * 1000);
      markOutboxResult(item.localId, { status: 'error', error: err.message, delayMs });
      result.failed += 1;
    }
  }

  return result;
}

async function pullAndIngest(limit = 50) {
  const pulled = await pullEnvelopes({ limit });
  const items = Array.isArray(pulled?.items) ? pulled.items : [];

  const acks = [];
  const rejects = [];

  for (const wrapped of items) {
    const envelope = wrapped?.envelope || wrapped;
    try {
      const applied = ingestEnvelope(envelope);
      const status = applied.status === 'duplicate' ? 'duplicate' : 'accepted';
      acks.push({ envelopeId: envelope.envelopeId, status });
    } catch (err) {
      rejects.push({
        envelopeId: envelope?.envelopeId || null,
        reasonCode: 'ingest_failed',
        reason: err.message,
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
      // best-effort reject
    }
  }

  return { pulled: items.length, acked: acks.length, rejected: rejects.length };
}

function startRouterPoller({ intervalMs = 5000, pullLimit = 50 } = {}) {
  if (!isRouterConfigured()) {
    return { ok: false, reason: 'router_not_configured' };
  }

  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      await flushOutbox(Math.min(100, pullLimit));
      await pullAndIngest(Math.min(100, pullLimit));
    } catch (err) {
      // swallow errors to keep loop alive
      console.error('[router-poller]', err.message);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, Math.max(1000, Number(intervalMs) || 5000));
  // kick once on start
  tick().catch(() => {});

  return {
    ok: true,
    stop: async () => {
      clearInterval(timer);
      await delay(10);
    },
  };
}

module.exports = { startRouterPoller };
