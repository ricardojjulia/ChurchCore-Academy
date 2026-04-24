# ChurchCore Academy

This repository is the codebase for **ChurchCore Academy**, the SIS and College Management product within the broader ChurchCore platform.

## Boundary

- This repo is **not** a Moodle fork.
- This repo owns SIS, college management, enrollment, academic records, transcripts, faculty and administrator workflows, graduation tracking, compliance review, and institutional academic operations.
- The LMS will live in a **separate Moodle fork repository**.
- Integration between the two systems should happen through explicit contracts such as SSO, roster sync, enrollment sync, grade/progress exchange, and launch/logout flows.
- ChurchCore Academy is **not** the LMS.

## ShepherdAI Academy

This repository now includes the first foundation for **ShepherdAI for ChurchCore Academy**.

ShepherdAI Academy is:

- an explainable Academic Workflow recommendation engine
- deterministic first
- product-specific to ChurchCore Academy
- human-reviewed and audit-friendly

ShepherdAI Academy is not:

- a chatbot
- a conversational AI assistant
- a cross-product intelligence layer
- a source of final graduation or standing decisions without deterministic institutional rules

## Stack

- `Next.js` App Router
- `React`
- `TypeScript`
- `Tailwind CSS`
- `Supabase` for database, auth, and storage
- `Vercel` for deployment

## Current Academy scope

- incomplete enrollment follow-up
- missing student documentation review
- graduation eligibility review
- academic standing or credit progress review
- transcript or records inconsistency review
- faculty or course assignment imbalance review

## Local development

1. Copy `.env.example` to `.env.local`
2. Set:
   `NEXT_PUBLIC_SUPABASE_URL`
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   `SUPABASE_SERVICE_ROLE_KEY`
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

5. Open `http://localhost:3000`

The app will boot without Supabase credentials, but Supabase-backed features should only be added after the env vars are configured.

## Next steps

1. Create Supabase tables that mirror the current `ai_signals`, `ai_suggestions`, `workflows`, `workflow_actions`, and `workflow_feedback` contracts.
2. Add authenticated Academy roles and protected routes.
3. Replace mock Academy records with Supabase-backed repositories.
4. Add scheduled evaluation jobs and tenant-specific threshold configuration.
5. Create a separate fresh Moodle fork for ChurchCore Learning.

## Suggested layout

- `apps/` for deployable applications
- `packages/` for shared libraries
- `docs/` for architecture and integration notes

See [docs/architecture.md](/Users/rjulia/ChurchShield/ChurchShield/docs/architecture.md) and [docs/shepherd-ai-academy.md](/Users/rjulia/ChurchShield/ChurchShield/docs/shepherd-ai-academy.md).
