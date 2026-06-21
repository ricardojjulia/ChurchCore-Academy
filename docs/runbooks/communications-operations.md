# Communications Operations Runbook

Date: 2026-06-21
Applies to: Slice 7 Notifications And Communications

## Supported Workflow

1. Open `/admin/communications`.
2. Choose a workflow template and audience.
3. Create in-app and optional email queue messages.
4. Review queued, sent, failed, and read records.
5. Students read in-app messages at `/student/messages`.

## Controls

- Use approved templates only.
- Do not paste provider secrets, API keys, tokens, or raw provider payloads into message variables.
- Use in-app messages for required academic or financial notices.
- Respect email opt-out for non-essential email reminders.
- Treat communication records as student-record support evidence.

## Provider Boundary

This slice does not send live email. Email-channel rows are queue records for a future provider worker. The only provider field stored by the MVP is a safe provider reference after handoff; raw provider responses and credentials are prohibited.

## Verification Commands

```bash
node --import tsx --test src/modules/communications/__tests__/service.test.ts src/modules/communications/__tests__/migration.test.ts src/app/api/academy/communications/__tests__/route.test.ts
npx tsc --noEmit
npm run db:migrate:local
npm test
npm run lint
npm run build
```
