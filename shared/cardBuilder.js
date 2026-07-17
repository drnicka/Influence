// shared/cardBuilder.js
// Single source of truth for building Voice ballot items ("cards") in consistent formats.
// Intentionally dependency-free so it can be used by:
// - agents (scripts)
// - server endpoints
// - future board/sub-agent pipelines
//
// Output shape matches Voice storage schema: { id, type, title, body, submittedBy, semanticTag }

function slugId(prefix, title) {
  const base = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'card'
  return `${prefix}-${base}`
}

function section(h, lines = []) {
  const body = (Array.isArray(lines) ? lines : [String(lines)]).filter(Boolean)
  if (body.length === 0) return ''
  return `## ${h}\n${body.join('\n')}\n`
}

function bullets(xs = []) {
  const arr = (Array.isArray(xs) ? xs : [xs]).filter(Boolean)
  if (arr.length === 0) return []
  return arr.map(x => `- ${x}`)
}

function buildTheoryCard({
  id,
  title,
  submittedBy = 'BOSS',
  semanticTag = '',
  coreClaim,
  mechanism = [],
  predictions = [],
  critiques = [],
  falsifiers = [],
} = {}) {
  const bodyParts = [
    section('Core claim', [coreClaim].filter(Boolean)),
    section('Mechanism', bullets(mechanism)),
    section('Predictions / signatures', bullets(predictions)),
    section('Critiques / risks', bullets(critiques)),
    section('What would change my mind', bullets(falsifiers)),
  ].filter(Boolean)

  return {
    id: id || slugId('theory', title),
    type: 'theory',
    title: title || 'Untitled theory',
    body: bodyParts.join('\n'),
    submittedBy,
    semanticTag,
  }
}

function buildStatementCard({
  id,
  title,
  submittedBy = 'BOSS',
  semanticTag = '',
} = {}) {
  return {
    id: id || slugId('stmt', title),
    type: 'statement',
    title: title || 'Untitled statement',
    body: '',
    submittedBy,
    semanticTag,
  }
}

// Standard vote card: default renderer (QuestionCard) with markdown body.
function buildVoteCard({
  id,
  title,
  body = '',
  submittedBy = 'BOSS',
  semanticTag = '',
} = {}) {
  return {
    id: id || slugId('vote', title),
    type: 'text',
    title: title || 'Untitled card',
    body: body || '',
    submittedBy,
    semanticTag,
  }
}

function buildWorkblockCard({
  id,
  title,
  submittedBy = 'BOSS',
  semanticTag = '',
  workstream = '',
  ontologyKind = '',
  costOfDrop,
  doneScore,
  canonicalPath = '',
  timeboxMinutes,
  outcome,
  steps = [],
  definitionOfDone = [],
  notes = [],
} = {}) {
  const bodyParts = [
    section('Timebox', [timeboxMinutes ? `${timeboxMinutes} minutes` : null].filter(Boolean)),
    section('Outcome', [outcome].filter(Boolean)),
    section('Steps', bullets(steps)),
    section('Definition of done', bullets(definitionOfDone)),
    section('Notes', bullets(notes)),
  ].filter(Boolean)

  return {
    id: id || slugId('workblock', title),
    type: 'workblock',
    title: title || 'Untitled workblock',
    body: bodyParts.join('\n'),
    submittedBy,
    semanticTag,
    ...(workstream ? { workstream } : {}),
    ...(ontologyKind ? { ontologyKind } : {}),
    ...(costOfDrop !== undefined ? { costOfDrop: String(costOfDrop).toLowerCase() } : {}),
    ...(doneScore !== undefined ? { doneScore } : {}),
    ...(canonicalPath ? { canonicalPath } : {}),
  }
}

/**
 * Edit card for review ballots: the body IS the document under review.
 * + ratifies as written; − returns with the vote comment as the correction.
 */
function buildEditCard({ id, title, markdown, path: docPath, submittedBy }) {
  return {
    id: id || slugId('edit', title),
    type: 'edit',
    title: title || 'Untitled document',
    body: markdown || '',
    ...(docPath ? { canonicalPath: docPath } : {}),
    submittedBy: submittedBy || 'Agent',
    semanticTag: 'review',
  };
}

module.exports = { buildTheoryCard, buildStatementCard, buildVoteCard, buildWorkblockCard, buildEditCard };
