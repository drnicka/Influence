const path = require('path');
const matter = require('gray-matter');
const config = require('./config');
const { readBallotFile, writeBallotFile } = require('./fileUtils');
const { validateVoteInput } = require('./validate');
const { saveVersion, getNextVersion } = require('./ballotStore');

function submitVotes(id, votes) {
  const filePath = path.join(config.ballotsDir, `${id}.md`);
  const parsed = readBallotFile(filePath);
  if (!parsed) return null;

  const data = parsed.data;
  validateVoteInput(votes, data);

  const now = new Date().toISOString();
  let totalCreditsUsed = 0;
  const voteType = (data.voteType || 'qv').toLowerCase();

  if (voteType === 'execution') {
    // A queue of independent yes/no decisions: ±1 per item, cost 1 per decision.
    data.items = data.items.map(item => {
      const vote = votes.find(v => v.itemId === item.id);
      const decision = vote ? Math.sign(vote.votes || 0) : 0;
      const creditsCost = decision !== 0 ? 1 : 0;
      totalCreditsUsed += creditsCost;
      return {
        ...item,
        votes: decision,
        creditsCost,
        comment: (vote && typeof vote.comment === 'string') ? vote.comment : (item.comment || ''),
      };
    });
  } else if (voteType === 'binary') {
    data.items = data.items.map(item => {
      const vote = votes.find(v => v.itemId === item.id);
      const voteCount = vote ? (vote.votes || 0) : 0;
      const selected = voteCount !== 0;
      const creditsCost = selected ? 1 : 0;
      totalCreditsUsed += creditsCost;
      return {
        ...item,
        votes: selected ? 1 : 0,
        creditsCost,
        comment: (vote && typeof vote.comment === 'string') ? vote.comment : (item.comment || ''),
        ...(vote && typeof vote.layout === 'string' ? { layout: vote.layout } : {}),
        ...(vote && typeof vote.imagePrompt === 'string' ? { imagePrompt: vote.imagePrompt } : {})
      };
    });
  } else {
    data.items = data.items.map(item => {
      const vote = votes.find(v => v.itemId === item.id);
      if (vote) {
        const voteCount = vote.votes || 0;
        const creditsCost = voteCount * voteCount;
        totalCreditsUsed += creditsCost;
        return {
          ...item,
          votes: voteCount,
          creditsCost,
          comment: vote.comment || item.comment || '',
          ...(typeof vote.layout === 'string' ? { layout: vote.layout } : {}),
          ...(typeof vote.imagePrompt === 'string' ? { imagePrompt: vote.imagePrompt } : {})
        };
      }
      return item;
    });
  }

  data.creditsUsed = totalCreditsUsed;
  data.votedAt = now;
  data.status = 'completed';

  const body = generateVoteSummary(data);
  writeBallotFile(filePath, data, body);

  const version = getNextVersion(id);
  saveVersion(id, matter.stringify(body, data), version);

  return data;
}

function reopenBallot(id) {
  const filePath = path.join(config.ballotsDir, `${id}.md`);
  const parsed = readBallotFile(filePath);
  if (!parsed) return null;

  const data = parsed.data;
  data.status = 'open';
  data.creditsUsed = 0;
  data.reopenedAt = new Date().toISOString();
  delete data.votedAt;
  delete data.passedAt;
  data.items = data.items.map(item => ({
    ...item,
    votes: 0,
    creditsCost: 0,
    comment: ''
  }));

  writeBallotFile(filePath, data);

  const version = getNextVersion(id);
  saveVersion(id, matter.stringify('', data), version);

  return data;
}

function generateVoteSummary(data) {
  let md = `# Ballot: ${data.title}\n\n`;
  md += `## Summary\n`;
  md += `- **Total Credits Used**: ${data.creditsUsed} of ${data.credits}\n`;

  const votedItems = data.items.filter(i => i.votes !== 0);
  md += `- **Items Voted On**: ${votedItems.length} of ${data.items.length}\n`;
  md += `- **Voted At**: ${data.votedAt}\n\n`;

  md += `## Votes\n\n`;
  data.items.forEach((item, i) => {
    const sign = item.votes >= 0 ? '+' : '';
    md += `### Q${i + 1}: ${item.title}\n`;
    md += `- **Votes**: ${sign}${item.votes} (${item.creditsCost} credits)\n`;
    if (item.comment) {
      md += `- **Comment**: ${item.comment}\n`;
    }
    if (item.semanticTag) {
      md += `- **Semantic Tag**: ${item.semanticTag}\n`;
    }
    md += '\n';
  });

  return md;
}

module.exports = { submitVotes, reopenBallot };
