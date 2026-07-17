/**
 * storage.js — Re-export facade.
 * All logic has been split into focused modules.
 * This file exists for backward compatibility with existing route imports.
 */
const { ensureDirectories, listBallots, getBallot, createBallot, getHistory } = require('./ballotStore');
const { submitVotes, reopenBallot } = require('./voteEngine');
const { passBallot } = require('./triageEngine');
const { startNewRound } = require('./roundManager');
const { synthesizeExecutionBallot } = require('./synthesizer');

module.exports = {
  ensureDirectories,
  listBallots,
  getBallot,
  createBallot,
  submitVotes,
  reopenBallot,
  passBallot,
  getHistory,
  synthesizeExecutionBallot,
  startNewRound,
};
