const { findMemberByApiKey, isMultiUserMode } = require('../lib/memberStore');

/**
 * Auth middleware.
 *
 * - If no members exist (single-user mode): passes through with req.member = null.
 * - If members exist (multi-user mode): requires X-Voice-Key header.
 *   Missing/invalid key → 401.
 *
 * Attach to routes that need identity. Public endpoints skip this.
 */
function authRequired(req, res, next) {
  // Single-user mode: no members registered yet, everything works as before
  if (!isMultiUserMode()) {
    req.member = null;
    return next();
  }

  const key = req.headers['x-voice-key'] || req.headers['x-api-key'];
  if (!key) {
    return res.status(401).json({ error: 'Authentication required. Set X-Voice-Key (or X-API-Key) header.' });
  }

  const member = findMemberByApiKey(key);
  if (!member) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Strip sensitive fields
  const { apiKeyHash, ...safe } = member;
  req.member = safe;
  next();
}

/**
 * Optional auth — attaches member if key is present, but doesn't reject if missing.
 * Useful for endpoints that behave differently for authed vs anonymous users.
 */
function authOptional(req, res, next) {
  req.member = null;

  const key = req.headers['x-voice-key'] || req.headers['x-api-key'];
  if (key) {
    const member = findMemberByApiKey(key);
    if (member) {
      const { apiKeyHash, ...safe } = member;
      req.member = safe;
    }
  }

  next();
}

module.exports = { authRequired, authOptional };
