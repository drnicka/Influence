const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const ROUTER_DIR = path.join(DATA_DIR, 'router');
const POINTER_PATH = path.join(ROUTER_DIR, 'latest_ballot_context.json');

function writeLatestBallotContext({ ballotId, source = 'vote.submit', memberId = null, votedAt = null }) {
  if (!ballotId) return null;
  const payload = {
    ballotId: String(ballotId),
    source: String(source || 'vote.submit'),
    memberId: memberId || null,
    votedAt: votedAt || null,
    updatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(ROUTER_DIR, { recursive: true });
  fs.writeFileSync(POINTER_PATH, JSON.stringify(payload, null, 2));
  return payload;
}

function readLatestBallotContext() {
  try {
    if (!fs.existsSync(POINTER_PATH)) return null;
    const raw = fs.readFileSync(POINTER_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (!data || !data.ballotId) return null;
    return data;
  } catch {
    return null;
  }
}

module.exports = {
  writeLatestBallotContext,
  readLatestBallotContext,
  POINTER_PATH,
};
