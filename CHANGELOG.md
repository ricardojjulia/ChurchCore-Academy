# Changelog

## 2026-06-11

- Added demo feedback submission pipeline with strict server validation, server-derived identity, server-derived fingerprinting, and atomic per-session rate limiting.
- Added global demo session provider with session UUID reuse, route breadcrumbs, and session duration tracking.
- Added global floating feedback modal and class-based React error boundary reporting for demo mode.
- Added protected platform staff triage workspace with filters, detail drawer, optimistic updates, and action/processed controls.
- Added Supabase migration for demo feedback tables, RLS policies, and atomic submit function with dedupe upsert behavior.
- Added focused tests for validation, fingerprinting, identity derivation, API authorization/error handling, migration behavior, and client payload/reporting behavior.
