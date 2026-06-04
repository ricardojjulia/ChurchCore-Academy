# Phase 6 Sprint 2 Student PWA Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first installable Student PWA route family with responsive navigation and safe placeholder surfaces.

**Architecture:** Keep Student PWA presentation separate from the academic-admin shell. Centralize route/navigation and manifest definitions in `src/modules/student-pwa`, render them through a reusable Student PWA shell, and keep all pages data-free until student-scoped read models are implemented in the next sprint.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, node:test, CSS, agent-browser.

---

## Factory Intake

- Product area: Student PWA shell, navigation, installability, and safe pre-read-model states.
- Institution modes: Bible school, children's school, seminary, college, university, and mixed institution.
- Data touched: no persistence or student records.
- LMS impact: show a provider-neutral unavailable state only; do not call or name provider runtime APIs.
- Security/privacy: placeholders contain no student records, launch secrets, tokens, draft grades, holds, or guardian-linked cross-student data.

## Files

- Create: `src/modules/student-pwa/shell-config.ts`
- Create: `src/modules/student-pwa/__tests__/shell-config.test.ts`
- Create: `src/components/student-pwa-shell.tsx`
- Create: `src/app/manifest.ts`
- Create: `src/app/student/layout.tsx`
- Create: `src/app/student/page.tsx`
- Create: `src/app/student/courses/page.tsx`
- Create: `src/app/student/schedule/page.tsx`
- Create: `src/app/student/progress/page.tsx`
- Create: `src/app/student/documents/page.tsx`
- Create: `src/app/student/messages/page.tsx`
- Create: `src/app/student/lms/page.tsx`
- Create: `public/academy-mark.svg`
- Modify: `src/app/globals.css`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Task 1: Define Testable Shell And Manifest Configuration

- [x] Write tests that require the seven Student PWA destinations, safe LMS wording, and installable manifest configuration.
- [x] Run `npm test -- src/modules/student-pwa/__tests__/shell-config.test.ts` and verify it fails because the module does not exist.
- [x] Add the minimal typed shell and manifest configuration.
- [x] Run `npm test -- src/modules/student-pwa/__tests__/shell-config.test.ts` and verify it passes.

## Task 2: Build Student Route Family

- [x] Add the reusable Student PWA shell with desktop and compact mobile navigation.
- [x] Add the `/student` dashboard placeholder with safe summaries and next-step states.
- [x] Add courses, schedule, progress, documents, messages, and LMS placeholder routes.
- [x] Add the manifest route and static Academy mark.
- [x] Add responsive, accessible Student PWA styles without offline caching or mutations.

## Task 3: Verify And Close The Sprint

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Start `npm run dev` and use agent-browser to verify `/student` and child routes at desktop and mobile viewport sizes.
- [x] Confirm the manifest is reachable and no framework error overlay is present.
- [x] Mark Phase 6 Sprint 2 and the master-plan route-group/manifest item complete.

## Review Boundary

This sprint is complete when the route family, responsive shell, manifest, safe placeholder states, automated configuration tests, and browser verification are reviewable. It must not add student-scoped read models, official grades, document storage, messaging delivery, LMS provider calls, service workers, background sync, or sensitive offline caching.
