const { getBallot, createBallot, listBallots, updateBallotFields } = require('./ballotStore');
const { getAllVotesForBallot } = require('./voteStore');
const { seedCommentsFromVotes, reseedResultsComments } = require('./commentStore');

/**
 * Generate a results ballot from a room/public ballot.
 * Aggregates all per-voter votes into a single read-only results ballot.
 */
function generateResults(ballotId) {
  const ballot = getBallot(ballotId);
  if (!ballot) {
    const err = new Error('Source ballot not found');
    err.statusCode = 404;
    throw err;
  }

  const votes = getAllVotesForBallot(ballot);
  if (votes.length === 0) {
    const err = new Error('No votes submitted yet');
    err.statusCode = 400;
    throw err;
  }

  const voters = votes.map(v => v.handle || v.memberId);
  const items = (ballot.items || []).map(item => {
    const voterBreakdown = votes.map(v => {
      const vi = (v.items || []).find(i => i.itemId === item.id);
      return {
        handle: v.handle || v.memberId,
        memberId: v.memberId,
        votes: vi ? vi.votes : 0,
        creditsCost: vi ? vi.creditsCost : 0,
        comment: vi ? (vi.comment || '') : '',
      };
    });

    const totalVotes = voterBreakdown.reduce((sum, vb) => sum + vb.votes, 0);
    const totalCreditsCost = voterBreakdown.reduce((sum, vb) => sum + vb.creditsCost, 0);
    const comments = voterBreakdown.map(vb => vb.comment).filter(Boolean);
    const averageVotes = votes.length > 0 ? +(totalVotes / votes.length).toFixed(2) : 0;

    return {
      id: item.id,
      type: item.type || 'text',
      title: item.title,
      body: item.body || '',
      submittedBy: item.submittedBy || 'Agent',
      semanticTag: item.semanticTag || '',
      totalVotes,
      totalCreditsCost,
      averageVotes,
      voterBreakdown,
      comments,
      // Keep individual vote fields at 0 — this is a results view, not a votable ballot
      votes: 0,
      creditsCost: 0,
      comment: '',
    };
  });

  // Sort items by absolute totalVotes descending
  items.sort((a, b) => Math.abs(b.totalVotes) - Math.abs(a.totalVotes));

  const perVoterCredits = ballot.credits || 100;

  // Idempotent per source: a reopened ballot regenerates into its existing
  // results ballot, preserving its id and comment threads.
  const existing = listBallots().find(b => b.isResults && b.sourceBallotId === ballotId);
  if (existing) {
    const displayItems = items.map((item, i) => ({
      ...item,
      votes: item.totalVotes ?? 0,
      creditsCost: item.totalCreditsCost ?? 0,
      comment: '',
    }));
    const updated = updateBallotFields(existing.id, {
      description: `Combined results from ${votes.length} voter${votes.length === 1 ? '' : 's'}. Source: ${ballotId}`,
      credits: perVoterCredits * votes.length,
      voters,
      voterCount: votes.length,
      items: displayItems,
      regeneratedAt: new Date().toISOString(),
    });
    reseedResultsComments(existing.id, items);
    return updated;
  }

  // Public votes tally into the creator's personal inbox — the results are
  // theirs to collect, not a second public artifact.
  const isPublicSource = ballot.visibility === 'public';
  const resultsBallot = createBallot({
    title: `Results — ${ballot.title}`,
    description: `Combined results from ${votes.length} voter${votes.length === 1 ? '' : 's'}. Source: ${ballotId}`,
    voteType: ballot.voteType || 'qv',
    credits: perVoterCredits * votes.length,
    visibility: isPublicSource ? 'personal' : (ballot.visibility || 'personal'),
    roomId: ballot.roomId || '',
    createdBy: ballot.createdBy || '',
    distributedTo: isPublicSource
      ? (ballot.createdBy ? [ballot.createdBy] : [])
      : (ballot.distributedTo || []),
    isResults: true,
    sourceBallotId: ballotId,
    voters,
    voterCount: votes.length,
    items,
  });

  // Seed the threaded comment store with voter comments
  seedCommentsFromVotes(resultsBallot.id, items, votes);

  return resultsBallot;
}

/**
 * Generate a full agent context pack from a results ballot.
 * This is the single document an agent reads to understand collective decisions.
 */
function resultsToMarkdown(resultsBallot) {
  const lines = [];
  const items = resultsBallot.items || [];
  const voters = resultsBallot.voters || [];
  const voterCount = resultsBallot.voterCount || voters.length;

  lines.push(`# ${resultsBallot.title}`);
  lines.push('');
  lines.push(`> ${resultsBallot.description || ''}`);
  lines.push('');
  lines.push('## Ballot metadata');
  lines.push(`- **Voters**: ${voters.join(', ')} (${voterCount} total)`);
  lines.push(`- **Vote type**: ${resultsBallot.voteType || 'qv'} (quadratic — cost = votes²)`);
  lines.push(`- **Credits per voter**: ${Math.round((resultsBallot.credits || 100) / voterCount)}`);
  lines.push(`- **Source ballot**: ${resultsBallot.sourceBallotId}`);
  lines.push(`- **Room**: ${resultsBallot.roomId || 'none'}`);
  lines.push('');

  // Directive summary — top 3 and bottom
  const ranked = [...items].sort((a, b) => (b.totalVotes || b.votes || 0) - (a.totalVotes || a.votes || 0));
  const top3 = ranked.slice(0, 3);
  const rejected = ranked.filter(i => (i.totalVotes ?? i.votes ?? 0) < 0);

  lines.push('## Collective directive');
  lines.push('');
  lines.push('**Prioritise (highest conviction):**');
  top3.forEach((item, i) => {
    const v = item.totalVotes ?? item.votes ?? 0;
    const c = item.totalCreditsCost ?? item.creditsCost ?? 0;
    lines.push(`${i + 1}. **${item.title}** — ${v > 0 ? '+' : ''}${v} votes, ${c} credits spent`);
  });
  if (rejected.length > 0) {
    lines.push('');
    lines.push('**Rejected (negative votes):**');
    rejected.forEach(item => {
      const v = item.totalVotes ?? item.votes ?? 0;
      lines.push(`- **${item.title}** — ${v} votes`);
    });
  }
  lines.push('');

  // Full ranked breakdown
  lines.push('## Full results (ranked by votes)');
  lines.push('');

  ranked.forEach((item, i) => {
    const v = item.totalVotes ?? item.votes ?? 0;
    const c = item.totalCreditsCost ?? item.creditsCost ?? 0;
    const avg = item.averageVotes ?? 0;

    lines.push(`### ${i + 1}. ${item.title}`);
    if (item.semanticTag) lines.push(`*Tag: ${item.semanticTag}*`);
    lines.push('');
    if (item.body) lines.push(`${item.body}`);
    lines.push('');
    lines.push(`- **Combined votes**: ${v > 0 ? '+' : ''}${v} (avg ${avg} per voter)`);
    lines.push(`- **Credits spent**: ${c}`);
    lines.push('');

    if (item.voterBreakdown && item.voterBreakdown.length > 0) {
      lines.push('| Voter | Votes | Credits | Comment |');
      lines.push('|-------|-------|---------|---------|');
      item.voterBreakdown.forEach(vb => {
        const sign = vb.votes > 0 ? '+' : '';
        const comment = vb.comment ? vb.comment.replace(/\|/g, '/') : '—';
        lines.push(`| ${vb.handle} | ${sign}${vb.votes} | ${vb.creditsCost} | ${comment} |`);
      });
      lines.push('');
    }
  });

  return lines.join('\n');
}


/**
 * Context pack for a completed personal ballot — the single-voter analogue of
 * resultsToMarkdown. Weighted preference at the time of the vote.
 */
function personalContextMarkdown(ballot) {
  const lines = [];
  const items = [...(ballot.items || [])].sort(
    (a, b) => Math.abs(b.creditsCost || 0) - Math.abs(a.creditsCost || 0)
  );

  lines.push(`# Weighted intents — ${ballot.title}`);
  lines.push('');
  lines.push(`> Personal ballot ${ballot.id} · voted ${ballot.votedAt || 'n/a'} · ${ballot.creditsUsed || 0}/${ballot.credits || 100} credits`);
  lines.push('');

  for (const item of items) {
    const votes = item.votes || 0;
    const cost = item.creditsCost || 0;
    const sign = votes > 0 ? '+' : '';
    lines.push(`## [${sign}${votes} votes, ${cost} credits] ${item.title}`);
    if (item.comment) lines.push(`- **Comment**: ${item.comment}`);
    if (item.workstream) lines.push(`- **Workstream**: ${item.workstream}`);
    lines.push('');
  }

  lines.push('_Weighted preference at that time. All signal is signal — low weights included._');
  return lines.join('\n');
}

module.exports = { generateResults, resultsToMarkdown, personalContextMarkdown };
