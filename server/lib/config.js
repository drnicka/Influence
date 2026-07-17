const path = require('path');

function normalizeRouterBaseUrl(rawUrl) {
  if (!rawUrl) return null;
  const trimmed = String(rawUrl).trim();
  // Common misconfig: setting .../router/v1 instead of .../router.
  return trimmed.replace(/\/v1\/?$/, '');
}

function normalizePublicBaseUrl(rawUrl) {
  if (!rawUrl) return null;
  return String(rawUrl).trim().replace(/\/$/, '');
}

const config = {
  port: Number(process.env.VOICE_PORT) || 3001,
  publicBaseUrl: normalizePublicBaseUrl(process.env.VOICE_PUBLIC_BASE_URL || null),
  dataDir: process.env.VOICE_DATA_DIR || path.join(__dirname, '..', '..', 'data'),
  cors: {
    origin: process.env.VOICE_CORS_ORIGIN || '*',
  },
  router: {
    rawUrl: process.env.VOICE_ROUTER_URL || null,
    url: normalizeRouterBaseUrl(process.env.VOICE_ROUTER_URL || null),
    instanceId: process.env.VOICE_INSTANCE_ID || null,
    token: process.env.VOICE_ROUTER_TOKEN || null,
    hmacKey: process.env.VOICE_ROUTER_HMAC_KEY || null,
    adminToken: process.env.VOICE_ROUTER_ADMIN_TOKEN || null,
    pullLimit: Number(process.env.VOICE_ROUTER_PULL_LIMIT) || 50,
    internalKey: process.env.VOICE_INTERNAL_ROUTER_KEY || null,
  },
};

// Derived paths
config.ballotsDir = path.join(config.dataDir, 'ballots');
config.historyDir = path.join(config.dataDir, 'history');
config.roundsDir = path.join(config.dataDir, 'rounds');

module.exports = config;
