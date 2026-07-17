const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

/**
 * Threaded comments for ballots.
 * Stored in data/ballots/{ballotId}/comments.json
 *
 * Each comment: { id, ballotId, itemId, parentId, handle, memberId, text, createdAt }
 * Root comments (from votes) have parentId: null
 * Replies have parentId pointing to another comment's id
 */

function commentsPath(ballotId) {
  return path.join(config.ballotsDir, ballotId, 'comments.json');
}

function ensureDir(ballotId) {
  const dir = path.join(config.ballotsDir, ballotId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadComments(ballotId) {
  const fp = commentsPath(ballotId);
  if (!fs.existsSync(fp)) return [];
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch { return []; }
}

function saveComments(ballotId, comments) {
  ensureDir(ballotId);
  fs.writeFileSync(commentsPath(ballotId), JSON.stringify(comments, null, 2));
}

/**
 * Seed root comments from voter breakdown when a results ballot is created.
 * Called by resultsEngine after generating results.
 */
function seedCommentsFromVotes(ballotId, items, votes) {
  const comments = [];

  for (const item of items) {
    const breakdown = item.voterBreakdown || [];
    for (const vb of breakdown) {
      if (!vb.comment) continue;
      comments.push({
        id: uuidv4(),
        ballotId,
        itemId: item.id,
        parentId: null,
        handle: vb.handle || 'anonymous',
        memberId: vb.memberId || null,
        text: vb.comment,
        votes: vb.votes || 0,
        creditsCost: vb.creditsCost || 0,
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (comments.length > 0) {
    saveComments(ballotId, comments);
  }

  return comments;
}

/**
 * Add a threaded reply to an existing comment.
 */
function addReply(ballotId, { parentId, itemId, handle, memberId, text }) {
  const comments = loadComments(ballotId);

  const reply = {
    id: uuidv4(),
    ballotId,
    itemId: itemId || null,
    parentId: parentId || null,
    handle: handle || 'anonymous',
    memberId: memberId || null,
    text,
    createdAt: new Date().toISOString(),
  };

  comments.push(reply);
  saveComments(ballotId, comments);
  return reply;
}

/**
 * Get all comments for a ballot, organized by item.
 */
function getComments(ballotId) {
  return loadComments(ballotId);
}


/**
 * Re-seed voter comments after results regeneration. Appends only comments
 * from voters not already seeded, preserving existing threads and replies.
 */
function reseedResultsComments(ballotId, items) {
  const existing = loadComments(ballotId);
  const seeded = new Set(
    existing.filter(c => c.votes !== undefined).map(c => `${c.handle}|${c.itemId}`)
  );

  const additions = [];
  for (const item of items) {
    for (const vb of item.voterBreakdown || []) {
      if (!vb.comment) continue;
      const key = `${vb.handle || 'anonymous'}|${item.id}`;
      if (seeded.has(key)) continue;
      additions.push({
        id: uuidv4(),
        ballotId,
        itemId: item.id,
        parentId: null,
        handle: vb.handle || 'anonymous',
        memberId: vb.memberId || null,
        text: vb.comment,
        votes: vb.votes || 0,
        creditsCost: vb.creditsCost || 0,
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (additions.length > 0) {
    saveComments(ballotId, [...existing, ...additions]);
  }
  return additions;
}

module.exports = { seedCommentsFromVotes, reseedResultsComments, addReply, getComments, loadComments };
