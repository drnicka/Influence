const assert = require('assert');
const { validateBallotInput, ValidationError } = require('../server/lib/validate');

function shouldNotThrow(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}:`, err.message);
    process.exitCode = 1;
  }
}

function shouldThrow(name, fn, expectedMessagePart) {
  try {
    fn();
    console.error(`FAIL ${name}: expected error`);
    process.exitCode = 1;
  } catch (err) {
    if (!(err instanceof ValidationError)) {
      console.error(`FAIL ${name}: wrong error type ${err?.name || typeof err}`);
      process.exitCode = 1;
      return;
    }
    if (expectedMessagePart && !String(err.message).includes(expectedMessagePart)) {
      console.error(`FAIL ${name}: message mismatch '${err.message}'`);
      process.exitCode = 1;
      return;
    }
    console.log(`PASS ${name}`);
  }
}

shouldNotThrow('legacy ballot payload (no semantic fields)', () => {
  validateBallotInput({
    title: 'Legacy',
    items: [{ title: 'Simple item' }],
    voteType: 'qv',
    credits: 100,
  });
});

shouldNotThrow('valid semantic payload', () => {
  validateBallotInput({
    title: 'Semantic',
    items: [{
      type: 'workblock',
      title: 'Ship wave',
      semanticTag: 'Workblock/Jito',
      workstream: 'Jito',
      ontologyKind: 'obligation',
      costOfDrop: 'critical',
      doneScore: 0.6,
      canonicalPath: 'vaults/polished/Jito/obligations.md',
    }],
  });
});

shouldThrow('invalid ontologyKind', () => {
  validateBallotInput({
    title: 'Bad ontology',
    items: [{ title: 'x', ontologyKind: 'maybe' }],
  });
}, 'ontologyKind');

shouldThrow('invalid doneScore bounds', () => {
  validateBallotInput({
    title: 'Bad score',
    items: [{ title: 'x', doneScore: 1.25 }],
  });
}, 'doneScore');

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('All semantic validation tests passed.');
