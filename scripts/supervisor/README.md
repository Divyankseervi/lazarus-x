# LAZARUS-X Development Supervisor

This PowerShell supervisor runs one explicit development task through a bounded Antigravity/Codex review loop. It is **dry-run by default**. It does not choose a speculative task for you.

## Requirements

- Windows PowerShell 5.1 or PowerShell 7.
- The Antigravity CLI command `agy` and Codex CLI command `codex` on `PATH` for a live run.
- Node.js dependencies already installed in `backend` and `frontend` for the fixed verification steps.

The dry-run is the default. It starts no agents, invokes no CLI help, and starts no project processes. It runs local synthetic permission-detector and Antigravity retry-classifier checks, along with isolated tests of the bounded retry loop, then writes a log.

The retry-loop self-test checks that a non-retryable result stops at attempt one, a qualifying first failure gets one retry and returns the second result, and a second qualifying failure stops at attempt two.

In live mode, the supervisor checks both CLIs and their required help syntax before starting any implementation agent. It stops if a CLI is missing, required syntax is unsupported, help fails, or a permission denial appears in output. It does not install or authenticate either CLI.

## Usage

Run from the repository root in PowerShell. An explicit task is required for every invocation:

```powershell
Set-Location C:\dev\lazarus-x

# Safe preview: starts no agents, runs no CLI help, and starts no project processes.
.\scripts\supervisor\supervisor.ps1 -Task "Add request validation to the evidence endpoint"

# Live run with no repair rounds.
.\scripts\supervisor\supervisor.ps1 -Task "Add request validation to the evidence endpoint" -Live -MaxRepairRounds 0

# Live run with two repair rounds (the allowed range is 0 through 3).
.\scripts\supervisor\supervisor.ps1 -Task "Fix the documented evidence validation defect" -Live -MaxRepairRounds 2
```

Without `-Live`, the script only writes a supervisor log under `scripts/supervisor/logs` (or `-LogDirectory` if supplied) and runs local synthetic detector, classifier, and retry-loop checks. It launches no agent, CLI help, Git, test, build, lint, or other project process and does not modify application files. `-Task` has no default; blank task text is rejected.

The final report gives each check one of four statuses: `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`. Checks skipped because a prior stage stopped are explicitly `NOT RUN` with the stop point in the detail.

## Live workflow

After `-Live` is supplied, the supervisor:

1. Checks `agy --help` and `codex exec --help` for the syntax it will use.
2. Captures the initial Git status with a read-only `git status` call so agents can preserve pre-existing work.
3. Runs Antigravity implementation in its CLI sandbox.
4. Runs a Codex review in `read-only` sandbox mode and requires a complete structured review.
5. Runs up to the requested number of Antigravity repair rounds. Codex re-reviews after each repair to identify what remains.
6. Runs a separate final Codex read-only review.
7. Only after a complete final review with no unresolved critical or high findings, runs the fixed checks below.

An Antigravity invocation may be retried once only when its process exits nonzero and every nonblank stdout record is valid JSON with a recognized event structure. The stream must contain exactly one outer `result` with `status: ERROR` and an error that identifies both an API request failure and a concrete network transport failure (for example, a socket read failure). Unknown records, malformed structures, tool events, permission denials, `denied_actions`, and timeouts are not retryable. The retry is per Antigravity invocation; a second qualifying failure stops the workflow.

All other failures stop without retry: permission or approval denials (including headless auto-denials for `read_url` and command requests), `denied_actions`, tool errors, nonzero tool exits, process timeouts, malformed stream output, generic API/application failures, and nonzero exits without the exact transport signature. A permission denial is reported as `STATUS: BLOCKED` with the agent, stage, detected denial, and safe next action; it is never treated as an ordinary application/test failure. The supervisor does not grant permissions, change Antigravity settings, or bypass permission prompts. Missing CLIs, unsupported flags, and failed CLI help are also `BLOCKED`. Incomplete output, malformed reviews, failed commands, and unresolved critical/high findings are `FAIL`. Unresolved medium/low findings are logged and do not block verification.

The agents are instructed not to access databases, run migrations, or perform Git history/worktree mutations. The supervisor itself only reads Git status. Antigravity runs with `--sandbox`, and Codex reviews use `--sandbox read-only`.

## Verification

After the final review gate, the supervisor checks that the package scripts still match the inspected commands and have no `pre`/`post` lifecycle scripts. It then runs these commands in order, stopping on the first failure:

- Backend TypeScript check: `node node_modules/typescript/bin/tsc --noEmit`
- Backend suite: `npm --ignore-scripts run test`
- Frontend production build: `npm --ignore-scripts run build`
- Frontend lint: `npm --ignore-scripts run lint`

The current backend suite uses in-memory data for its HTTP security tests and pure in-memory engine tests. No Prisma commands, database connections, migrations, or database setup commands are part of supervisor verification. If the package script contents change, verification stops for manual review instead of running altered commands.

## Logs and limits

Each run gets a timestamped log. Agent stdout/stderr, full CLI event streams, actual process exit codes, verification output, and stop reasons are recorded. Codex's JSON event stream is checked for command failures and permission denials; Antigravity's stream is checked for failed tool events, permission notices, and the narrow outer-transport retry condition. The dry-run runs synthetic positive and negative cases for the retry classifier. Final review responses are stored beside the log for auditability. The report lists every live stage and verification check, including checks marked `NOT RUN` after a blocker.

Agent and verification processes have bounded timeouts. Task text is limited to 16,000 characters. The repair count is limited to three rounds. The supervisor does not commit, push, reset, clean, stash, or revert changes.
