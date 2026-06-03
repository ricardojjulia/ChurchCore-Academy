# Reviewer Procedure

## Purpose

This procedure defines how ChurchCore Academy work is reviewed at sprint and pull-request boundaries.

Reviewers should evaluate whether the work is correct, bounded, testable, and aligned with the faith-based Academy product vision.

## Review Inputs

Every review should include:

- sprint or feature goal
- affected product area
- institution modes affected
- changed files
- tests and verification evidence
- ADRs created or changed
- known risks
- delivery decision requested: ship, revise, defer, split, or reject

## Standard Review Order

1. Product Boundary
   - Confirm Academy remains the SIS and system of record.
   - Confirm LMS runtime behavior is not implemented inside Academy domain logic.
   - Confirm ShepherdAI remains deterministic and non-chatbot.

2. Domain Fit
   - Confirm the change belongs in the named product area.
   - Confirm it supports Bible school, children's school, seminary, college, and university modes where relevant.
   - Confirm terminology is faith-based education management, not college-only.

3. Data And Privacy
   - Check student records, guardian relationships, grades, transcripts, LMS sync, and ShepherdAI signals.
   - Confirm tenant isolation is addressed.
   - Confirm role access is addressed.
   - Confirm audit logging exists where official records can change.

4. Architecture
   - Confirm new boundaries match existing docs.
   - Confirm ADRs exist for durable decisions.
   - Confirm provider-neutral contracts are used for LMS work.

5. Tests And Verification
   - Confirm tests cover deterministic domain behavior.
   - Confirm migrations and seeds were verified when schema changed.
   - Confirm UI/PWA changes were visually checked.
   - Confirm provider work has contract conformance tests.

6. Delivery
   - Confirm docs are updated.
   - Confirm the final summary states what was verified and what remains risky.
   - Choose ship, revise, defer, split, or reject.

## Required Commands

Most reviews require:

```bash
npm test
npm run lint
npm run build
```

Additional checks depend on scope:

- browser verification for UI or PWA work
- migration and seed verification for database work
- API checks for backend workflow changes
- provider contract tests for Moodle or Canvas work
- forbidden-source tests for ShepherdAI signal changes

## Review Decision Definitions

- ship: accept and move forward
- revise: request bounded changes inside the same sprint scope
- defer: pause because a dependency is missing
- split: break scope into smaller sprint artifacts
- reject: stop because the approach violates product, security, privacy, or architecture boundaries

## Pull Request Checklist

```markdown
## ChurchCore Academy Review

- [ ] Product area is identified.
- [ ] Institution modes affected are identified.
- [ ] Academy/LMS boundary is preserved.
- [ ] ShepherdAI remains deterministic and non-chatbot where relevant.
- [ ] Student, guardian, grade, transcript, LMS sync, and ShepherdAI data risks are addressed.
- [ ] Tenant isolation is addressed.
- [ ] Auth and role access are addressed.
- [ ] ADRs are included for durable decisions.
- [ ] Tests cover deterministic domain behavior.
- [ ] UI/PWA work has browser verification evidence.
- [ ] Provider work has contract conformance tests.
- [ ] `npm test` passed.
- [ ] `npm run lint` passed.
- [ ] `npm run build` passed.
- [ ] Docs were updated for product direction, architecture, or operations changes.
```
