# Phase 6 Sprint 5 PWA Installability And Offline Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Student PWA installable and provide a safe offline fallback without caching student academic records.

**Architecture:** Register one service worker scoped to the `/student` route prefix, including the canonical `/student` dashboard and its child routes. Cache only a dedicated static-safe offline fallback and the Academy mark during installation. Student route navigations remain network-only and fall back to the cached offline page on network failure; successful student pages, API responses, Next.js data responses, academic records, and provider data are never written to Cache Storage.

**Tech Stack:** Next.js App Router, React client registration component, browser Service Worker API, Cache Storage API, node:test, headless Chrome DevTools Protocol verification.

---

## Factory Intake

- Product area: Student PWA installability and offline shell.
- Institution modes: all supported institution modes.
- Data touched: no student records, persistence, migrations, or APIs.
- LMS impact: no provider behavior or launch caching.
- Security/privacy: only `/student/offline` and `/academy-mark.svg` may be cached. No student route response, API response, RSC payload, grade, document, message, token, or provider value may be cached.

## Files

- Create: `src/modules/student-pwa/offline-policy.ts`
- Create: `src/modules/student-pwa/__tests__/offline-policy.test.ts`
- Create: `src/components/student-service-worker-registration.tsx`
- Create: `src/app/student/offline/page.tsx`
- Create: `public/student-sw.js`
- Modify: `src/app/student/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `next.config.ts`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Task 1: Offline Cache Policy

- [x] Write failing tests for the cache allowlist, sensitive-route exclusions, service-worker scope, and absence of runtime cache writes.
- [x] Run focused tests and verify they fail because the policy/runtime files do not exist.
- [x] Add the typed offline policy and shell-only service worker.
- [x] Run focused tests and verify they pass.

## Task 2: Registration And Offline Surface

- [x] Add the safe `/student/offline` page without student records or provider data.
- [x] Register the worker from the Student PWA layout only.
- [x] Add service-worker response headers and offline-page styling.
- [x] Confirm installability metadata and icon remain reachable.

## Task 3: Verify And Close Phase 6

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Verify service-worker registration and scope in the browser.
- [x] Verify online Student PWA routes render normally.
- [x] Verify offline navigation returns the safe offline page.
- [x] Verify Cache Storage contains only allowlisted shell resources.
- [x] Run `git diff --check`.
- [x] Mark Phase 6 Sprint 5 and Phase 6 offline/installability items complete.

## Review Boundary

This sprint is complete when the Student PWA is installable, safe offline fallback behavior is browser-verified, and Cache Storage contains only allowlisted shell resources. It must not cache student pages, API responses, RSC payloads, academic records, documents, messages, provider data, or offline mutations.
