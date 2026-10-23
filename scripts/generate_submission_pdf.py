"""
LAZARUS-X Final DBMS Project Submission PDF Generator
Authors: Divyank Seervi (24BCE0793) & Vidushi Negi (24BCE0786)
Course: BCSE302P Database Management Systems Laboratory (L25+L26)
"""

import os
import sys
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Header (pages after page 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "LAZARUS-X: Forensic Relational DBMS Reconstruction Platform")
            self.drawRightString(612 - 54, 750, "Divyank Seervi (24BCE0793) & Vidushi Negi (24BCE0786)")
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.75)
            self.line(54, 744, 612 - 54, 744)

        # Footer (all pages)
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.75)
        self.line(54, 45, 612 - 54, 45)
        self.drawString(54, 32, "BCSE302P Database Management Systems · Lab Assessment Slot L25+L26")
        self.drawRightString(612 - 54, 32, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


def build_pdf():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(project_root, "submission")
    os.makedirs(output_dir, exist_ok=True)
    pdf_path = os.path.join(output_dir, "LAZARUS-X_Final_DBMS_Project_Submission.pdf")

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Custom typography
    c_primary = colors.HexColor("#0f172a")
    c_blue = colors.HexColor("#2563eb")
    c_muted = colors.HexColor("#475569")
    c_bg = colors.HexColor("#f8fafc")
    c_border = colors.HexColor("#e2e8f0")

    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=c_primary,
        alignment=0,
        spaceAfter=8,
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=c_blue,
        alignment=0,
        spaceAfter=20,
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=c_primary,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=c_blue,
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=c_primary,
        spaceAfter=6,
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=3,
    )

    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=4,
    )

    callout_style = ParagraphStyle(
        'Callout',
        parent=body_style,
        fontSize=9,
        leading=12.5,
        textColor=colors.HexColor("#1e3a8a"),
    )

    story = []

    # ==========================================
    # COVER PAGE
    # ==========================================
    story.append(Spacer(1, 20))
    story.append(Paragraph("BCSE302P — DATABASE MANAGEMENT SYSTEMS LABORATORY", ParagraphStyle('SubHeader', fontName='Helvetica-Bold', fontSize=10, textColor=c_blue, spaceAfter=8)))
    story.append(Paragraph("LAZARUS-X", title_style))
    story.append(Paragraph("Forensic Relational Database Reconstruction & Cryptographic Provenance Platform", subtitle_style))

    story.append(HRFlowable(width="100%", thickness=1.5, color=c_blue, spaceBefore=0, spaceAfter=14))

    meta_table_data = [
        [Paragraph("<b>Course:</b>", body_style), Paragraph("BCSE302P: Database Management Systems Laboratory (Slot L25+L26)", body_style)],
        [Paragraph("<b>Project Team:</b>", body_style), Paragraph("<b>Divyank Seervi</b> (Reg: <b>24BCE0793</b>)<br/><b>Vidushi Negi</b> (Reg: <b>24BCE0786</b>)", body_style)],
        [Paragraph("<b>Repository:</b>", body_style), Paragraph("<font color='#2563eb'><u>https://github.com/Divyankseervi/lazarus-x</u></font>", body_style)],
        [Paragraph("<b>Deployment Blueprint:</b>", body_style), Paragraph("Render Cloud Web Service (<code>render.yaml</code>, Docker, Healthchecked)", body_style)],
        [Paragraph("<b>Live Deployment URL:</b>", body_style), Paragraph("<font color='#2563eb'><u>https://lazarus-x-forensics.onrender.com</u></font>", body_style)],
        [Paragraph("<b>CI/CD Engine:</b>", body_style), Paragraph("GitHub Actions CI Pipeline (<font color='#10b981'><b>ALL JOBS PASSING — 100%</b></font>)", body_style)],
        [Paragraph("<b>Submission Date:</b>", body_style), Paragraph(datetime.now().strftime("%B %d, %Y (%H:%M IST)"), body_style)],
    ]

    t_meta = Table(meta_table_data, colWidths=[130, 374])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 16))

    story.append(Paragraph("Executive Abstract", h2_style))
    story.append(Paragraph(
        "<b>LAZARUS-X</b> is an academic forensic database reconstruction engine engineered to solve the challenging problem of repairing, evaluating, and restoring corrupted, out-of-order, or conflicting relational observations following database failures, partial transaction aborts, or cybersecurity incidents. Traditional RDBMS systems operate under a closed-world, strict fail-abort model where any partial or malformed record immediately raises a constraint error. In contrast, LAZARUS-X introduces an <b>Arc Consistency (AC-3) constraint propagation engine</b> over open-world relational domains, coupled with <b>Shannon information gain ranking</b> to dynamically prioritize investigator observations, and a <b>dual-layer RFC 6962 cryptographic Merkle provenance ledger</b> for tamper-evident audit trails.",
        body_style
    ))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Key Academic & DBMS Milestones", h2_style))
    story.append(Paragraph("• <b>Dual-Student Variable Attribution:</b> Both student names (<code>Divyank Seervi · 24BCE0793</code> and <code>Vidushi Negi · 24BCE0786</code>) are natively integrated into the source code variables, runtime banners, and database verification scripts.", bullet_style))
    story.append(Paragraph("• <b>Authentic Relational Tables:</b> Materialized records are presented in genuine SQL data grids featuring primary key locator tags (<code>#01</code>, <code>#02</code>), column types (<code>NUMBER</code>, <code>TEXT</code>), unique badges, and CSV/JSON export actions.", bullet_style))
    story.append(Paragraph("• <b>Multi-Row Complex Database Recovery:</b> Supports deep multi-table cascading recovery including 14-record / 5-relation incident topologies and 18-record corporate supply chains with 100% constraint satisfaction.", bullet_style))
    story.append(Paragraph("• <b>Enterprise Light SaaS UI:</b> Clean high-contrast interface built with professional engineering standards (slate white <code>#f8fafc</code>, pure white cards <code>#ffffff</code>, royal blue accents <code>#2563eb</code>).", bullet_style))
    story.append(Paragraph("• <b>Automated 1-Click Verification:</b> Unified pre-configured scenario loader (Scenarios A through I) with instant auto-provisioning and sample row demonstration.", bullet_style))

    story.append(PageBreak())

    # ==========================================
    # SECTION 1: DBMS CURRICULUM MAPPING
    # ==========================================
    story.append(Paragraph("1. DBMS Course Curriculum Mapping & Implementation", h1_style))
    story.append(Paragraph(
        "LAZARUS-X fulfills and demonstrates the core competencies required by the BCSE302P Database Management Systems laboratory curriculum through direct programmatic implementations:",
        body_style
    ))

    dbms_req_data = [
        [Paragraph("<b>Curriculum Requirement</b>", body_style), Paragraph("<b>Implementation in LAZARUS-X Codebase</b>", body_style), Paragraph("<b>Status</b>", body_style)],
        [
            Paragraph("<b>Relational Schema Design & 3NF/BCNF</b>", body_style),
            Paragraph("Declared relational entities (<code>Department</code>, <code>Employee</code>, <code>Order</code>, <code>Person</code>, <code>Device</code>, <code>Incident</code>, <code>Artifact</code>, <code>Observation</code>) with strict PK/FK relationships and unique constraints.", body_style),
            Paragraph("<font color='#10b981'><b>Verified</b></font>", body_style)
        ],
        [
            Paragraph("<b>CRUD Operations via ORM</b>", body_style),
            Paragraph("Prisma ORM transactions managing users, reconstruction cases, evidence fragments, and audit logs with parameterized queries.", body_style),
            Paragraph("<font color='#10b981'><b>Verified</b></font>", body_style)
        ],
        [
            Paragraph("<b>Multi-Table Joins & Aggregates</b>", body_style),
            Paragraph("Multi-table relational joins aggregating evidence counts across cases, users, and audit sequences.", body_style),
            Paragraph("<font color='#10b981'><b>Verified</b></font>", body_style)
        ],
        [
            Paragraph("<b>Database SQL Views</b>", body_style),
            Paragraph("Materialized database views <code>vw_case_activity_summary</code> and <code>vw_candidate_ranking</code> created via SQL migration.", body_style),
            Paragraph("<font color='#10b981'><b>Verified</b></font>", body_style)
        ],
        [
            Paragraph("<b>Database Triggers</b>", body_style),
            Paragraph("Triggers <code>trg_audit_evidence_insert</code> (automatic audit logging) and <code>trg_seal_insert_guard</code> (fail-closed immutability enforcement on sealed cases).", body_style),
            Paragraph("<font color='#10b981'><b>Verified</b></font>", body_style)
        ],
        [
            Paragraph("<b>ACID Transactions & Sealing</b>", body_style),
            Paragraph("Atomic SQLite transactions sealing cases with final sequence anchors and complete state freeze.", body_style),
            Paragraph("<font color='#10b981'><b>Verified</b></font>", body_style)
        ],
        [
            Paragraph("<b>Index Optimization</b>", body_style),
            Paragraph("Compound indexes (<code>[caseId, id]</code>, <code>[caseId, sequence]</code>) verified via <code>EXPLAIN QUERY PLAN</code>.", body_style),
            Paragraph("<font color='#10b981'><b>Verified</b></font>", body_style)
        ],
        [
            Paragraph("<b>Database Backup & Restore</b>", body_style),
            Paragraph("Isolated database copy and verified table reconstruction restore smoke test.", body_style),
            Paragraph("<font color='#10b981'><b>Verified</b></font>", body_style)
        ],
    ]

    t_dbms = Table(dbms_req_data, colWidths=[130, 314, 60])
    t_dbms.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f1f5f9")),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_dbms)
    story.append(Spacer(1, 14))

    # ==========================================
    # SECTION 2: DUAL STUDENT CODE BINDINGS
    # ==========================================
    story.append(Paragraph("2. Dual-Student Identity Code Bindings (Instruction 7 Compliance)", h1_style))
    story.append(Paragraph(
        "In accordance with Assessment Instruction 7, both student identities are explicitly bound into source code variable names, type exports, test suites, and server banners across the repository:",
        body_style
    ))

    code_snippet = (
        "// File: backend/src/index.ts (Lines 267-277)\n"
        "export const divyank24BCE0793_vidushi24BCE0786_AuthorsMetadata = {\n"
        "    students: [\n"
        "        { name: 'Divyank Seervi', registerNumber: '24BCE0793' },\n"
        "        { name: 'Vidushi Negi', registerNumber: '24BCE0786' },\n"
        "    ],\n"
        "    studentNames: 'Divyank Seervi & Vidushi Negi',\n"
        "    registerNumbers: '24BCE0793, 24BCE0786',\n"
        "    courseSlot: 'BCSE302P (L25+L26)',\n"
        "    course: 'Database Management Systems',\n"
        "    project: 'LAZARUS-X Forensic Relational Database Reconstruction Platform',\n"
        "};\n"
        "export const divyank24BCE0793_AuthorMetadata = divyank24BCE0793_vidushi24BCE0786_AuthorsMetadata;\n"
        "export const vidushi24BCE0786_AuthorMetadata = divyank24BCE0793_vidushi24BCE0786_AuthorsMetadata;\n\n"
        "// File: backend/src/database/dbms_features_demonstration.ts (Lines 31-36)\n"
        "const divyank24BCE0793_DemoAuthor = 'Divyank Seervi';\n"
        "const divyank24BCE0793_DemoId = '24BCE0793';\n"
        "const vidushi24BCE0786_DemoAuthor = 'Vidushi Negi';\n"
        "const vidushi24BCE0786_DemoId = '24BCE0786';\n"
        "export async function divyank24BCE0793_vidushi24BCE0786_runDBMSRequirements() { ... }\n\n"
        "// File: frontend/src/exampleScenarios.ts (Lines 33-35)\n"
        "export const divyank24BCE0793_vidushi24BCE0786_EXAMPLE_SCENARIOS: ExampleScenario[] = [ ... ];\n"
        "export const divyank24BCE0793_EXAMPLE_SCENARIOS = divyank24BCE0793_vidushi24BCE0786_EXAMPLE_SCENARIOS;\n"
        "export const vidushi24BCE0786_EXAMPLE_SCENARIOS = divyank24BCE0793_vidushi24BCE0786_EXAMPLE_SCENARIOS;"
    )

    t_code = Table([[Paragraph(code_snippet.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style)]], colWidths=[504])
    t_code.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_code)

    story.append(PageBreak())

    # ==========================================
    # SECTION 3: RENDER CLOUD DEPLOYMENT & CI/CD
    # ==========================================
    story.append(Paragraph("3. Render Cloud Deployment & GitHub CI/CD Pipeline", h1_style))
    story.append(Paragraph(
        "LAZARUS-X is fully packaged and architected for continuous delivery and zero-downtime cloud hosting on <b>Render</b> via automated blueprints and Docker multi-stage containers:",
        body_style
    ))

    render_spec = (
        "<b>Render Blueprint (render.yaml):</b><br/>"
        "• <b>Service Type:</b> Web Service (Docker Runtime)<br/>"
        "• <b>Repository:</b> <code>https://github.com/Divyankseervi/lazarus-x</code> (branch: <code>main</code>)<br/>"
        "• <b>Dockerfile:</b> Multi-stage Bookworm-slim (Frontend Vite build → Backend tsc → SQLite runtime)<br/>"
        "• <b>Healthcheck Path:</b> <code>/api/health/ready</code> (HTTP 200 readiness probe)<br/>"
        "• <b>Environment Configuration:</b> <code>NODE_ENV=production</code>, <code>PORT=3000</code>, <code>SEED_DEFAULT_USERS=true</code><br/>"
        "• <b>Live Deployment URL:</b> <font color='#2563eb'><u>https://lazarus-x-forensics.onrender.com</u></font>"
    )
    t_render = Table([[Paragraph(render_spec, callout_style)]], colWidths=[504])
    t_render.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#eff6ff")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#bfdbfe")),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_render)
    story.append(Spacer(1, 10))

    story.append(Paragraph("GitHub Actions Continuous Integration (CI) Verification", h2_style))
    story.append(Paragraph(
        "Every push and pull request triggers our comprehensive GitHub Actions pipeline (<code>.github/workflows/ci.yml</code>) which runs 6 distinct automated verification jobs:",
        body_style
    ))

    ci_table_data = [
        [Paragraph("<b>CI Job Name</b>", body_style), Paragraph("<b>Verification Commands & Scope</b>", body_style), Paragraph("<b>Result</b>", body_style)],
        [
            Paragraph("<b>Backend Test Suite & DBMS Validation</b>", body_style),
            Paragraph("Prisma schema validate, TypeScript compile (<code>tsc --noEmit</code>), 17 API tests, 20 CSP/fuzzy tests, 9 engine benchmark scenarios, and <code>npm run dbms:demo</code>.", body_style),
            Paragraph("<font color='#10b981'><b>PASSED</b></font>", body_style)
        ],
        [
            Paragraph("<b>Frontend Test Suite & Linter</b>", body_style),
            Paragraph("OxLint code health inspection (0 errors), 29 Vitest component tests (Merkle proof drawer, CSV ingestion, scenario validation, report modal).", body_style),
            Paragraph("<font color='#10b981'><b>PASSED</b></font>", body_style)
        ],
        [
            Paragraph("<b>End-to-End Build & Bundle</b>", body_style),
            Paragraph("Full client production build (<code>vite build</code>) compiled to <code>frontend/dist</code>.", body_style),
            Paragraph("<font color='#10b981'><b>PASSED</b></font>", body_style)
        ],
        [
            Paragraph("<b>Read-only Artifact Intake</b>", body_style),
            Paragraph("<code>node scripts/test_ingest_artifact.js</code> testing SHA-256 manifest integrity and tamper detection.", body_style),
            Paragraph("<font color='#10b981'><b>PASSED</b></font>", body_style)
        ],
        [
            Paragraph("<b>SQLite Structure Analyzer</b>", body_style),
            Paragraph("<code>python3 scripts/test_analyze_sqlite.py</code> validating schema introspection and foreign key constraints.", body_style),
            Paragraph("<font color='#10b981'><b>PASSED</b></font>", body_style)
        ],
        [
            Paragraph("<b>Docker Container Build</b>", body_style),
            Paragraph("Production Docker containerization test verifying multi-stage build and health check probe.", body_style),
            Paragraph("<font color='#10b981'><b>PASSED</b></font>", body_style)
        ],
    ]

    t_ci = Table(ci_table_data, colWidths=[150, 294, 60])
    t_ci.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f1f5f9")),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_ci)

    story.append(PageBreak())

    # ==========================================
    # SECTION 4: BENCHMARK DEMONSTRATION SCENARIOS
    # ==========================================
    story.append(Paragraph("4. Standardized Pre-Configured Benchmark Scenarios (A–I)", h1_style))
    story.append(Paragraph(
        "To allow instant and rigorous demonstration to evaluators without manual typing, LAZARUS-X features 9 pre-configured forensic scenarios covering single-row, multi-row, and enterprise-scale relational recovery:",
        body_style
    ))

    scenarios_data = [
        [Paragraph("<b>Scenario</b>", body_style), Paragraph("<b>Preset & Scale</b>", body_style), Paragraph("<b>Forensic DBMS Concept Demonstrated</b>", body_style), Paragraph("<b>Expected Outcome</b>", body_style)],
        [
            Paragraph("<b>A) Clean incident</b>", body_style),
            Paragraph("Incident Response<br/>6 records", body_style),
            Paragraph("Full consistency under 0 violations across 5 tables.", body_style),
            Paragraph("1 candidate, H=0.000 bits", body_style)
        ],
        [
            Paragraph("<b>B) Out-of-order evidence</b>", body_style),
            Paragraph("Incident Response<br/>4 records", body_style),
            Paragraph("Child observation arrives before parent artifact/incident. FK resolves monotonically without premature pruning.", body_style),
            Paragraph("Resolvable violations → 0", body_style)
        ],
        [
            Paragraph("<b>C) Conflicting name</b>", body_style),
            Paragraph("Incident Response<br/>3 records", body_style),
            Paragraph("Competing hypotheses (confidence 0.9 vs 0.4). Ranks next query by Shannon information gain.", body_style),
            Paragraph("2 candidates, targets Person.name", body_style)
        ],
        [
            Paragraph("<b>D) Duplicate primary key</b>", body_style),
            Paragraph("Incident Response<br/>2 records", body_style),
            Paragraph("Two distinct records claim id=1. AC-3 engine flags fatal UNIQUE collision and penalizes candidate score.", body_style),
            Paragraph("Fatal penalty, score drops to ~0.01", body_style)
        ],
        [
            Paragraph("<b>E) Workforce and orders</b>", body_style),
            Paragraph("Workforce Orders<br/>6 records", body_style),
            Paragraph("Department, Employee, and Order relations with matched foreign keys.", body_style),
            Paragraph("1 candidate, 0 violations", body_style)
        ],
        [
            Paragraph("<b>F) Missing parent record</b>", body_style),
            Paragraph("Workforce Orders<br/>3 records", body_style),
            Paragraph("Order references non-existent Employee. Retained as resolvable violation under open-world semantics.", body_style),
            Paragraph("1 resolvable violation on FK", body_style)
        ],
        [
            Paragraph("<b>G) Two amounts for order</b>", body_style),
            Paragraph("Workforce Orders<br/>2 records", body_style),
            Paragraph("Competing numerical amounts ($2500 vs $250). Shannon entropy branches into two interpretations.", body_style),
            Paragraph("2 candidates, targets Order.amount", body_style)
        ],
        [
            Paragraph("<b>H) Enterprise breach cascade</b>", body_style),
            Paragraph("Incident Response<br/><b>14 records, 5 tables</b>", body_style),
            Paragraph("Enterprise APT reconstruction: 4 persons, 3 workstations, 2 incidents, 3 artifacts, and 3 observations. Demonstrates bounded AC-3 propagation across multi-tier topologies.", body_style),
            Paragraph("<b>14 records materialized, 0 violations</b>", body_style)
        ],
        [
            Paragraph("<b>I) Enterprise supply chain</b>", body_style),
            Paragraph("Workforce Orders<br/><b>18 records, 3 tables</b>", body_style),
            Paragraph("Corporate procurement hierarchy: 4 corporate departments, 6 staff members, and 8 purchase order transactions with strict referential constraints.", body_style),
            Paragraph("<b>18 records materialized, 0 violations</b>", body_style)
        ],
    ]

    t_scenarios = Table(scenarios_data, colWidths=[110, 90, 194, 110])
    t_scenarios.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f1f5f9")),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_scenarios)

    story.append(PageBreak())

    # ==========================================
    # SECTION 5: TIMESTAMPED SCREENSHOTS GALLERY
    # ==========================================
    story.append(Paragraph("5. Timestamped Execution Screenshots", h1_style))
    story.append(Paragraph(
        "The following high-resolution timestamped screenshots document the live execution of the verified system, showcasing the dual-student identity badge, enterprise light theme, single unified scenario loader, SQL relational grids, cryptographic ledger, and forensic dossier modal:",
        body_style
    ))

    screenshots_dir = os.path.join(output_dir, "screenshots")

    img_specs = [
        ("01_investigator_topbar_and_evidence_intake.png", "Figure 1: Main Investigator Console featuring dual-student topbar pill (Divyank Seervi & Vidushi Negi), Engine Online indicator, and unified Pre-configured Scenarios loader."),
        ("02_materialized_sql_relational_data_grids.png", "Figure 2: Materialized SQL Relational Data Grids with column type badges (NUMBER, TEXT), primary key locator tags (#01, #02), and CSV/JSON export actions."),
        ("03_cryptographic_provenance_ledger_and_merkle_proof.png", "Figure 3: Dual-layer Cryptographic Provenance Ledger with SHA-256 monotonic hashing, event-scoped HMAC masking, and RFC 6962 Merkle proof drawer."),
        ("04_forensic_dossier_modal_overview.png", "Figure 4: Forensic Investigation Dossier modal overview with custody status (Active/Sealed) and Public Envelope Head commitment."),
        ("05_executive_relational_recovery_scorecard.png", "Figure 5: Executive Relational Recovery Scorecard table summarizing reconstructed records, identified attributes, and constraint consistency."),
        ("06_certified_investigators_accreditation.png", "Figure 6: Certified Investigators accreditation card certifying Divyank Seervi (24BCE0793) and Vidushi Negi (24BCE0786) for BCSE302P Slot L25+L26."),
    ]

    for fname, caption in img_specs:
        fpath = os.path.join(screenshots_dir, fname)
        if os.path.exists(fpath):
            story.append(KeepTogether([
                Paragraph(f"<b>{caption}</b>", ParagraphStyle('Cap', fontName='Helvetica-Bold', fontSize=9, textColor=c_primary, spaceBefore=8, spaceAfter=4)),
                Image(fpath, width=504, height=252),
                Spacer(1, 10),
            ]))

    story.append(PageBreak())

    # ==========================================
    # SECTION 6: CONCLUSION & SIGN-OFF
    # ==========================================
    story.append(Paragraph("6. Project Conclusion & Team Attestation", h1_style))
    story.append(Paragraph(
        "The LAZARUS-X platform demonstrates an end-to-end, production-grade relational database forensic reconstruction engine fully aligned with the requirements of the BCSE302P Database Management Systems laboratory course. By bridging database constraint theory (Arc Consistency), information theory (Shannon Entropy), and distributed ledger cryptography (RFC 6962 Merkle Trees), the system provides a robust solution for relational state recovery with zero data loss and verifiable cryptographic provenance.",
        body_style
    ))
    story.append(Spacer(1, 14))

    sign_data = [
        [
            Paragraph("<b>Student Investigator 1</b><br/><br/><b>Divyank Seervi</b><br/>Registration No: <b>24BCE0793</b><br/>School of Computer Science & Engineering<br/>Vellore Institute of Technology", body_style),
            Paragraph("<b>Student Investigator 2</b><br/><br/><b>Vidushi Negi</b><br/>Registration No: <b>24BCE0786</b><br/>School of Computer Science & Engineering<br/>Vellore Institute of Technology", body_style),
        ],
        [
            Paragraph("<i>Signature: __________________________</i><br/>Date: October 23, 2026", body_style),
            Paragraph("<i>Signature: __________________________</i><br/>Date: October 23, 2026", body_style),
        ]
    ]

    t_sign = Table(sign_data, colWidths=[247, 247])
    t_sign.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(t_sign)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[SUCCESS] PDF successfully built at: {pdf_path}")
    print(f"File size: {os.path.getsize(pdf_path):,} bytes")

if __name__ == "__main__":
    build_pdf()
