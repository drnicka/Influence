const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const { readBallotFile, writeBallotFile } = require('./fileUtils');
const { validateBallotInput } = require('./validate');

function ensureDirectories() {
  [config.dataDir, config.ballotsDir, config.historyDir, config.roundsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function listBallots() {
  ensureDirectories();
  const files = fs.readdirSync(config.ballotsDir).filter(f => f.endsWith('.md'));
  const ballots = [];

  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(config.ballotsDir, f), 'utf-8');
      const { data } = matter(content);
      ballots.push(data);
    } catch (err) {
      console.error(`[ballotStore] Skipping corrupt ballot file ${f}:`, err.message);
    }
  }

  const ts = (iso) => {
    if (!iso) return 0;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  };

  const rank = (b) => (b.status === 'open' ? 0 : b.status === 'passed' ? 1 : b.status === 'completed' ? 2 : 3);

  ballots.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) return ts(b.created) - ts(a.created);
    if (ra === 1) return ts(b.passedAt) - ts(a.passedAt);
    if (ra === 2) return ts(b.votedAt) - ts(a.votedAt);
    return ts(b.created) - ts(a.created);
  });

  return ballots;
}

function getBallot(id) {
  const filePath = path.join(config.ballotsDir, `${id}.md`);
  const parsed = readBallotFile(filePath);
  if (!parsed) return null;
  return { ...parsed.data, body: parsed.content };
}

function hashPublicPassword(password) {
  const salt = crypto.randomBytes(8).toString('hex');
  const digest = crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
  return `sha256:${salt}:${digest}`;
}

function verifyPublicPassword(storedHash, candidate) {
  if (!storedHash || !candidate) return false;
  const [algo, salt, digest] = String(storedHash).split(':');
  if (algo !== 'sha256' || !salt || !digest) return false;
  const check = crypto.createHash('sha256').update(`${salt}:${candidate}`).digest('hex');
  const a = Buffer.from(check, 'hex');
  const b = Buffer.from(digest, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function generateShareSlug() {
  return crypto.randomBytes(4).toString('hex');
}

function findBallotByShareSlug(shareSlug) {
  if (!shareSlug) return null;
  const all = listBallots();
  return all.find(b => b.visibility === 'public' && b.shareSlug === shareSlug) || null;
}

function createBallot(ballotData) {
  validateBallotInput(ballotData);
  ensureDirectories();

  const id = ballotData.id || uuidv4();
  const now = new Date().toISOString();

  const isResults = !!ballotData.isResults;

  const items = (ballotData.items || []).map((item, i) => {
    // Results ballots: items arrive fully formed from resultsEngine with
    // totalVotes, voterBreakdown, etc. Map totals into votes/creditsCost
    // so BallotView can render them like completed personal ballots.
    if (isResults) {
      return {
        ...item,
        id: item.id || `item-${i + 1}`,
        votes: item.totalVotes ?? item.votes ?? 0,
        creditsCost: item.totalCreditsCost ?? item.creditsCost ?? 0,
        comment: '',
      };
    }

    return {
      id: item.id || `item-${i + 1}`,
      type: item.type || 'text',
      title: item.title || '',
      body: item.body || '',

      // Optional slide fields (safe to ignore by older clients)
      ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      ...(item.imagePrompt ? { imagePrompt: item.imagePrompt } : {}),
      ...(Array.isArray(item.bullets) ? { bullets: item.bullets } : {}),
      ...(item.layout ? { layout: item.layout } : {}),
      ...(item.workstream ? { workstream: item.workstream } : {}),
      ...(item.ontologyKind ? { ontologyKind: item.ontologyKind } : {}),
      ...(item.costOfDrop !== undefined ? { costOfDrop: String(item.costOfDrop).toLowerCase() } : {}),
      ...(item.doneScore !== undefined ? { doneScore: item.doneScore } : {}),
      ...(item.canonicalPath ? { canonicalPath: item.canonicalPath } : {}),

      submittedBy: item.submittedBy || 'Agent',
      semanticTag: item.semanticTag || '',
      votes: 0,
      creditsCost: 0,
      comment: ''
    };
  });

  const visibility = ballotData.visibility || 'personal';

  const isPublic = visibility === 'public';
  const publicationStatus = ballotData.publicationStatus || (isPublic ? 'draft' : 'published');
  const hashedPassword = ballotData.passwordHash
    ? String(ballotData.passwordHash)
    : (ballotData.password ? hashPublicPassword(String(ballotData.password)) : '');

  const frontmatter = {
    id,
    title: ballotData.title || 'Untitled Ballot',
    description: ballotData.description || '',
    status: ballotData.isResults ? 'completed' : 'open',
    created: now,
    voteType: ballotData.voteType || 'qv',
    credits: ballotData.credits || 100,
    creditsUsed: 0,
    items,
    // Multiplayer fields
    visibility,
    roomId: ballotData.roomId || '',
    createdBy: ballotData.createdBy || '',
    distributedTo: ballotData.distributedTo || [],
    // Results ballot fields
    isResults: ballotData.isResults || false,
    ...(ballotData.sourceBallotId ? { sourceBallotId: ballotData.sourceBallotId } : {}),
    ...(ballotData.voters ? { voters: ballotData.voters } : {}),
    ...(ballotData.voterCount ? { voterCount: ballotData.voterCount } : {}),
    // Public ballot fields
    ...(ballotData.shareSlug ? { shareSlug: ballotData.shareSlug } : {}),
    ...(isPublic ? { publicationStatus } : {}),
    ...(ballotData.publishedAt ? { publishedAt: ballotData.publishedAt } : {}),
    ...(hashedPassword ? { password: hashedPassword } : {}),
    // Existing optional fields
    ...(ballotData.endsAt ? { endsAt: ballotData.endsAt } : {}),
    ...(ballotData.iterationOf ? { iterationOf: ballotData.iterationOf } : {}),
    ...(ballotData.seedComment ? { seedComment: ballotData.seedComment } : {}),
    ...(ballotData.roundId ? { roundId: ballotData.roundId } : {}),
    // Router/federation metadata
    ...(ballotData.routerOriginInstanceId ? { routerOriginInstanceId: ballotData.routerOriginInstanceId } : {}),
    ...(ballotData.routerSourceBallotId ? { routerSourceBallotId: ballotData.routerSourceBallotId } : {}),
  };

  // Image items: copy the source file into the ballot's own images dir so
  // the ballot is self-contained; serve via /api/ballots/:id/images/:itemId.
  // The absolute source path never persists in the frontmatter.
  const imageItems = (ballotData.items || []).filter(i => i && i.imagePath);
  if (imageItems.length > 0) {
    const imagesDir = path.join(config.ballotsDir, id, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    for (let i = 0; i < items.length; i++) {
      const src = (ballotData.items[i] || {}).imagePath;
      if (!src) continue;
      const ext = path.extname(src).toLowerCase() || '.jpg';
      const destName = `${items[i].id}${ext}`;
      fs.copyFileSync(src, path.join(imagesDir, destName));
      items[i].imageFile = destName;
      items[i].imageUrl = `/api/ballots/${id}/images/${items[i].id}`;
      items[i].originalFilename = path.basename(src);
    }
  }

  const filePath = path.join(config.ballotsDir, `${id}.md`);
  writeBallotFile(filePath, frontmatter);
  saveVersion(id, matter.stringify('', frontmatter), 1);

  return frontmatter;
}

function publishPublicBallot(id, opts = {}) {
  const filePath = path.join(config.ballotsDir, `${id}.md`);
  const parsed = readBallotFile(filePath);
  if (!parsed) return null;

  const data = parsed.data;
  if (data.visibility !== 'public') {
    const err = new Error('Ballot is not public');
    err.statusCode = 400;
    throw err;
  }
  if (data.publicationStatus === 'published' && data.shareSlug) return data;

  const all = listBallots();
  const existing = new Set(all.filter(b => b.id !== data.id && b.shareSlug).map(b => b.shareSlug));

  let slug = opts?.shareSlug ? String(opts.shareSlug).trim() : (data.shareSlug ? String(data.shareSlug).trim() : '');
  if (!slug || existing.has(slug)) {
    slug = generateShareSlug();
    while (existing.has(slug)) slug = generateShareSlug();
  }

  data.shareSlug = slug;
  data.publicationStatus = 'published';
  data.publishedAt = new Date().toISOString();

  writeBallotFile(filePath, data);
  const version = getNextVersion(id);
  saveVersion(id, matter.stringify('', data), version);

  return data;
}

// --- Version history ---

function saveVersion(id, content, version) {
  const historyDir = path.join(config.historyDir, id);
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }
  fs.writeFileSync(path.join(historyDir, `v${version}.md`), content);
}

function getNextVersion(id) {
  const historyDir = path.join(config.historyDir, id);
  if (!fs.existsSync(historyDir)) return 1;
  const files = fs.readdirSync(historyDir).filter(f => f.match(/^v\d+\.md$/));
  return files.length + 1;
}

function getHistory(id) {
  const historyDir = path.join(config.historyDir, id);
  if (!fs.existsSync(historyDir)) return [];
  const files = fs.readdirSync(historyDir)
    .filter(f => f.match(/^v\d+\.md$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numA - numB;
    });

  return files.map(f => {
    const content = fs.readFileSync(path.join(historyDir, f), 'utf-8');
    const { data } = matter(content);
    return { version: f.replace('.md', ''), ...data };
  });
}

/**
 * Close a ballot (time expired or 100% voted).
 * Sets status to 'closed' and records closedAt.
 */
function updateBallotFields(id, fields) {
  const filePath = path.join(config.ballotsDir, `${id}.md`);
  const parsed = readBallotFile(filePath);
  if (!parsed) return null;

  const data = { ...parsed.data, ...fields };
  writeBallotFile(filePath, data);
  saveVersion(id, matter.stringify('', data), getNextVersion(id));
  return data;
}

function closeBallot(id) {
  const filePath = path.join(config.ballotsDir, `${id}.md`);
  const parsed = readBallotFile(filePath);
  if (!parsed) return null;

  const data = parsed.data;
  data.status = 'closed';
  data.closedAt = new Date().toISOString();

  writeBallotFile(filePath, data);

  const version = getNextVersion(id);
  saveVersion(id, matter.stringify('', data), version);

  return data;
}

/**
 * List ballots filtered by feed type and member.
 * @param {object} opts
 * @param {string} opts.feed - 'inbox' | 'subscribed' | 'all'
 * @param {string} opts.memberId - current member's ID (null in single-user mode)
 */
// Personal ballots are member-scoped: visible to their creator and anyone in
// distributedTo. Ballots carrying neither field (legacy / single-user era)
// stay visible to everyone.
function personalBallotVisible(b, memberId) {
  const hasOwner = !!b.createdBy;
  const hasAudience = Array.isArray(b.distributedTo) && b.distributedTo.length > 0;
  if (!hasOwner && !hasAudience) return true;
  if (hasOwner && b.createdBy === memberId) return true;
  if (hasAudience && b.distributedTo.includes(memberId)) return true;
  return false;
}

function listBallotsForFeed({ feed = 'all', memberId = null } = {}) {
  const all = listBallots();

  // Single-user mode: return everything (backward compat)
  if (!memberId) return all;

  switch (feed) {
    case 'inbox':
      return all.filter(b =>
        ((b.visibility === 'personal' || !b.visibility) && personalBallotVisible(b, memberId)) ||
        (b.visibility === 'public' && b.createdBy === memberId)
      );
    case 'subscribed':
      return all.filter(b =>
        b.visibility === 'room' &&
        Array.isArray(b.distributedTo) &&
        b.distributedTo.includes(memberId)
      );
    default:
      // 'all': everything the member can see
      return all.filter(b => {
        if (b.visibility === 'personal' || !b.visibility) {
          return personalBallotVisible(b, memberId);
        }
        if (b.visibility === 'room') {
          return Array.isArray(b.distributedTo) && b.distributedTo.includes(memberId);
        }
        if (b.visibility === 'public') return b.createdBy === memberId;
        return true;
      });
  }
}

module.exports = {
  ensureDirectories,
  updateBallotFields,
  listBallots,
  listBallotsForFeed,
  getBallot,
  findBallotByShareSlug,
  createBallot,
  publishPublicBallot,
  verifyPublicPassword,
  closeBallot,
  saveVersion,
  getNextVersion,
  getHistory,
};
