const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Load env (OPENROUTER_API_KEY, etc). Prefer repo root .env, then server/.env.
try {
  const dotenv = require('dotenv');
  dotenv.config();
  dotenv.config({ path: path.join(__dirname, '.env') });
} catch (_) {
  // dotenv is optional in some environments
}

const config = require('./lib/config');
if (config.router?.rawUrl && config.router?.url && config.router.rawUrl !== config.router.url) {
  console.warn(`[router-config] Normalized VOICE_ROUTER_URL from "${config.router.rawUrl}" to "${config.router.url}" (use /router base, not /router/v1)`);
}
const { ensureDirectories } = require('./lib/ballotStore');
const { ensureMembersDir, isMultiUserMode } = require('./lib/memberStore');
const { ensureRoomsDir } = require('./lib/roomStore');
const { ValidationError } = require('./lib/validate');

function getStartRouterPoller() {
  try {
    const mod = require('./lib/routerPoller');
    return mod.startRouterPoller;
  } catch (err) {
    // Allow startup in environments where router poller module is not present.
    if (err && err.code === 'MODULE_NOT_FOUND' && String(err.message || '').includes('./lib/routerPoller')) {
      return null;
    }
    throw err;
  }
}

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.cors.origin }));
app.use(express.json({ limit: '2mb' }));

// Anonymous public voting is the spam surface — keep it on a tight budget.
app.use('/api/public', rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api', rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));

ensureDirectories();
ensureMembersDir();
ensureRoomsDir();

// Routes — local-first surface: ballots, rooms, members, feeds, rounds,
// plus the router (agents' ballot transport) scoped to the local network.
app.use('/api/members', require('./routes/members'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/feed', require('./routes/feed'));
app.use('/api/ballots', require('./routes/ballots'));
app.use('/api/round', require('./routes/round'));
app.use('/api/context', require('./routes/context'));
app.use('/api/public', require('./routes/public'));
app.use('/internal/router', require('./routes/routerInternal'));
app.use('/router/v1', require('./routes/routerRelayPublic'));
app.use('/router/_internal', require('./routes/routerRelayInternal'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Influence API',
    mode: 'local-first',
    dataDir: config.dataDir,
    multiUser: isMultiUserMode(),
  });
});

// Serve static client build in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  if (status === 500) console.error('[voice-api]', err);
  res.status(status).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Voice API running on http://localhost:${config.port}`);
  console.log(`Data directory: ${config.dataDir}`);

  if (process.env.VOICE_ROUTER_POLL_ENABLED === '1') {
    const startRouterPoller = getStartRouterPoller();
    if (!startRouterPoller) {
      console.warn('[router-poller] not started: module ./lib/routerPoller is missing');
      return;
    }

    const intervalMs = Number(process.env.VOICE_ROUTER_POLL_INTERVAL_MS) || 5000;
    const pullLimit = Number(process.env.VOICE_ROUTER_PULL_LIMIT) || 50;
    const started = startRouterPoller({ intervalMs, pullLimit });
    if (started.ok) {
      console.log(`[router-poller] started (intervalMs=${intervalMs}, pullLimit=${pullLimit})`);
    } else {
      console.warn(`[router-poller] not started: ${started.reason}`);
    }
  }
});
