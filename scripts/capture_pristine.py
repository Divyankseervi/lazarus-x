"""
Complete Pristine Playwright Screenshot Capture Script
Captures 100% clean full-viewport 1920x1080 screenshots directly from Chromium
Zero blue borders, zero window frames, zero halos.
"""

from playwright.sync_api import sync_playwright
import os
import time

dest_dir = 'submission/screenshots/pristine'
os.makedirs(dest_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    print("[1/7] Navigating to http://localhost:3000/ ...")
    page.goto('http://localhost:3000/')
    page.wait_for_timeout(2000)

    # 1. Login Interface
    p0 = os.path.join(dest_dir, '00_pristine_user_authentication_login.png')
    page.screenshot(path=p0)
    print(f"[SUCCESS] Saved: {p0}")

    # Authenticate
    print("[2/7] Logging in...")
    page.get_by_role('button', name='Authenticate').click()
    page.wait_for_timeout(2500)

    # Open the first case
    print("[3/7] Opening active case...")
    case_btn = page.locator('button.case-item').first
    if case_btn.count() > 0:
        case_btn.click()
    else:
        page.locator('button:has-text("ACTIVE")').first.click()
    page.wait_for_timeout(3000)

    # 2. Main Dashboard & Evidence Intake
    print("[4/7] Capturing Main Dashboard & Evidence Intake...")
    page.evaluate('window.scrollTo(0, 0)')
    page.wait_for_timeout(1000)
    p1 = os.path.join(dest_dir, '01_pristine_dashboard_and_evidence_intake.png')
    page.screenshot(path=p1)
    print(f"[SUCCESS] Saved: {p1}")

    # 3. Materialized Relational Tables
    print("[5/7] Capturing Materialized Relational Tables...")
    page.evaluate('window.scrollBy(0, 480)')
    page.wait_for_timeout(1200)
    p2 = os.path.join(dest_dir, '02_pristine_materialized_relational_tables.png')
    page.screenshot(path=p2)
    print(f"[SUCCESS] Saved: {p2}")

    # 4. Schema DAG & Foreign Key Topology
    print("[6/7] Capturing Schema DAG...")
    page.evaluate('window.scrollBy(0, 520)')
    page.wait_for_timeout(1200)
    p3 = os.path.join(dest_dir, '03_pristine_schema_dag_foreign_keys.png')
    page.screenshot(path=p3)
    print(f"[SUCCESS] Saved: {p3}")

    # 5. Cryptographic Provenance Ledger
    print("[7/7] Capturing Provenance Ledger...")
    page.evaluate('window.scrollBy(0, 520)')
    page.wait_for_timeout(1200)
    p4 = os.path.join(dest_dir, '04_pristine_cryptographic_provenance_ledger.png')
    page.screenshot(path=p4)
    print(f"[SUCCESS] Saved: {p4}")

    # 6. Dossier Modal
    print("[Bonus 1] Capturing Dossier Modal...")
    page.evaluate('window.scrollTo(0, 0)')
    page.wait_for_timeout(1000)
    dossier_btn = page.locator('.dossier-btn').first
    if dossier_btn.count() > 0:
        dossier_btn.click()
        page.wait_for_timeout(1500)
        p6 = os.path.join(dest_dir, '06_pristine_forensic_case_dossier_modal.png')
        page.screenshot(path=p6)
        print(f"[SUCCESS] Saved: {p6}")
        # Close modal
        close_btn = page.locator('button:has-text("Close"), .modal-close').first
        if close_btn.count() > 0:
            close_btn.click()
        else:
            page.keyboard.press('Escape')
        page.wait_for_timeout(1000)

    # 7. Audit Trail Modal
    print("[Bonus 2] Capturing Audit Trail Modal...")
    audit_btn = page.get_by_role('button', name='Audit Trail')
    if audit_btn.count() > 0:
        audit_btn.click()
        page.wait_for_timeout(1500)
        p5 = os.path.join(dest_dir, '05_pristine_admin_audit_trail_modal.png')
        page.screenshot(path=p5)
        print(f"[SUCCESS] Saved: {p5}")

    browser.close()
    print("[ALL DONE] All pristine screenshots captured successfully!")
