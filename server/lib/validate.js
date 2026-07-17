/**
 * Validation helpers for ballot and vote payloads.
 * Throws descriptive errors on invalid input.
 */

function validateBallotInput(body) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object');
  }
  if (body.title !== undefined && typeof body.title !== 'string') {
    throw new ValidationError('title must be a string');
  }
  if (body.items !== undefined) {
    if (!Array.isArray(body.items)) {
      throw new ValidationError('items must be an array');
    }
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      if (!item || typeof item !== 'object') {
        throw new ValidationError(`items[${i}] must be an object`);
      }
      if (item.type !== undefined && typeof item.type !== 'string') {
        throw new ValidationError(`items[${i}].type must be a string`);
      }
      if (item.title !== undefined && typeof item.title !== 'string') {
        throw new ValidationError(`items[${i}].title must be a string`);
      }
      if (item.semanticTag !== undefined && typeof item.semanticTag !== 'string') {
        throw new ValidationError(`items[${i}].semanticTag must be a string`);
      }

      // Optional workblock semantic fields (legacy payloads remain valid).
      if (item.workstream !== undefined && typeof item.workstream !== 'string') {
        throw new ValidationError(`items[${i}].workstream must be a string`);
      }
      if (item.ontologyKind !== undefined && !['obligation', 'intent', 'experiment'].includes(item.ontologyKind)) {
        throw new ValidationError(`items[${i}].ontologyKind must be "obligation", "intent", or "experiment"`);
      }
      if (item.costOfDrop !== undefined && !['low', 'medium', 'high', 'critical'].includes(String(item.costOfDrop).toLowerCase())) {
        throw new ValidationError(`items[${i}].costOfDrop must be "low", "medium", "high", or "critical"`);
      }
      if (item.doneScore !== undefined) {
        if (typeof item.doneScore !== 'number' || item.doneScore < 0 || item.doneScore > 1) {
          throw new ValidationError(`items[${i}].doneScore must be a number between 0 and 1`);
        }
      }
      if (item.canonicalPath !== undefined && typeof item.canonicalPath !== 'string') {
        throw new ValidationError(`items[${i}].canonicalPath must be a string`);
      }
    }
  }
  if (body.voteType !== undefined && !['qv', 'binary', 'execution'].includes(body.voteType)) {
    throw new ValidationError('voteType must be "qv", "binary", or "execution"');
  }
  if (body.credits !== undefined) {
    if (typeof body.credits !== 'number' || body.credits < 1) {
      throw new ValidationError('credits must be a positive number');
    }
  }
  if (body.endsAt !== undefined && typeof body.endsAt !== 'string') {
    throw new ValidationError('endsAt must be an ISO date string');
  }
  if (body.visibility !== undefined && !['personal', 'room', 'public'].includes(body.visibility)) {
    throw new ValidationError('visibility must be "personal", "room", or "public"');
  }
  if (body.publicationStatus !== undefined && !['draft', 'published'].includes(body.publicationStatus)) {
    throw new ValidationError('publicationStatus must be "draft" or "published"');
  }
  if (body.shareSlug !== undefined && typeof body.shareSlug !== 'string') {
    throw new ValidationError('shareSlug must be a string');
  }
  if (body.password !== undefined && typeof body.password !== 'string') {
    throw new ValidationError('password must be a string');
  }
  if (body.passwordHash !== undefined && typeof body.passwordHash !== 'string') {
    throw new ValidationError('passwordHash must be a string');
  }
}

function validateVoteInput(votes, ballot) {
  if (!Array.isArray(votes)) {
    throw new ValidationError('votes must be an array');
  }

  const voteType = (ballot.voteType || 'qv').toLowerCase();
  const maxCredits = ballot.credits || 100;

  for (let i = 0; i < votes.length; i++) {
    const v = votes[i];
    if (!v || typeof v !== 'object') {
      throw new ValidationError(`votes[${i}] must be an object`);
    }
    if (!v.itemId || typeof v.itemId !== 'string') {
      throw new ValidationError(`votes[${i}].itemId is required and must be a string`);
    }
    if (v.votes !== undefined && typeof v.votes !== 'number') {
      throw new ValidationError(`votes[${i}].votes must be a number`);
    }
    if (v.comment !== undefined && typeof v.comment !== 'string') {
      throw new ValidationError(`votes[${i}].comment must be a string`);
    }
    if (v.layout !== undefined && typeof v.layout !== 'string') {
      throw new ValidationError(`votes[${i}].layout must be a string`);
    }
    if (v.imagePrompt !== undefined && typeof v.imagePrompt !== 'string') {
      throw new ValidationError(`votes[${i}].imagePrompt must be a string`);
    }
  }

  // Server-side credit limit enforcement
  if (voteType === 'execution') {
    for (let i = 0; i < votes.length; i++) {
      const c = votes[i].votes;
      if (c !== undefined && c !== 1 && c !== -1 && c !== 0) {
        throw new ValidationError(`execution voteType: votes[${i}].votes must be 1 (yes), -1 (no), or 0 (undecided)`);
      }
    }
  } else if (voteType === 'binary') {
    const nonZero = votes.filter(v => (v.votes || 0) !== 0);
    if (nonZero.length > 1) {
      throw new ValidationError('binary voteType allows at most one selected item');
    }
  } else {
    const totalCost = votes.reduce((sum, v) => {
      const count = v.votes || 0;
      return sum + (count * count);
    }, 0);
    if (totalCost > maxCredits) {
      throw new ValidationError(`Total credit cost (${totalCost}) exceeds budget (${maxCredits})`);
    }
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

module.exports = { validateBallotInput, validateVoteInput, ValidationError };
