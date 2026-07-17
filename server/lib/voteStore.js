const fs = require('fs');
const path = require('path');
const config = require('./config');

/**
 * Per-voter vote storage for room/public ballots.
 *
 * Storage layout:
 *   data/ballots/{ballotId}/votes/{memberId}.json
 *
 * Personal ballots continue to use inline frontmatter votes (handled by voteEngine).
 */

function votesDir(ballotId) {
  return path.join(config.ballotsDir, ballotId, 'votes');
}

function publicVotesDir(ballotId) {
  return path.join(config.ballotsDir, ballotId, 'public-votes');
}

function ensureVotesDir(ballotId) {
  const dir = votesDir(ballotId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensurePublicVotesDir(ballotId) {
  const dir = publicVotesDir(ballotId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Save a member's vote for a room/public ballot.
 */
function saveVote(ballotId, memberId, voteData) {
  ensureVotesDir(ballotId);
  const filePath = path.join(votesDir(ballotId), `${memberId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(voteData, null, 2));
}

/**
 * Get a specific member's vote for a ballot.
 */
function getVote(ballotId, memberId) {
  const filePath = path.join(votesDir(ballotId), `${memberId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Get all votes for a ballot (for results aggregation).
 * Returns array of vote objects.
 */
function getAllVotes(ballotId) {
  const dir = votesDir(ballotId);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
    return JSON.parse(raw);
  });
}

/**
 * Save a pseudonymous public vote record.
 */
function savePublicVote(ballotId, voteKey, voteData) {
  ensurePublicVotesDir(ballotId);
  const filePath = path.join(publicVotesDir(ballotId), `${voteKey}.json`);
  fs.writeFileSync(filePath, JSON.stringify(voteData, null, 2));
}

/**
 * Check if a public voter key has already submitted.
 */
function hasPublicVoted(ballotId, voteKey) {
  const filePath = path.join(publicVotesDir(ballotId), `${voteKey}.json`);
  return fs.existsSync(filePath);
}

/**
 * Get all public vote records for a ballot.
 */
function getAllPublicVotes(ballotId) {
  const dir = publicVotesDir(ballotId);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
    return JSON.parse(raw);
  });
}

/**
 * Get all vote records for results aggregation.
 * For public ballots, include both legacy /votes and /public-votes.
 */
function getAllVotesForBallot(ballot) {
  if (!ballot || !ballot.id) return [];
  const legacyVotes = getAllVotes(ballot.id);
  if (ballot.visibility !== 'public') return legacyVotes;
  return [...legacyVotes, ...getAllPublicVotes(ballot.id)];
}

/**
 * Count how many members have voted.
 */
function getVoteCount(ballotId) {
  const dir = votesDir(ballotId);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).length;
}

/**
 * Check if a specific member has voted.
 */
function hasVoted(ballotId, memberId) {
  const filePath = path.join(votesDir(ballotId), `${memberId}.json`);
  return fs.existsSync(filePath);
}

/**
 * List memberIds that have voted.
 */
function getVoterIds(ballotId) {
  const dir = votesDir(ballotId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

module.exports = {
  saveVote,
  savePublicVote,
  getVote,
  getAllVotes,
  getAllPublicVotes,
  getAllVotesForBallot,
  getVoteCount,
  hasVoted,
  hasPublicVoted,
  getVoterIds,
};
