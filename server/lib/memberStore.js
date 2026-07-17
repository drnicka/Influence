const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

const membersDir = path.join(config.dataDir, 'members');

function ensureMembersDir() {
  if (!fs.existsSync(membersDir)) {
    fs.mkdirSync(membersDir, { recursive: true });
  }
}

function generateApiKey() {
  return 'vk_' + crypto.randomBytes(24).toString('hex');
}

function hashApiKey(plainKey) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + plainKey).digest('hex');
  return `sha256:${salt}:${hash}`;
}

function verifyApiKey(plainKey, stored) {
  const [, salt, hash] = stored.split(':');
  const check = crypto.createHash('sha256').update(salt + plainKey).digest('hex');
  const a = Buffer.from(check, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function listMembers() {
  ensureMembersDir();
  const files = fs.readdirSync(membersDir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const raw = fs.readFileSync(path.join(membersDir, f), 'utf-8');
    const member = JSON.parse(raw);
    const { apiKeyHash, ...safe } = member;
    return safe;
  });
}

function getMember(id) {
  const filePath = path.join(membersDir, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getMemberByHandle(handle) {
  const members = listMembersRaw();
  return members.find(m => m.handle === handle) || null;
}

function findMemberByApiKey(plainKey) {
  const members = listMembersRaw();
  return members.find(m => verifyApiKey(plainKey, m.apiKeyHash)) || null;
}

function createMember({ handle, displayName }) {
  ensureMembersDir();

  if (!handle || typeof handle !== 'string' || handle.length < 2) {
    const err = new Error('handle must be at least 2 characters');
    err.statusCode = 400;
    throw err;
  }

  const normalized = handle.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (normalized !== handle) {
    const err = new Error('handle must be lowercase alphanumeric, hyphens, or underscores');
    err.statusCode = 400;
    throw err;
  }

  if (getMemberByHandle(handle)) {
    const err = new Error(`handle "${handle}" is already taken`);
    err.statusCode = 409;
    throw err;
  }

  const id = uuidv4();
  const apiKey = generateApiKey();
  const member = {
    id,
    handle,
    displayName: displayName || handle,
    apiKeyHash: hashApiKey(apiKey),
    instanceUrl: null,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(membersDir, `${id}.json`), JSON.stringify(member, null, 2));

  // Return the plaintext key exactly once
  return { ...member, apiKey };
}

function updateMember(id, updates) {
  const member = getMember(id);
  if (!member) return null;

  if (updates.displayName !== undefined) member.displayName = updates.displayName;
  if (updates.instanceUrl !== undefined) member.instanceUrl = updates.instanceUrl;

  fs.writeFileSync(path.join(membersDir, `${id}.json`), JSON.stringify(member, null, 2));

  const { apiKeyHash, ...safe } = member;
  return safe;
}

function isMultiUserMode() {
  ensureMembersDir();
  const files = fs.readdirSync(membersDir).filter(f => f.endsWith('.json'));
  return files.length > 0;
}

// Internal: list with apiKeyHash included (for auth lookups)
function listMembersRaw() {
  ensureMembersDir();
  const files = fs.readdirSync(membersDir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(membersDir, f), 'utf-8')));
}

module.exports = {
  ensureMembersDir,
  listMembers,
  getMember,
  getMemberByHandle,
  findMemberByApiKey,
  createMember,
  updateMember,
  isMultiUserMode,
};
