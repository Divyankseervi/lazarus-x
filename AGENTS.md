# AI AGENT DIRECTIVES (Codex & Antigravity)

When operating within the LAZARUS-X repository, you must adhere strictly to the following engineering standards:

1. **Inspect Before You Edit:** Do not blindly overwrite files based on assumptions. Always read the current state of the code and `PROJECT_CONTEXT.md` before making modifications.
2. **Preserve Architecture:** The project uses Prisma, Express, and Vite-React. Do not introduce new frameworks, ORMs, or fundamentally alter the stack unless explicitly commanded and justified.
3. **Protect Unrelated Work:** Never delete or overwrite files, tests, or directories that are unrelated to your immediate task.
4. **Security First:** Never expose secrets, hardcode passwords, or overwrite `.env` files with sensitive data in your outputs. Use placeholder names only.
5. **Verify and Test:** After any substantial code change, you must run the appropriate build commands (e.g., `npm run build`, `tsc`) and test suites (`npx ts-node src/engine/test.ts` or `audit_test.ts`). Do not claim success without execution logs.
6. **Continuous Handoff:** Whenever a major feature or bug fix is concluded, update `HANDOFF.md` to ensure the next agent (or human) understands the exact state of the project.
