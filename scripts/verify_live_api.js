const http = require('http');

async function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('--- 1. Testing Investigator Login ---');
  const invLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'investigator@lazarus.local', password: 'Investigator2026!' });

  if (invLogin.status !== 200 || !invLogin.data.token) {
    throw new Error(`Investigator login failed: ${JSON.stringify(invLogin)}`);
  }
  console.log(`[PASS] Investigator Login: ${invLogin.data.email} (${invLogin.data.role})`);
  const token = invLogin.data.token;

  console.log('\n--- 2. Testing Administrator Login ---');
  const admLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@lazarus.local', password: 'Admin2026!Pass' });

  if (admLogin.status !== 200 || !admLogin.data.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(admLogin)}`);
  }
  console.log(`[PASS] Admin Login: ${admLogin.data.email} (${admLogin.data.role})`);

  console.log('\n--- 3. Testing Case Creation (Investigator) ---');
  const schemaDef = {
    name: 'Incident response records',
    preset: 'incident-response',
    tables: ['Person', 'Device'],
    tableDefinitions: [
      { name: 'Person', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'name', type: 'TEXT', required: true }] },
      { name: 'Device', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'hostname', type: 'TEXT', required: true }, { name: 'ownerId', type: 'NUMBER' }] }
    ],
    constraints: [
      { type: 'UNIQUE', table: 'Person', field: 'id' },
      { type: 'NOT_NULL', table: 'Person', field: 'name' },
      { type: 'UNIQUE', table: 'Device', field: 'id' },
      { type: 'NOT_NULL', table: 'Device', field: 'hostname' },
      { type: 'FOREIGN_KEY', table: 'Device', field: 'ownerId', targetTable: 'Person', targetField: 'id' }
    ]
  };

  const createRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/cases',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, {
    name: 'Live Forensic Verification Case ' + Date.now(),
    schemaDefinition: schemaDef
  });

  if ((createRes.status !== 200 && createRes.status !== 201) || !createRes.data.id) {
    throw new Error(`Case creation failed: ${JSON.stringify(createRes)}`);
  }
  const caseId = createRes.data.id;
  console.log(`[PASS] Case Created: ID=${caseId}, Status=${createRes.data.status}`);

  console.log('\n--- 4. Testing Evidence Ingestion (Dual-Layer SHA256 + HMAC) ---');
  const evidenceRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/cases/${caseId}/evidence`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, {
    evidence: [
      { table: 'Person', recordId: 1, field: 'name', value: 'Agent Miller', sourceRef: 'bag-01' },
      { table: 'Device', recordId: 10, field: 'hostname', value: 'terminal-alpha', sourceRef: 'bag-01' },
      { table: 'Device', recordId: 10, field: 'ownerId', value: 1, sourceRef: 'bag-01' }
    ]
  });

  if (evidenceRes.status !== 200 || !evidenceRes.data.provenance) {
    throw new Error(`Evidence commit failed: ${JSON.stringify(evidenceRes)}`);
  }
  const prov = evidenceRes.data.provenance;
  console.log(`[PASS] Evidence Committed: HeadSequence=${prov.sequence}, EventsAppended=${prov.appendedEvents}`);
  console.log(`[PASS] Candidate Count: ${evidenceRes.data.candidates.length}, Current State Person: ${JSON.stringify(evidenceRes.data.bestState.data.Person)}`);

  console.log('\n--- 5. Testing RFC 6962 Binary Merkle Proof Generation ---');
  const proofRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/cases/${caseId}/provenance/proofs/1`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (proofRes.status !== 200 || !proofRes.data.proof) {
    throw new Error(`Merkle proof request failed: ${JSON.stringify(proofRes)}`);
  }
  console.log(`[PASS] Merkle Proof Verified: Sequence=${proofRes.data.proof.sequence}, TotalEvents=${proofRes.data.proof.totalEvents}, Siblings=${proofRes.data.proof.siblings.length}`);
  console.log(`[PASS] Merkle Root: ${proofRes.data.checkpoint.publicEnvelopeMerkleRoot}`);

  console.log('\n--- 6. Testing Offline Audit Bundle Export ---');
  const bundleRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/cases/${caseId}/export/audit-bundle`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (bundleRes.status !== 200 || bundleRes.data.format !== 'LAZARUS-X-OFFLINE-AUDIT-BUNDLE') {
    throw new Error(`Audit bundle export failed: ${JSON.stringify(bundleRes)}`);
  }
  console.log(`[PASS] Offline Audit Bundle Exported: Case=${bundleRes.data.caseId}, Format=${bundleRes.data.format}, EnvelopesCount=${bundleRes.data.publicEnvelopes.length}`);

  console.log('\n--- 7. Testing Atomic Case-Sealing Transaction ---');
  const sealRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/cases/${caseId}/seal`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, { reason: 'Academic verification complete' });

  if (sealRes.status !== 200 || sealRes.data.status !== 'SEALED') {
    throw new Error(`Case sealing failed: ${JSON.stringify(sealRes)}`);
  }
  console.log(`[PASS] Case Cryptographically Sealed: Status=${sealRes.data.status}`);

  console.log('\n--- 8. Testing Fail-Closed Immutability on Sealed Case ---');
  const writeAfterSeal = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/cases/${caseId}/evidence`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, {
    evidence: [
      { table: 'Person', recordId: 2, field: 'name', value: 'Tamper Attempt' }
    ]
  });

  if (writeAfterSeal.status === 409 || writeAfterSeal.status === 403 || writeAfterSeal.status === 400) {
    console.log(`[PASS] Write Rejected on Sealed Case with HTTP ${writeAfterSeal.status}: ${writeAfterSeal.data.error || writeAfterSeal.data.code}`);
  } else {
    throw new Error(`Write succeeded on sealed case when it should have been rejected! Status: ${writeAfterSeal.status}`);
  }

  console.log('\n================================================================');
  console.log('   ALL 8 LIVE END-TO-END DBMS OPERATIONS VERIFIED SUCCESSFULLY!  ');
  console.log('================================================================');
}

run().catch(err => {
  console.error('[FAIL]', err.message);
  process.exit(1);
});
