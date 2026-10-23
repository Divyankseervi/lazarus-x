#!/usr/bin/env node
'use strict';
// Streams a file and compares SHA-256 + size against a versioned intake manifest.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_BYTES = 2 * 1024 * 1024 * 1024;

async function main() {
  const sourceArg = process.argv[2];
  const manifestArg = process.argv[3];
  if (!sourceArg || !manifestArg) {
    console.error('Usage: node scripts/verify_artifact_manifest.js <artifact-path> <manifest.json>');
    process.exitCode = 2;
    return;
  }
  let fd;
  try {
    const source = path.resolve(sourceArg);
    const meta = fs.lstatSync(source);
    if (!meta.isFile() || meta.isSymbolicLink()) throw new Error('Artifact must be a regular, non-symlink file.');
    if (meta.size > MAX_BYTES) throw new Error('Artifact exceeds the 2 GiB verification limit.');
    const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestArg), 'utf8'));
    if (manifest.schemaVersion !== 1 || manifest.hashAlgorithm !== 'SHA-256' ||
        !/^[a-f0-9]{64}$/.test(manifest.sha256) || !Number.isSafeInteger(manifest.sizeBytes) || manifest.sizeBytes < 0) {
      throw new Error('Unsupported or malformed manifest.');
    }
    const noFollow = fs.constants.O_NOFOLLOW || 0;
    fd = fs.openSync(source, fs.constants.O_RDONLY | noFollow);
    const before = fs.fstatSync(fd);
    if (before.dev !== meta.dev || before.ino !== meta.ino) throw new Error('Source changed during verification initialization.');
    if (before.size !== manifest.sizeBytes) throw new Error(`Byte-size mismatch (actual ${before.size}, manifest ${manifest.sizeBytes}).`);
    const hash = crypto.createHash('sha256');
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(source, { fd, autoClose: false });
      stream.on('data', chunk => hash.update(chunk));
      stream.once('error', reject);
      stream.once('end', resolve);
    });
    const after = fs.fstatSync(fd);
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) {
      throw new Error('Source changed while being verified; retry against a stable copy.');
    }
    const digest = hash.digest('hex');
    if (digest !== manifest.sha256) throw new Error('SHA-256 digest mismatch; artifact does not match this manifest.');
    console.log(JSON.stringify({ verified: true, artifact: path.basename(source), bytes: after.size, sha256: digest }, null, 2));
  } catch (error) {
    console.error(`Manifest verification failed: ${error instanceof Error ? error.message : 'Unknown verification error.'}`);
    process.exitCode = 1;
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch {} }
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Unknown verification error.'); process.exitCode = 1; });
