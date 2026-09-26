# ChurchCore Academy Agent Rules

This repository owns ChurchCore Academy, the faith-based SIS and education-management product in the ChurchCore platform. `CLAUDE.md` remains the detailed project reference; this file is the cross-agent operating contract for Codex, Claude Code, GitHub Copilot, and similar AI coding tools.

## Start Here

- Read `CLAUDE.md` and `docs/product/product-context.md` before planning or editing.
- For meaningful work, read `docs/software-factory.md`, `IMPROVE-SOFTWARE.md`, the relevant ADRs under `docs/adr/`, and any existing plan or review in `docs/reviews/`, `docs/superpowers/`, or `docs/prompts/`.
- Preserve the Academy/LMS boundary: Academy is the academic system of record; LMS runtime code belongs outside this repository and provider-specific work stays behind `src/modules/lms-contract/`.
- Do not replace existing product features, workflows, or governance artifacts when additive updates are enough.

## SDLC Mandate

- Use the Academy software factory for substantial work: intake, discovery, story, technical brief, implementation, verification, review, documentation, PR.
- Run the Council before every non-trivial merge to the default branch. Non-trivial means product behavior, schema, auth/privacy, LMS contract, ShepherdAI, UI workflow, migration, or accumulated multi-file work.
- Run the `pr-review` gate before every PR merge, including small fixes. It is separate from the Council.
- A feature is not done until the workflow works in the browser or through the relevant API/data path, docs are updated, and verification evidence is recorded.
- Every meaningful run must leave an auditable record: intent, affected product area, scope boundaries, Council/review status, commands run, results, residual risks, and follow-up work.

## Verification Gates

- Standard local gate: `npm run verify` (`npm test && npm run lint && npm run build`).
- Governance gate: `npm run verify:governance`.
- User-facing, auth, routing, new-surface, or release work also needs `npm run test:full` unless explicitly documented as infeasible.
- Database or migration work must include the relevant rehearsal and RLS/authz verification commands named in `package.json` or the affected runbook.
- Report exact pass/fail/unverified status. Do not treat a dry run, static inspection, or agent success as test evidence.

## Security And Data Rules

- Never commit credentials, copied environment files, private student records, payment data, provider secrets, raw database errors, or stack traces.
- Authorization and tenant isolation must be enforced in the module/data path, not only in UI visibility.
- New or changed module behavior needs success, validation/rejection, and cross-tenant tests sized to the risk.
- Student, guardian, grades, transcripts, billing, LMS sync, ShepherdAI, LLIS, and feedback/error telemetry are sensitive surfaces.

## Delivery Discipline

- Work on a feature or fix branch. Do not push directly to `main`.
- Keep changes scoped. Preserve unrelated dirty worktree changes.
- Update `README.md`, `CHANGELOG.md`, and relevant docs in the same change when product behavior, architecture, operations, or governance changes.
- Use the PR template completely and reference Council, Documenter, `pr-review`, verification, and deployment evidence when they apply.
