# Authenticated Role Walkthrough Harness Design

Date: 2026-06-21  
Governing review: `docs/reviews/2026-06-21-council-review-9-release-closeout.md`  
Source of truth: `docs/acceptance/role-matrix-checklist.md`

## Problem

Council Review IX approved a controlled pilot but left per-tenant authenticated browser walkthroughs as a pilot-onboarding gate. The existing ADR-0038 role matrix defined roles and protected routes, but it did not provide repeatable browser-session evidence for all acceptance roles.

## Decision

Add an authenticated walkthrough harness that derives its role, route, required-surface, and forbidden-surface steps from `src/modules/acceptance/role-matrix.ts`.

The harness must:

- define credentials for admin, registrar, faculty, student, guardian, finance, admissions, and platform admin;
- seed local/pilot demo auth accounts for roles that did not previously have login credentials;
- generate markdown evidence with login commands and route commands;
- keep route lists centralized in the existing role matrix;
- verify finance as a first-class local-bootstrap role;
- avoid claiming live tenant completion until screenshots, console checks, and observed results are recorded for the target tenant.

## Boundaries

This slice does not automate real screenshots in CI. Browser evidence depends on a running app, seeded Supabase Auth users, and an operator-accessible browser session.

This slice does not activate live payment, communication, Moodle, Canvas, or regulated-aid providers.

## Acceptance Criteria

1. A package script generates authenticated role walkthrough evidence.
2. The generated evidence includes login bootstrap commands and every required/forbidden route in the ADR-0038 matrix.
3. Local seed migrations create role-specific Supabase users for acceptance walkthroughs.
4. Finance is accepted by local bootstrap parsing.
5. Docs and runbooks identify the walkthrough as the next controlled-pilot evidence gate.
