const { getBallot, createBallot } = require('./ballotStore');

function synthesizeExecutionBallot(sourceBallotId, opts = {}) {
  const topN = Number.isFinite(opts.topN) ? opts.topN : 3;

  const src = getBallot(sourceBallotId);
  if (!src) return null;
  if (src.status !== 'completed') {
    throw new Error('synthesizeExecutionBallot requires source ballot status=completed');
  }

  const ranked = (src.items || [])
    .slice()
    .sort((a, b) => (b.creditsCost || 0) - (a.creditsCost || 0))
    .slice(0, Math.max(1, Math.min(10, topN)));

  const items = ranked.map((it, i) => {
    const sign = (it.votes || 0) >= 0 ? '+' : '';
    const meta = [
      `Source ballot: \`${sourceBallotId}\``,
      `Ranked #${i + 1} by credits`,
      `Votes: ${sign}${it.votes || 0} (cost ${it.creditsCost || 0})`,
      it.comment ? `Note: ${String(it.comment).trim()}` : null,
    ].filter(Boolean).join('\n');

    const body = `**Provenance**\n${meta}\n\n---\n\n${it.body || ''}`.trim();

    return {
      type: 'workblock',
      title: it.title || `Option ${i + 1}`,
      body,
      submittedBy: 'BOSS',
      semanticTag: it.semanticTag || '',
    };
  });

  const title = `EXECUTION — ${src.title || 'Ballot'}`;
  const description = [
    'Binary vote: select ONE execution card.',
    '',
    `Synthesised from completed ballot: ${sourceBallotId}`,
    `Voted at: ${src.votedAt || '—'}`,
    '',
    'If none are right, Pass→Return with feedback and we\'ll regenerate.',
  ].join('\n');

  return createBallot({
    title,
    description,
    voteType: 'binary',
    credits: 1,
    sourceBallotId,
    items,
  });
}

module.exports = { synthesizeExecutionBallot };
