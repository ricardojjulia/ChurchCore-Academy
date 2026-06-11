# 2026-06-11 Demo Feedback And Error-Triage Run Notes

## Scope

Implemented a demo-only feedback and error-triage workflow for ChurchCore Academy with:

- feature-gated global client capture,
- server-side gating and validation,
- server-derived identity and fingerprinting,
- atomic distributed rate limiting,
- duplicate upsert handling,
- platform staff triage workspace and protected mutation endpoints.

## Deployment and migration order

1. Set environment variables:
   - `DEMO_MODE_ENABLED`
   - `NEXT_PUBLIC_DEMO_MODE_ENABLED`
   - `NEXT_PUBLIC_DEMO_VERSION`
   - existing Supabase and database env vars (`DATABASE_URL`, Supabase keys)
2. Apply migrations in normal lexical order so demo feedback migration runs after existing schema:
   - `supabase/migrations/20260611010000_demo_feedback.sql`
3. Deploy application code.
4. Verify platform staff access headers/claims are configured for triage routes.

## Operational notes

- Browser session IDs are generated client-side and reused per tab/session via session storage.
- Session IDs can rotate across browser sessions, private windows, or storage clearing.
- Per-session throttling is implemented at 20 submissions per 60 seconds through durable SQL state and advisory locking.
- This throttling reduces accidental floods but is not complete bot protection.
- Duplicate reports are deduplicated by normalized server fingerprint and increase `hit_count` while reopening triage state.
