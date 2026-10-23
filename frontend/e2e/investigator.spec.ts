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
