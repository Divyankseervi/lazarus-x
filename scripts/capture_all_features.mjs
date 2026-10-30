import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');
const destDir = path.join(rootDir, 'submission', 'screenshots', 'pristine');

fs.mkdirSync(destDir, { recursive: true });

let provKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
try {
  const envContent = fs.readFileSync(path.join(backendDir, '.env'), 'utf-8');
  const m = envContent.match(/PROVENANCE_ENCRYPTION_KEY=([a-fA-F0-9]{64})/);
  if (m) provKey = m[1];
} catch (e) {}

console.log('[1/4] Starting backend server on port 3000...');
const serverProcess = spawn(process.execPath, [
  path.join(backendDir, 'node_modules', 'ts-node', 'dist', 'bin.js'),
  '--files',
  path.join(backendDir, 'src', 'index.ts')
], {
  cwd: backendDir,
  env: {
    ...process.env,
    PORT: '3000',
    NODE_ENV: 'production',
    PROVENANCE_ENCRYPTION_KEY: provKey,
    CORS_ORIGINS: 'http://localhost:3000',
    PRISMA_CLIENT_GENERATED: 'true'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

serverProcess.stdout.on('data', d => {
  const s = d.toString();
  if (s.includes('listening on port') || s.includes('READY')) console.log('[API]', s.trim());
});
serverProcess.stderr.on('data', d => {
  const s = d.toString();
  if (!s.includes('ExperimentalWarning')) console.error('[API ERR]', s.trim());
});

async function waitForReady(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

const ready = await waitForReady('http://127.0.0.1:3000/api/health/ready', 25000);
if (!ready) {
  console.error('[ERROR] Server failed to become ready!');
  serverProcess.kill();
  process.exit(1);
}
console.log('[2/4] Backend server is live and serving UI at http://127.0.0.1:3000');

console.log('[3/4] Launching Google Chrome...');
const { chromium } = require(path.join(frontendDir, 'node_modules', '@playwright', 'test'));
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars']
});

const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1
});
const page = await context.newPage();

console.log('[4/4] Capturing pristine screenshots of all features...');

try {
  // Feature 0: Login Interface
  console.log('-> Capturing 00_pristine_user_authentication_login.png');
  await page.goto('http://127.0.0.1:3000/');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(destDir, '00_pristine_user_authentication_login.png') });

  // Authenticate or Register
  console.log('-> Authenticating investigator account...');
  const regToggle = page.locator('button:has-text("Need an investigator account? Register")');
  if (await regToggle.count() > 0) {
    await regToggle.click();
    await page.waitForTimeout(600);
    const emailInput = page.locator('#authEmail');
    const passInput = page.locator('#authPassword');
    if (await emailInput.count() > 0) {
      await emailInput.fill(`investigator-${Date.now()}@vitstudent.ac.in`);
      await passInput.fill('StrongPassphrase2026!');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);
    }
  } else {
    const authBtn = page.locator('button[type="submit"]').first();
    if (await authBtn.count() > 0) {
      await authBtn.click();
      await page.waitForTimeout(2500);
    }
  }

  // Check if case is loaded; if not, open or auto-load
  console.log('-> Ensuring case data is loaded...');
  const autoLoadBtn = page.locator('button:has-text("Damaged birth"), button:has-text("Clean incident"), button:has-text("Enterprise")').first();
  const caseItem = page.locator('button.case-item, button:has-text("ACTIVE"), button:has-text("SEALED")').first();
  
  if (await autoLoadBtn.count() > 0) {
    console.log('-> Loading auto-scenario...');
    await autoLoadBtn.click();
    await page.waitForTimeout(3500);
  } else if (await caseItem.count() > 0) {
    console.log('-> Opening existing case...');
    await caseItem.click();
    await page.waitForTimeout(3000);
  } else {
    // Try clicking "New case" -> create default case
    const newCaseBtn = page.locator('button:has-text("New case"), button.square-button').first();
    if (await newCaseBtn.count() > 0) {
      await newCaseBtn.click();
      await page.waitForTimeout(1000);
      const createBtn = page.locator('button:has-text("Create case"), button:has-text("Create reconstruction")').first();
      if (await createBtn.count() > 0) {
        await createBtn.click();
        await page.waitForTimeout(2500);
      }
    }
  }

  // Feature 1: Main Dashboard & Evidence Intake
  console.log('-> Capturing 01_pristine_dashboard_and_evidence_intake.png');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(destDir, '01_pristine_dashboard_and_evidence_intake.png') });

  // Feature 2: Materialized Relational Tables
  console.log('-> Capturing 02_pristine_materialized_relational_tables.png');
  await page.evaluate(() => window.scrollBy(0, 480));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(destDir, '02_pristine_materialized_relational_tables.png') });

  // Feature 3: Schema DAG & Foreign Key Topology
  console.log('-> Capturing 03_pristine_schema_dag_foreign_keys.png');
  await page.evaluate(() => window.scrollBy(0, 520));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(destDir, '03_pristine_schema_dag_foreign_keys.png') });

  // Feature 4: Cryptographic Provenance Ledger
  console.log('-> Capturing 04_pristine_cryptographic_provenance_ledger.png');
  await page.evaluate(() => window.scrollBy(0, 520));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(destDir, '04_pristine_cryptographic_provenance_ledger.png') });

  // Feature 5: Candidate Diff Matrix
  console.log('-> Capturing 05_pristine_candidate_diff_matrix.png');
  await page.evaluate(() => window.scrollTo(0, 650));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(destDir, '05_pristine_candidate_diff_matrix.png') });

  // Feature 6: Audit Trail Modal
  console.log('-> Capturing 06_pristine_admin_audit_trail_modal.png');
  await page.evaluate(() => window.scrollTo(0, 0));
  const auditBtn = page.getByRole('button', { name: 'Audit Trail' });
  if (await auditBtn.count() > 0) {
    await auditBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(destDir, '06_pristine_admin_audit_trail_modal.png') });
  }

  // Feature 7: Case Dossier Modal
  console.log('-> Capturing 07_pristine_forensic_case_dossier_modal.png');
  await page.reload();
  await page.waitForTimeout(2000);
  const dossierBtn = page.locator('.dossier-btn, button:has-text("Dossier"), button:has-text("Report")').first();
  if (await dossierBtn.count() > 0) {
    await dossierBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(destDir, '07_pristine_forensic_case_dossier_modal.png') });
  }

  // Feature 8: Schema Studio Modal
  console.log('-> Capturing 08_pristine_schema_studio_modal.png');
  await page.reload();
  await page.waitForTimeout(2000);
  const schemaStudioBtn = page.locator('button[aria-label="New reconstruction case"], button:has-text("New case"), button.square-button').first();
  if (await schemaStudioBtn.count() > 0) {
    await schemaStudioBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(destDir, '08_pristine_schema_studio_modal.png') });
  }

  // Feature 9: Department Verification Page
  console.log('-> Capturing 09_pristine_department_verification_page.png');
  await page.goto('http://127.0.0.1:3000/department-verification');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(destDir, '09_pristine_department_verification_page.png') });

  // Feature 10: Document Locator Page
  console.log('-> Capturing 10_pristine_document_locator_page.png');
  await page.goto('http://127.0.0.1:3000/document-locator');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(destDir, '10_pristine_document_locator_page.png') });

  // Feature 11: Evidence Expiry Lab Page
  console.log('-> Capturing 11_pristine_evidence_expiry_lab_page.png');
  await page.goto('http://127.0.0.1:3000/evidence-lifecycle');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(destDir, '11_pristine_evidence_expiry_lab_page.png') });

  console.log('[SUCCESS] All pristine feature screenshots captured successfully!');
} catch (err) {
  console.error('[ERROR during capture]', err);
} finally {
  await browser.close();
  serverProcess.kill('SIGTERM');
  setTimeout(() => process.exit(0), 1000);
}
