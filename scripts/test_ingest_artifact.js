#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lazarus-intake-test-'));
function run(script, args) {
  return spawnSync(process.execPath, [path.join(root, `scripts/${script}`), ...args], { encoding: 'utf8' });
}
try {
  const source = path.join(tmp, 'sample.db');
  const bytes = Buffer.from('synthetic-forensic-artifact');
  fs.writeFileSync(source, bytes);
  const before = fs.readFileSync(source);
  const out = path.join(tmp, 'manifests');
  const first = run('ingest_artifact.js', [source, out]);
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual(fs.readFileSync(source), before, 'intake must not modify source');
  const files = fs.readdirSync(out);
  assert.equal(files.length, 1);
  const manifestPath = path.join(out, files[0]);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.equal(manifest.sizeBytes, bytes.length);
  assert.equal(manifest.fileContentValidated, false, 'manifest must not claim file format validation');

  const duplicate = run('ingest_artifact.js', [source, out]);
  assert.equal(duplicate.status, 0, duplicate.stderr, 'repeat intake should be idempotent');
  assert.equal(fs.readdirSync(out).length, 1);

  const verify = run('verify_artifact_manifest.js', [source, manifestPath]);
  assert.equal(verify.status, 0, verify.stderr);
  assert.equal(JSON.parse(verify.stdout).verified, true);

  fs.writeFileSync(source, Buffer.from('modified forensic artifact'));
  const changed = run('verify_artifact_manifest.js', [source, manifestPath]);
  assert.notEqual(changed.status, 0, 'modified source must fail manifest verification');

  const bad = path.join(tmp, 'payload.exe');
  fs.writeFileSync(bad, 'no');
  const rejected = run('ingest_artifact.js', [bad, out]);
  assert.notEqual(rejected.status, 0, 'unsupported extensions must be rejected');

  try {
    const link = path.join(tmp, 'linked.db');
    fs.symlinkSync(bad, link);
    const symlink = run('ingest_artifact.js', [link, out]);
    assert.notEqual(symlink.status, 0, 'symbolic links must be rejected');
  } catch (error) {
    if (!['EPERM', 'EACCES', 'ENOSYS', 'ENOTSUP'].includes(error.code)) throw error;
  }

  console.log('Artifact intake smoke tests passed (hashing, immutability, idempotency, verification, tamper detection, extension and symlink rejection).');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
