# Release Verification Record — LAZARUS-X

Date: 2026-10-22

This is a source release candidate, not a runtime-certified production release. Checks below identify precisely what was run in the packaging environment.

| Check | Result | Evidence / note |
|---|---|---|
| Artifact intake JavaScript syntax | PASS | `node --check` on intake, verifier, and smoke-test scripts |
| Artifact intake smoke tests | PASS | `node scripts/test_ingest_artifact.js` |
| SQLite structure analyzer tests | PASS | `python scripts/test_analyze_sqlite.py` on synthetic DB; confirms read-only behavior/no record-value export |
| Bash syntax | PASS | `bash -n` backup, restore, and start scripts |
| Package/lockfile JSON parse | PASS | root, backend, frontend manifests/lockfiles |
| Compose and CI YAML parse | PASS | `docker-compose.yml`, `.github/workflows/ci.yml` parsed locally |
| Docker CMD JSON parse | PASS | exec-form command parses as valid JSON |
| Package manifest/lockfile consistency | PASS | direct dependencies, devDependencies and engines match for backend and frontend |
| npm dependency installation | BLOCKED | Registry DNS returned `EAI_AGAIN` for `registry.npmjs.org` |
| Backend tests and TypeScript typecheck | BLOCKED | npm dependencies not available; global TypeScript lacks the project type definitions |
| Prisma validate/generate | NOT RUN | npm dependencies not available |
| Frontend lint, Vitest, production build | NOT RUN | npm dependencies not available |
| Playwright E2E | NOT RUN | npm/browser dependencies not available |
| SQLite CLI backup/restore drill | CONFIGURED IN CI, NOT RUN LOCALLY | SQLite CLI not present in the packaging environment; CI creates/restores a disposable database and verifies a known row |
| Docker image build/start smoke test | CONFIGURED IN CI, NOT RUN LOCALLY | Docker CLI not present in the packaging environment |
| Remote GitHub Actions / external deployment | NOT RUN | No external repository/deployment action was taken; CI workflow is configured but has not yet produced an observed run result |

The artifact smoke tests use a synthetic `.db`-extension file to test read-only hashing and manifest behavior; they intentionally do not claim to validate SQLite file contents. The manifest is not digitally signed and depends on protected storage for its own integrity.

Before external submission, run the commands in `docs/FINAL_ENGINEERING_STATUS.md`, inspect the actual GitHub Actions result, and capture real application output screenshots with timestamps as required by the assessment handout. Do not change an unverified row in this table to PASS without successful output.
