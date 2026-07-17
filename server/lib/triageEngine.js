const path = require('path');
const matter = require('gray-matter');
const config = require('./config');
const { readBallotFile, writeBallotFile } = require('./fileUtils');
const { saveVersion, getNextVersion } = require('./ballotStore');

function passBallot(id, opts = {}) {
  const filePath = path.join(config.ballotsDir, `${id}.md`);
  const parsed = readBallotFile(filePath);
  if (!parsed) return null;

  const data = parsed.data;
  const action = opts.action || 'pass';
  const comment = (opts.comment || '').trim();
  const now = new Date().toISOString();

  if (action === 'return') {
    data.status = 'passed';
    data.passedAt = now;
    data.triageAction = 'return';
    data.returnedAt = now;
    data.returnComment = comment;
    delete data.passComment;
    delete data.burnedAt;
    delete data.burnComment;
  } else if (action === 'burn') {
    data.status = 'burned';
    data.burnedAt = now;
    data.triageAction = 'burn';
    data.burnComment = comment;
    delete data.passedAt;
    delete data.passComment;
    delete data.returnedAt;
    delete data.returnComment;
  } else {
    data.status = 'passed';
    data.passedAt = now;
    data.triageAction = 'pass';
    data.passComment = comment;
    delete data.burnedAt;
    delete data.burnComment;
    delete data.returnedAt;
    delete data.returnComment;
  }

  writeBallotFile(filePath, data);

  const version = getNextVersion(id);
  saveVersion(id, matter.stringify('', data), version);

  return data;
}

module.exports = { passBallot };
