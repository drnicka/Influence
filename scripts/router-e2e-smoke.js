const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');
const { spawn } = require('child_process');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : null;
      server.close(err => {
        if (err) return reject(err);
        if (!port) return reject(new Error('Unable to allocate free port'));
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

function requestJson(method, urlString, { headers = {}, body = undefined, timeoutMs = 12_000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = body === undefined ? null : JSON.stringify(body);

    const req = client.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
        timeout: timeoutMs,
      },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = { raw };
          }
          resolve({ status: res.statusCode || 0, body: parsed, raw });
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error(`Request timed out after ${timeoutMs}ms`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function startServer({ name, cwd, env }) {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', chunk => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', chunk => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  return child;
}

async function stopServer(child) {
  if (!child || child.killed) return;

  await new Promise(resolve => {
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    child.once('exit', finish);
    child.kill('SIGTERM');

    setTimeout(() => {
      if (!done) {
        child.kill('SIGKILL');
      }
      finish();
    }, 3_000);
  });
}

async function waitForHealth(baseUrl, label) {
  let lastErr = null;
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await requestJson('GET', `${baseUrl}/api/health`, { timeoutMs: 2_000 });
      if (res.status === 200) return;
      lastErr = new Error(`${label} health returned ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await sleep(250);
  }
  throw new Error(`${label} did not become healthy: ${lastErr ? lastErr.message : 'unknown error'}`);
}

function assertStatus(res, expectedStatuses, context) {
  if (expectedStatuses.includes(res.status)) return;
  const details = res.body && typeof res.body === 'object' ? JSON.stringify(res.body) : String(res.raw || '');
  throw new Error(`${context} failed (${res.status}). Response: ${details}`);
}

function ensureDependencyInstalled(repoRoot, pkgName) {
  try {
    require.resolve(pkgName, { paths: [repoRoot] });
  } catch {
    throw new Error(
      `Missing dependency '${pkgName}'. Run 'npm install' in the repo root before running this smoke test.`
    );
  }
}

async function main() {
  const repoRoot = path.join(__dirname, '..');
  ensureDependencyInstalled(repoRoot, 'express');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-router-e2e-'));

  const routerPort = Number(process.env.VOICE_E2E_ROUTER_PORT) || (await getFreePort());
  const instanceAPort = Number(process.env.VOICE_E2E_INSTANCE_A_PORT) || (await getFreePort());
  const instanceBPort = Number(process.env.VOICE_E2E_INSTANCE_B_PORT) || (await getFreePort());

  const sharedHmacKey = process.env.VOICE_E2E_HMAC_KEY || 'voice-e2e-shared-hmac-key';
  const adminToken = process.env.VOICE_E2E_ADMIN_TOKEN || 'voice-e2e-admin-token';

  const instanceA = {
    id: 'inst_e2e_a',
    token: 'token-e2e-a',
    internalKey: 'internal-e2e-a',
    port: instanceAPort,
    dataDir: path.join(tmpRoot, 'instance-a'),
  };

  const instanceB = {
    id: 'inst_e2e_b',
    token: 'token-e2e-b',
    internalKey: 'internal-e2e-b',
    port: instanceBPort,
    dataDir: path.join(tmpRoot, 'instance-b'),
  };

  const routerServer = {
    port: routerPort,
    dataDir: path.join(tmpRoot, 'router'),
  };

  for (const dir of [instanceA.dataDir, instanceB.dataDir, routerServer.dataDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const routerBase = `http://127.0.0.1:${routerServer.port}/router`;
  const aBase = `http://127.0.0.1:${instanceA.port}`;
  const bBase = `http://127.0.0.1:${instanceB.port}`;

  const children = [];

  try {
    children.push(
      startServer({
        name: 'router',
        cwd: repoRoot,
        env: {
          VOICE_PORT: String(routerServer.port),
          VOICE_DATA_DIR: routerServer.dataDir,
          VOICE_ROUTER_ADMIN_TOKEN: adminToken,
        },
      })
    );

    children.push(
      startServer({
        name: 'inst-a',
        cwd: repoRoot,
        env: {
          VOICE_PORT: String(instanceA.port),
          VOICE_DATA_DIR: instanceA.dataDir,
          VOICE_ROUTER_URL: routerBase,
          VOICE_INSTANCE_ID: instanceA.id,
          VOICE_ROUTER_TOKEN: instanceA.token,
          VOICE_ROUTER_HMAC_KEY: sharedHmacKey,
          VOICE_INTERNAL_ROUTER_KEY: instanceA.internalKey,
        },
      })
    );

    children.push(
      startServer({
        name: 'inst-b',
        cwd: repoRoot,
        env: {
          VOICE_PORT: String(instanceB.port),
          VOICE_DATA_DIR: instanceB.dataDir,
          VOICE_ROUTER_URL: routerBase,
          VOICE_INSTANCE_ID: instanceB.id,
          VOICE_ROUTER_TOKEN: instanceB.token,
          VOICE_ROUTER_HMAC_KEY: sharedHmacKey,
          VOICE_INTERNAL_ROUTER_KEY: instanceB.internalKey,
        },
      })
    );

    await Promise.all([
      waitForHealth(`http://127.0.0.1:${routerServer.port}`, 'router'),
      waitForHealth(aBase, 'instance A'),
      waitForHealth(bBase, 'instance B'),
    ]);

    console.log('\n[step] Registering instances in router key registry');
    const registerA = await requestJson('POST', `${routerBase}/_internal/instances/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { instanceId: instanceA.id, token: instanceA.token, hmacKey: sharedHmacKey },
    });
    assertStatus(registerA, [200, 201], 'register instance A');

    const registerB = await requestJson('POST', `${routerBase}/_internal/instances/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { instanceId: instanceB.id, token: instanceB.token, hmacKey: sharedHmacKey },
    });
    assertStatus(registerB, [200, 201], 'register instance B');

    const ballotId = `router-e2e-${Date.now()}`;
    const sourceBallotBody = {
      id: ballotId,
      title: 'Router E2E Smoke Ballot',
      description: 'Ballot should replicate from instance A to instance B via router.',
      voteType: 'qv',
      credits: 100,
      visibility: 'public',
      distributedTo: ['remote-voter'],
      endsAt: new Date(Date.now() + 1500).toISOString(),
      items: [
        {
          id: 'item-1',
          type: 'text',
          title: 'Ship the router relay',
          body: 'This ballot is created by e2e smoke test.',
        },
      ],
    };

    console.log('[step] Creating source ballot on instance A');
    const sourceCreate = await requestJson('POST', `${aBase}/api/ballots`, {
      body: sourceBallotBody,
    });
    assertStatus(sourceCreate, [201], 'create source ballot on instance A');

    const publishBody = {
      eventType: 'ballot.created',
      targetInstanceId: instanceB.id,
      entity: { ballotId, sourceBallotId: ballotId },
      payload: {
        ballot: sourceCreate.body,
      },
    };

    console.log('[step] Publishing ballot.created from instance A');
    const publishRes = await requestJson('POST', `${aBase}/internal/router/publish`, {
      headers: { 'X-Voice-Internal-Key': instanceA.internalKey },
      body: publishBody,
    });
    assertStatus(publishRes, [201], 'publish envelope from instance A');

    console.log('[step] Pull + ingest ballot.created on instance B');
    const pullRes = await requestJson('POST', `${bBase}/internal/router/pull`, {
      headers: { 'X-Voice-Internal-Key': instanceB.internalKey },
      body: { limit: 20 },
    });
    assertStatus(pullRes, [200], 'pull/ingest ballot.created on instance B');

    if (!pullRes.body || pullRes.body.pulled < 1 || pullRes.body.acked < 1) {
      throw new Error(`Expected at least one pulled+acked envelope. Got: ${JSON.stringify(pullRes.body)}`);
    }

    console.log('[step] Verifying replicated ballot exists on instance B');
    const ballotRes = await requestJson('GET', `${bBase}/api/ballots/${ballotId}`);
    assertStatus(ballotRes, [200], 'verify ballot on instance B');

    if (!ballotRes.body || ballotRes.body.id !== ballotId) {
      throw new Error(`Unexpected ballot payload on instance B: ${JSON.stringify(ballotRes.body)}`);
    }

    console.log('[step] Submitting vote on instance B (should publish vote.submitted)');
    const voteRes = await requestJson('POST', `${bBase}/api/ballots/${ballotId}/vote`, {
      body: {
        votes: [{ itemId: 'item-1', votes: 3, comment: 'Looks good' }],
      },
    });
    assertStatus(voteRes, [200], 'submit vote on instance B');

    console.log('[step] Pull + ingest vote.submitted on instance A');
    let voteIngested = false;
    for (let i = 0; i < 8; i += 1) {
      const pullVotesOnA = await requestJson('POST', `${aBase}/internal/router/pull`, {
        headers: { 'X-Voice-Internal-Key': instanceA.internalKey },
        body: { limit: 20 },
      });
      assertStatus(pullVotesOnA, [200], 'pull/ingest vote.submitted on instance A');

      const votesCheck = await requestJson('GET', `${aBase}/api/ballots/${ballotId}/votes`);
      if (votesCheck.status === 200 && Array.isArray(votesCheck.body) && votesCheck.body.length > 0) {
        voteIngested = true;
        break;
      }
      await sleep(350);
    }
    if (!voteIngested) {
      throw new Error('vote.submitted did not ingest on instance A within retry window');
    }

    console.log('[step] Triggering expiry checks on instance A (should generate results + publish results.generated)');
    let resultsOnA = null;
    for (let i = 0; i < 10; i += 1) {
      await sleep(400);
      const listA = await requestJson('GET', `${aBase}/api/ballots`);
      assertStatus(listA, [200], 'list ballots on instance A');
      resultsOnA = (Array.isArray(listA.body) ? listA.body : []).find(
        b => b && b.isResults && b.sourceBallotId === ballotId
      );
      if (resultsOnA && resultsOnA.id) break;
    }
    if (!resultsOnA || !resultsOnA.id) {
      const finalListA = await requestJson('GET', `${aBase}/api/ballots`);
      throw new Error(`Expected results ballot on instance A for ${ballotId}. Got: ${JSON.stringify(finalListA.body)}`);
    }

    console.log('[step] Pull + ingest results.generated on instance B');
    const pullResultsOnB = await requestJson('POST', `${bBase}/internal/router/pull`, {
      headers: { 'X-Voice-Internal-Key': instanceB.internalKey },
      body: { limit: 20 },
    });
    assertStatus(pullResultsOnB, [200], 'pull/ingest results.generated on instance B');

    console.log('[step] Verifying results ballot exists on instance B');
    let resultsB = null;
    for (let i = 0; i < 10; i += 1) {
      // Pull again in case results.generated arrived slightly after prior pull window.
      const repull = await requestJson('POST', `${bBase}/internal/router/pull`, {
        headers: { 'X-Voice-Internal-Key': instanceB.internalKey },
        body: { limit: 20 },
      });
      assertStatus(repull, [200], 'repull results.generated on instance B');

      const check = await requestJson('GET', `${bBase}/api/ballots/${resultsOnA.id}`);
      if (check.status === 200) {
        resultsB = check;
        break;
      }
      await sleep(300);
    }

    if (!resultsB) {
      const debugListB = await requestJson('GET', `${bBase}/api/ballots`);
      throw new Error(`verify results ballot on instance B failed after retries. ballots=${JSON.stringify(debugListB.body)}`);
    }

    if (!resultsB.body || !resultsB.body.isResults || resultsB.body.sourceBallotId !== ballotId) {
      throw new Error(`Unexpected results ballot payload on instance B: ${JSON.stringify(resultsB.body)}`);
    }

    console.log('\n✅ Router E2E smoke test passed');
    console.log(`- ballotId: ${ballotId}`);
    console.log(`- resultsBallotId: ${resultsOnA.id}`);
    console.log(`- router: ${routerBase}`);
    console.log(`- instance A: ${aBase}`);
    console.log(`- instance B: ${bBase}`);
    console.log(`- temp data: ${tmpRoot}`);
  } finally {
    for (const child of children.reverse()) {
      // eslint-disable-next-line no-await-in-loop
      await stopServer(child);
    }
  }
}

main().catch(err => {
  console.error('\n❌ Router E2E smoke test failed');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
