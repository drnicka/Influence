const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const config = require('./config');
const { listBallots } = require('./ballotStore');
const { saveVersion, getNextVersion } = require('./ballotStore');
const { atomicWriteSync } = require('./fileUtils');

function startNewRound({ regenLimit = 5 } = {}) {
  const now = new Date().toISOString();
  const roundId = `round-${now}`;

  const all = listBallots();
  const candidates = all
    .filter(b => b.status === 'passed' && b.triageAction === 'return' && b.returnComment && !b.iterationRequestedAt)
    .sort((a, b) => Date.parse(b.returnedAt || b.passedAt || b.created || 0) - Date.parse(a.returnedAt || a.passedAt || a.created || 0))
    .slice(0, Math.max(0, regenLimit));

  const queue = [];

  for (const b of candidates) {
    const filePath = path.join(config.ballotsDir, `${b.id}.md`);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(raw);
    const d = parsed.data || {};

    d.iterationRequestedAt = now;
    d.iterationRoundId = roundId;

    const markdown = matter.stringify(parsed.content || '', d);
    atomicWriteSync(filePath, markdown);
    saveVersion(b.id, markdown, getNextVersion(b.id));

    queue.push({
      ballotId: b.id,
      title: b.title,
      description: b.description || '',
      returnComment: b.returnComment,
      items: (b.items || []).map(it => ({
        id: it.id,
        type: it.type,
        title: it.title,
        body: it.body,
        submittedBy: it.submittedBy,
        semanticTag: it.semanticTag,
      })),
      credits: b.credits || 100,
    });
  }

  if (!fs.existsSync(config.roundsDir)) {
    fs.mkdirSync(config.roundsDir, { recursive: true });
  }
  const queuePath = path.join(config.roundsDir, `${roundId}.json`);
  atomicWriteSync(queuePath, JSON.stringify({ roundId, createdAt: now, queue }, null, 2));

  return { roundId, queued: queue.map(q => q.ballotId) };
}

module.exports = { startNewRound };
