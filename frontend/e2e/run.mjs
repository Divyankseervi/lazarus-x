import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(frontendDir, '..');
const backendDir = path.join(repoDir, 'backend');
const tempRoot = path.resolve(os.tmpdir());
const tempDir = await mkdtemp(path.join(tempRoot, 'lazarus-x-e2e-'));
const resolvedTempDir = path.resolve(tempDir);
if (!resolvedTempDir.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolvedTempDir).startsWith('lazarus-x-e2e-')) {
  throw new Error('Refusing to use an E2E temporary path outside the dedicated OS temp namespace.');
}
const children = [];

function startProcess(command, args, options) {
  const child = spawn(command, args, { windowsHide: true, ...options });
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', chunk => { process.stdout.write(chunk); });
  child.stderr?.on('data', chunk => { process.stderr.write(chunk); });
  children.push(child);
  return child;
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = startProcess(command, args, options);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} exited with ${code ?? signal}.`));
    });
  });
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate a local test port.');
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForHttp(url, child, timeoutMs = 30_000, acceptErrorStatus = false) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited before readiness (${child.exitCode}).`);
    try {
      const response = await fetch(url);
      if (response.ok || (acceptErrorStatus && response.status < 500)) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}${lastError ? `: ${lastError.message}` : ''}`);
}

function findSystemBrowser() {
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : [];
  return candidates.find(candidate => existsSync(candidate));
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.killed) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function removeTempDirectoryWithRetry(directory) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await rm(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
      return;
    } catch (error) {
      if (!['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(error?.code) || attempt === 7) throw error;
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
}

try {
  const databaseUrl = `file:${path.join(tempDir, 'e2e.db').replaceAll('\\', '/')}`;
  const prismaCli = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');
  await runCommand(process.execPath, [prismaCli, 'db', 'push', '--schema', path.join(backendDir, 'prisma', 'schema.prisma'), '--skip-generate'], {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: databaseUrl, RUST_LOG: 'info' },
    stdio: 'inherit',
  });

  const apiPort = await freePort();
  const frontendPort = await freePort();
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const frontendUrl = `http://127.0.0.1:${frontendPort}`;
  const apiChild = startProcess(process.execPath, [
    path.join(backendDir, 'node_modules', 'ts-node', 'dist', 'bin.js'),
    '--files', path.join(backendDir, 'src', 'e2e_server.ts'),
  ], {
    cwd: tempDir,
    env: {
      ...process.env,
      CORS_ORIGINS: frontendUrl,
      LAZARUS_E2E_DATABASE_URL: databaseUrl,
      PORT: String(apiPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const frontendChild = startProcess(process.execPath, [
    path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js'),
    '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort',
  ], {
    cwd: frontendDir,
    env: { ...process.env, VITE_API_URL: `${apiUrl}/api` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await Promise.all([waitForHttp(`${apiUrl}/api/cases`, apiChild, 30_000, true), waitForHttp(frontendUrl, frontendChild)]);
  const browserPath = findSystemBrowser();
  const playwrightCli = path.join(frontendDir, 'node_modules', '@playwright', 'test', 'cli.js');
  await runCommand(process.execPath, [playwrightCli, 'test', '--config', path.join(frontendDir, 'playwright.config.ts')], {
    cwd: frontendDir,
    env: {
      ...process.env,
      ...(browserPath ? { LAZARUS_E2E_CHROME: browserPath } : {}),
      LAZARUS_E2E_API_URL: apiUrl,
      LAZARUS_E2E_BASE_URL: frontendUrl,
    },
    stdio: 'inherit',
  });
} finally {
  await Promise.all(children.map(stopProcess));
  await removeTempDirectoryWithRetry(resolvedTempDir);
}
