#!/usr/bin/env node
'use strict';
// Read-only forensic intake. Hashes the file through a read-only file descriptor and
// writes a manifest; it never parses or changes the evidence artifact itself.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB intake cap
const ALLOWED_EXTENSIONS = new Set(['.db', '.sqlite', '.sqlite3', '.db3', '.wal', '.shm', '.journal']);

function fail(message, exitCode = 1) {
  console.error(`Artifact intake error: ${message}`);
  process.exitCode = exitCode;
}

async function main() {
  const sourceArg = process.argv[2];
  const outputArg = process.argv[3] || './evidence-manifests';
  if (!sourceArg) {
    fail('Usage: node scripts/ingest_artifact.js <artifact-path> [manifest-directory]', 2);
    return;
  }

  const source = path.resolve(sourceArg);
  const outputDir = path.resolve(outputArg);
  let fd;
  try {
    const lstat = fs.lstatSync(source);
    if (lstat.isSymbolicLink()) throw new Error('Symbolic links are rejected; provide the original regular file path.');
    if (!lstat.isFile()) throw new Error('Artifact must be a regular file.');
    if (!ALLOWED_EXTENSIONS.has(path.extname(source).toLowerCase())) {
      throw new Error(`Unsupported extension. Accepted: ${[...ALLOWED_EXTENSIONS].join(', ')}`);
    }
    if (lstat.size > MAX_BYTES) throw new Error('Artifact exceeds the 2 GiB intake limit.');

    const noFollow = fs.constants.O_NOFOLLOW || 0;
    fd = fs.openSync(source, fs.constants.O_RDONLY | noFollow);
    const before = fs.fstatSync(fd);
    if (!before.isFile()) throw new Error('Artifact is not a regular file.');
    if (lstat.dev !== before.dev || lstat.ino !== before.ino) throw new Error('Source changed during intake initialization; retry from a stable path.');
    if (before.size > MAX_BYTES) throw new Error('Artifact exceeds the 2 GiB intake limit.');

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
      throw new Error('Source changed while being hashed; discard this manifest and retry from a stable artifact.');
    }
    if (after.size > MAX_BYTES) throw new Error('Artifact grew beyond the 2 GiB intake limit while being hashed.');
    const sha256 = hash.digest('hex');
    const collectedAt = new Date().toISOString();
    const manifest = {
      schemaVersion: 1,
      artifactName: path.basename(source),
      sizeBytes: after.size,
      modifiedAt: after.mtime.toISOString(),
      collectedAt,
      hashAlgorithm: 'SHA-256',
      sha256,
      fileContentValidated: false,
      handling: 'Source opened read-only and hashed; no copy or modification performed.',
      limitation: 'The extension is only an intake filter. This command does not validate the artifact format or prove authenticity/legal admissibility. The hash can later verify byte identity against this manifest.'
    };

    fs.mkdirSync(outputDir, { recursive: true });
    const target = path.join(outputDir, `${sha256}.manifest.json`);
    if (fs.existsSync(target)) {
      const prior = JSON.parse(fs.readFileSync(target, 'utf8'));
      if (prior.sha256 !== sha256 || prior.sizeBytes !== after.size) {
        throw new Error('Existing manifest conflicts with the computed digest; investigate the manifest directory.');
      }
      console.log(target);
      return;
    }

    const temp = `${target}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(temp, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      // Hard-link creation is atomic and does not overwrite a concurrently-created manifest.
      try { fs.linkSync(temp, target); }
      catch (error) {
        if (error && error.code === 'EEXIST') {
          const prior = JSON.parse(fs.readFileSync(target, 'utf8'));
          if (prior.sha256 !== sha256 || prior.sizeBytes !== after.size) throw error;
        } else throw error;
      }
    } finally {
      try { fs.unlinkSync(temp); } catch {}
    }
    console.log(target);
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Unknown intake error.');
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
  }
}

main().catch(error => fail(error instanceof Error ? error.message : 'Unknown intake error.'));
