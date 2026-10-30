import { expect, test } from '@playwright/test';

test('investigator creates a case, commits evidence, and verifies its disclosed claim in the browser', async ({ page }) => {
  let accessToken = '';
  let caseId = '';
  let evidenceSequence = 0;
  let submittedConfidence: number | undefined;
  page.on('request', request => {
    if (/\/api\/cases\/[^/]+\/evidence$/.test(request.url()) && request.method() === 'POST') {
      try { submittedConfidence = request.postDataJSON().evidence[0].confidence as number; } catch { /* assertions provide context */ }
    }
  });
  page.on('response', async response => {
    try {
      if (response.url().endsWith('/api/auth/login') && response.ok()) {
        accessToken = (await response.json()).token as string;
      }
      if (response.url().endsWith('/api/cases') && response.request().method() === 'POST' && response.ok()) {
        caseId = (await response.json()).id as string;
      }
      if (/\/api\/cases\/[^/]+\/evidence$/.test(response.url()) && response.ok()) {
        evidenceSequence = (await response.json()).provenance.sequence as number;
      }
    } catch {
      // The page assertions below provide the failure context if a response changes shape.
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Need an investigator account? Register' }).click();
  await page.getByLabel('Investigator email').fill('browser-investigator@example.test');
  await page.getByLabel('Password').fill('StrongPassphrase-2026!');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Case files' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Investigator account created and authenticated.');

  await page.getByRole('button', { name: 'New reconstruction' }).click();
  await page.getByRole('button', { name: 'Create reconstruction case' }).click();
  await expect(page.getByRole('heading', { name: 'Incident reconstruction 01' })).toBeVisible();
  await expect(page.getByText(/New reconstruction case initialized\./)).toBeVisible();

  await page.getByLabel('Relation').selectOption('Person');
  await page.getByLabel('Record locator').fill('7');
  await page.getByLabel('Attribute').selectOption({ label: 'name · TEXT · required' });
  await page.getByLabel('Observed value').fill('Ada Lovelace');
  await page.getByLabel(/Source confidence/).fill('0.75');
  await page.getByRole('button', { name: 'Commit fragment' }).click();
  await expect(page.getByRole('status')).toContainText('Evidence accepted · 1 fragment(s) · ledger sequence 1');
  await expect(page.getByText('name: Ada Lovelace')).toBeVisible();
  expect(accessToken).toMatch(/^[a-f0-9]{64}$/i);
  expect(caseId).toBeTruthy();
  expect(evidenceSequence).toBe(1);
  expect(submittedConfidence).toBe(0.75);

  await page.getByRole('button', { name: 'Provenance' }).click();
  await expect(page.getByText('1 events checked on server · page envelope checked in browser')).toBeVisible();
  await expect(page.getByText('#00001 · Evidence accepted')).toBeVisible();
  await page.locator('.ledger-entry').first().locator('summary').click();

  const [proofDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /inspect path & download verified proof/i }).click(),
  ]);
  expect(proofDownload.suggestedFilename()).toContain('proof-1.json');
  await expect(page.getByRole('region', { name: 'Merkle proof path for event 1' })).toContainText('LAZARUS-X:ENVELOPE-MERKLE:LEAF:V1');
  await expect(page.getByRole('region', { name: 'Merkle proof path for event 1' })).toContainText('Counted root · MATCH');
  await expect(page.locator('.claim-valid')).toContainText('verified locally and downloaded');

  const [bundleDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /offline bundle/i }).click(),
  ]);
  expect(bundleDownload.suggestedFilename()).toContain('audit-bundle.json');
  await expect(page.locator('.banner-success')).toContainText('Offline audit bundle exported');

  const apiBase = process.env.LAZARUS_E2E_API_URL;
  expect(apiBase).toBeTruthy();
  const claimResponse = await page.request.get(`${apiBase}/api/cases/${encodeURIComponent(caseId)}/provenance/claims/${evidenceSequence}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const claimResponseText = await claimResponse.text();
  expect(claimResponse.status(), claimResponseText).toBe(200);
  const claimPayload: unknown = JSON.parse(claimResponseText);

  await page.getByRole('button', { name: 'Verify disclosed claim' }).click();
  await page.getByLabel('Disclosure and envelope JSON').fill(JSON.stringify(claimPayload));
  await page.getByRole('button', { name: 'Verify claim' }).click();
  await expect(page.locator('.claim-verifier .claim-verification-result')).toContainText('VALID CLAIM');

  const tamperedPayload = JSON.parse(JSON.stringify(claimPayload)) as {
    disclosure: { payload: string };
    envelope: Record<string, unknown>;
  };
  tamperedPayload.disclosure.payload += ' ';
  await page.getByLabel('Disclosure and envelope JSON').fill(JSON.stringify(tamperedPayload));
  await page.getByRole('button', { name: 'Verify claim' }).click();
  await expect(page.locator('.claim-verifier .claim-verification-result')).toContainText('TAMPERED / MISMATCHED');
});

test('standalone reconstruction and results pages keep the active session and case working', async ({ page }) => {
  let activeCaseId = '';
  page.on('response', async response => {
    try {
      if (response.url().endsWith('/api/cases') && response.request().method() === 'POST' && response.ok()) {
        activeCaseId = (await response.json()).id as string;
      }
    } catch { /* asserted before the department check */ }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Need an investigator account? Register' }).click();
  await page.getByLabel('Investigator email').fill('standalone-pages@example.test');
  await page.getByLabel('Password').fill('StrongPassphrase-2026!');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Case files' })).toBeVisible();

  await page.getByRole('button', { name: 'New reconstruction' }).click();
  await page.getByRole('button', { name: 'Create reconstruction case' }).click();
  await expect(page.getByRole('heading', { name: 'Incident reconstruction 01' })).toBeVisible();
  await page.getByLabel('Relation').selectOption('Person');
  await page.getByLabel('Record locator').fill('1');
  await page.getByLabel('Attribute').selectOption({ label: 'name · TEXT · required' });
  await page.getByLabel('Observed value').fill('Asha Rao');
  await page.getByRole('button', { name: 'Commit fragment' }).click();
  await expect(page.getByText(/Evidence accepted · 1 fragment/)).toBeVisible();
  const caseId = activeCaseId;
  const token = await page.evaluate(() => sessionStorage.getItem('lazarus-x-token'));
  expect(caseId).toBeTruthy();
  expect(token).toBeTruthy();
  const apiBase = process.env.LAZARUS_E2E_API_URL!;
  const keyEvidence = await page.request.post(`${apiBase}/api/cases/${caseId}/evidence`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { evidence: [
      { table: 'Person', recordId: 1, field: 'id', value: 1, sourceRef: 'registry' },
      { table: 'Person', recordId: 1, field: 'name', value: 'A. Rao', sourceRef: 'second register' },
    ] },
  });
  expect(keyEvidence.ok()).toBeTruthy();
  const sourceLocation = await page.request.post(`${apiBase}/api/source-document-locations`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      departmentName: 'District Records Office', officeName: 'Central Archive Desk',
      documentName: 'Identity register · 2001', sourceReference: 'registry', referenceCode: 'DRO-REG-2001-08',
      storageLocation: 'Archive Room 1 · Rack C · Shelf 8', custodian: 'Records Desk',
      accessNotes: 'Submit the retrieval slip at the archive counter.', status: 'IN_STORAGE',
    },
  });
  expect(sourceLocation.status()).toBe(201);

  await page.getByRole('link', { name: /View what we had and what we found/i }).click();
  await expect(page).toHaveURL(/\/final-data-summary\?case=/);
  await expect(page.getByRole('heading', { level: 1, name: /what we had and what we found/i })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Asha Rao' }).first()).toBeVisible();
  const reportScroll = page.locator('.standalone-report-page');
  await expect(reportScroll).toHaveCSS('overflow-y', 'auto');
  await reportScroll.evaluate(element => element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }));
  expect(await reportScroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await reportScroll.evaluate(element => element.scrollTo({ top: 0, behavior: 'instant' }));
  await page.getByRole('link', { name: /find source document registry/i }).click();
  await expect(page).toHaveURL(/\/document-locator\?q=registry&case=/);
  await expect(page.getByRole('heading', { name: 'Document Locator' })).toBeVisible();
  await expect(page.getByText('District Records Office')).toBeVisible();
  await expect(page.getByText('Archive Room 1 · Rack C · Shelf 8')).toBeVisible();
  await page.getByRole('link', { name: /back to case/i }).click();
  await expect(page).toHaveURL(/\?case=/);
  await expect(page.getByRole('heading', { name: 'Incident reconstruction 01' })).toBeVisible();

  await page.getByRole('link', { name: /View what we had and what we found/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: /what we had and what we found/i })).toBeVisible();
  await page.getByRole('link', { name: /back to case workspace/i }).click();
  await expect(page).toHaveURL(/\?case=/);
  await expect(page.getByRole('heading', { name: 'Incident reconstruction 01' })).toBeVisible();
  await expect(page.getByText('standalone-pages@example.test')).toBeVisible();

  await page.getByRole('link', { name: /Open Reconstruction What-if Lab/i }).click();
  await expect(page).toHaveURL(/\/what-if-lab\?case=/);
  await expect(page.getByRole('heading', { name: 'Reconstruction What-if Lab' })).toBeVisible();
  await expect(page.getByRole('button', { name: /purchase-order amount check/i })).toBeEnabled();
  await expect(page.getByRole('heading', { name: /raw evidence tables/i })).toBeVisible();
  const labScroll = page.locator('.whatif-page');
  await expect(labScroll).toHaveCSS('overflow-y', 'auto');
  await labScroll.evaluate(element => element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }));
  expect(await labScroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await labScroll.evaluate(element => element.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(page.getByLabel('Dataset A source confidence')).toHaveValue('0.9');
  await page.getByRole('button', { name: /reconstruct and compare both tables/i }).click();
  await expect(page.getByRole('region', { name: /Before and after simulation results/i })).toBeVisible();
  const comparison = page.getByRole('region', { name: /Before and after simulation results/i });
  await expect(comparison.getByRole('cell', { name: 'Asha Rao' })).toBeVisible();
  await expect(comparison.getByRole('cell', { name: 'A. Rao' })).toBeVisible();
  await page.getByRole('link', { name: /check a source clash with another department/i }).click();
  await expect(page).toHaveURL(/\/department-verification\?case=/);
  await expect(page.getByRole('heading', { name: 'Interdepartmental Verification' })).toBeVisible();
  await expect(page.getByLabel('Disputed field')).toContainText('Person[1].name');
  await page.getByLabel('Department name').fill('District Identity Office');
  const csv = Buffer.from('record_no,verified_name\n1,Ada Lovelace');
  await page.getByLabel('Partner source file').setInputFiles({ name: 'identity.csv', mimeType: 'text/csv', buffer: csv });
  await expect(page.getByText(/1 row loaded locally/)).toBeVisible();
  await expect(page.getByLabel('Case record match key')).toHaveValue('id');
  await page.getByLabel('Partner key column').selectOption('record_no');
  await page.getByLabel('Partner column to check').selectOption('verified_name');
  const departmentCheckResponse = page.waitForResponse(response => response.url().includes('/department-verifications') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /check this department record/i }).click();
  const verificationResponse = await departmentCheckResponse;
  expect(verificationResponse.status()).toBe(200);
  await expect(page.getByRole('region', { name: 'Department verification result' })).toContainText('Ada Lovelace');
  await page.getByRole('button', { name: /preview reconstruction impact/i }).click();
  await expect(page.getByRole('region', { name: 'Department response reconstruction preview' })).toBeVisible();
  await page.getByRole('link', { name: /back to case workspace/i }).click();
  await expect(page.getByRole('heading', { name: 'Incident reconstruction 01' })).toBeVisible();
  await page.getByRole('link', { name: /open the record that forgot/i }).click();
  await expect(page).toHaveURL(/\/evidence-lifecycle\?case=/);
  await expect(page.getByRole('heading', { name: 'The Record That Forgot' })).toBeVisible();
  const expiryPreview = page.getByRole('button', { name: /simulate expiry and compare/i });
  await expect(expiryPreview).toBeEnabled();
  await expiryPreview.click();
  const lifecycleComparison = page.getByRole('region', { name: 'Evidence lifecycle before and after comparison' });
  await expect(lifecycleComparison).toBeVisible();
  await expect(lifecycleComparison).toContainText('NOTHING SAVED');
  await page.getByRole('button', { name: /simulate replacement/i }).click();
  await page.getByLabel('Corrected value').fill('Asha R.');
  await page.getByRole('button', { name: /simulate replacement and compare/i }).click();
  await expect(lifecycleComparison).toContainText('Asha R.');
});
