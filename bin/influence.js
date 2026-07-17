#!/usr/bin/env node
/**
 * influence — spawn the influence/ pattern into a host repo and register it
 * with the context home (~/.influence): a map, not a warehouse.
 *
 * Commands:
 *   influence init [--api-url <url>]   copy skeleton into ./influence, register repo
 *   influence update                   refresh protocol docs from templates (keeps your data)
 *   influence home                     list registered repos (the map)
 *   influence serve [--port <n>]       start the Influence server, detached
 *   influence status                   is it running? health + pid + repos
 *   influence stop                     stop the served instance
 *
 * Deliberately a dumb file-copier (consensus ballot e9c6e798): no network,
 * no deps, never overwrites existing files.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME_DIR = process.env.INFLUENCE_HOME || path.join(os.homedir(), '.influence');
const INDEX_PATH = path.join(HOME_DIR, 'home.json');
const TEMPLATE_DIR = path.join(__dirname, '..', 'templates', 'influence');
const APP_ROOT = path.join(__dirname, '..');
const PID_PATH = path.join(HOME_DIR, 'server.pid');
const SERVE_LOG = path.join(HOME_DIR, 'server.log');

function readServeState() {
  try { return JSON.parse(fs.readFileSync(PID_PATH, 'utf-8')); } catch { return null; }
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function fetchHealth(port) {
  return new Promise(resolve => {
    const req = require('http').get({ host: 'localhost', port, path: '/api/health', timeout: 2500 }, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function copySkeleton(srcDir, destDir, report) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, ent.name);
    const dest = path.join(destDir, ent.name);
    if (ent.isDirectory()) {
      copySkeleton(src, dest, report);
    } else if (fs.existsSync(dest)) {
      report.skipped.push(dest);
    } else {
      fs.copyFileSync(src, dest);
      report.copied.push(dest);
    }
  }
}

function loadIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  } catch {
    return { repos: [] };
  }
}

function saveIndex(index) {
  fs.mkdirSync(HOME_DIR, { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

function ensureHomeReadme() {
  const p = path.join(HOME_DIR, 'HOME.md');
  if (fs.existsSync(p)) return;
  fs.mkdirSync(HOME_DIR, { recursive: true });
  fs.writeFileSync(p, `# Influence context home

A map, not a warehouse. \`home.json\` indexes every repo spawned with
\`influence init\`; content stays in the host repos. Agents: read this index,
navigate to a repo's \`influence/ORIENTATION.md\`, and you are vote-capable.

Ratified architecture: index-never-copy, one Influence server serves all repos,
ontology by consent (scans propose, votes ratify), portfolio-level ballots
use the same QV mechanics as everything else.
`);
}

function cmdInit(args) {
  const repoRoot = process.cwd();
  const apiIdx = args.indexOf('--api-url');
  const apiUrl = apiIdx !== -1 && args[apiIdx + 1] ? args[apiIdx + 1] : 'http://localhost:3001';

  if (!fs.existsSync(TEMPLATE_DIR)) {
    console.error(`influence: template dir missing (${TEMPLATE_DIR})`);
    process.exit(1);
  }

  const report = { copied: [], skipped: [] };
  const dest = path.join(repoRoot, 'influence');
  copySkeleton(TEMPLATE_DIR, dest, report);

  // Repo-local pointer: which app instance and which home this repo talks to.
  const configPath = path.join(dest, 'influence.json');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({
      apiUrl,
      home: HOME_DIR,
      spawnedAt: new Date().toISOString(),
    }, null, 2));
    report.copied.push(configPath);
  }

  ensureHomeReadme();
  const index = loadIndex();
  const existing = index.repos.find(r => r.path === repoRoot);
  if (existing) {
    existing.updatedAt = new Date().toISOString();
  } else {
    index.repos.push({
      name: path.basename(repoRoot),
      path: repoRoot,
      apiUrl,
      registeredAt: new Date().toISOString(),
    });
  }
  saveIndex(index);

  const rel = p => path.relative(repoRoot, p);
  console.log(`influence: spawned in ${repoRoot}`);
  for (const f of report.copied) console.log(`  + ${rel(f)}`);
  for (const f of report.skipped) console.log(`  = ${rel(f)} (kept existing)`);
  console.log(`  ~ registered in ${INDEX_PATH} (${index.repos.length} repo${index.repos.length === 1 ? '' : 's'})`);
  console.log(`
Next:
  1. Point your agent at influence/ORIENTATION.md — one read makes it vote-capable.
  2. Influence server: ${apiUrl} (start one with \`npm run dev\` in the Influence repo).
  3. First move: the Spawn protocol — vote 1 weighs repo priorities, vote 2
     creates workstream folders (+ creates, − declines). The agent must watch
     each vote and act on the result.`);
}

// Refresh protocol docs from templates, overwriting. Never touches
// influence.json, workstream folders, or any file outside the doc set.
const PROTOCOL_DOCS = [
  'ORIENTATION.md',
  'CONVENTIONS.md',
  'roles/README.md',
  'roles/simplicity.md',
  'roles/capability.md',
  'roles/clarity.md',
];

function cmdUpdate() {
  const dest = path.join(process.cwd(), 'influence');
  if (!fs.existsSync(dest)) {
    console.error('influence: no influence/ folder here — run `influence init` first');
    process.exit(1);
  }
  for (const rel of PROTOCOL_DOCS) {
    const src = path.join(TEMPLATE_DIR, rel);
    if (!fs.existsSync(src)) continue;
    const target = path.join(dest, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(src, target);
    console.log(`  ↻ influence/${rel}`);
  }
  // workstreams/README.md only if the ontology hasn't been voted in yet
  const wsReadme = path.join(dest, 'workstreams', 'README.md');
  const wsDir = path.join(dest, 'workstreams');
  const hasWorkstreams = fs.existsSync(wsDir) &&
    fs.readdirSync(wsDir, { withFileTypes: true }).some(e => e.isDirectory());
  if (!hasWorkstreams) {
    fs.mkdirSync(wsDir, { recursive: true });
    fs.copyFileSync(path.join(TEMPLATE_DIR, 'workstreams', 'README.md'), wsReadme);
    console.log('  ↻ influence/workstreams/README.md');
  } else {
    console.log('  = influence/workstreams/ (kept — ontology already voted in)');
  }
  console.log('influence: protocol docs refreshed. Re-read influence/ORIENTATION.md.');
}

async function cmdServe(args) {
  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 && args[portIdx + 1] ? Number(args[portIdx + 1]) : 3001;

  const existing = await fetchHealth(port);
  if (existing) {
    console.log(`influence: already serving on :${port} (${existing.name}, multiUser: ${existing.multiUser})`);
    return;
  }

  fs.mkdirSync(HOME_DIR, { recursive: true });
  const out = fs.openSync(SERVE_LOG, 'a');
  const child = require('child_process').spawn(process.execPath, [path.join(APP_ROOT, 'server', 'index.js')], {
    cwd: APP_ROOT,
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, VOICE_PORT: String(port) },
  });
  child.unref();
  fs.writeFileSync(PID_PATH, JSON.stringify({ pid: child.pid, port, startedAt: new Date().toISOString() }, null, 2));

  // confirm it actually came up
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    const h = await fetchHealth(port);
    if (h) {
      console.log(`influence: serving on http://localhost:${port} (pid ${child.pid}, log ${SERVE_LOG})`);
      return;
    }
  }
  console.error(`influence: server did not come up — see ${SERVE_LOG}`);
  process.exit(1);
}

async function cmdStatus() {
  const state = readServeState();
  const port = state?.port || 3001;
  const health = await fetchHealth(port);
  const index = loadIndex();

  if (health) {
    const via = state && pidAlive(state.pid) ? `pid ${state.pid} (influence serve)` : 'external process';
    console.log(`● running — http://localhost:${port} · ${via}`);
    console.log(`  mode: ${health.mode || '?'} · multiUser: ${health.multiUser} · dataDir: ${health.dataDir}`);
  } else {
    console.log(`○ not running on :${port} — start with \`influence serve${port !== 3001 ? ' --port ' + port : ''}\``);
  }
  console.log(`  repos: ${index.repos.length} registered (\`influence home\`)`);
}

function cmdStop() {
  const state = readServeState();
  if (!state || !pidAlive(state.pid)) {
    console.log('influence: nothing to stop (no live pid on record — an externally started server must be stopped where it was started)');
    if (state) fs.rmSync(PID_PATH, { force: true });
    return;
  }
  process.kill(state.pid);
  fs.rmSync(PID_PATH, { force: true });
  console.log(`influence: stopped pid ${state.pid} (was :${state.port})`);
}

function cmdHome() {
  const index = loadIndex();
  if (index.repos.length === 0) {
    console.log(`influence home: empty (${INDEX_PATH}). Run \`influence init\` inside a repo.`);
    return;
  }
  console.log(`influence home — ${index.repos.length} repo(s) (${INDEX_PATH})`);
  for (const r of index.repos) {
    console.log(`  ${r.name.padEnd(24)} ${r.path}  →  ${r.apiUrl}`);
  }
}

const [, , cmd, ...rest] = process.argv;
if (cmd === 'init') cmdInit(rest);
else if (cmd === 'update') cmdUpdate();
else if (cmd === 'home') cmdHome();
else if (cmd === 'serve') cmdServe(rest);
else if (cmd === 'status') cmdStatus();
else if (cmd === 'stop') cmdStop();
else {
  console.log('usage: influence init [--api-url <url>] | update | home | serve [--port <n>] | status | stop');
  process.exit(cmd ? 1 : 0);
}
