const fs = require('fs');
const path = require('path');
const os = require('os');
const matter = require('gray-matter');

/**
 * Atomically write a file: write to a temp file in the same directory,
 * then rename. This prevents partial/corrupt writes on crash.
 */
function atomicWriteSync(filePath, content) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}

/**
 * Read and parse a ballot markdown file. Returns { data, content } or null.
 */
function readBallotFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return matter(raw);
}

/**
 * Write ballot data back to disk (frontmatter + optional body).
 */
function writeBallotFile(filePath, data, body = '') {
  const markdown = matter.stringify(body, data);
  atomicWriteSync(filePath, markdown);
}

module.exports = { atomicWriteSync, readBallotFile, writeBallotFile };
