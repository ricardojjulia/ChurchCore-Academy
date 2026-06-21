# ADR-0037 — Notification Provider And Retention Boundary

**Date:** 2026-06-21  
**Status:** Accepted  
**Deciders:** Council Review VII follow-on implementation

## Context

ChurchCore Academy needs communications to complete SIS workflows: admissions decisions, registration confirmations, transcript status changes, billing notices, grade releases, attendance concerns, and workflow assignments. Those messages contain student-record and operational context, so they cannot be implemented as transient UI toasts or raw provider sends.

Email and future SMS providers are delivery channels, not the Academy communication record. Provider payloads may contain sensitive data and must not become the source of truth.

## Decision

ChurchCore Academy will own a communication queue and message record.

The MVP communications slice introduces:

- governed message templates;
- audience resolution for students, guardians, staff, and role groups;
- in-app notifications;
- email-provider handoff records;
- opt-out checks for non-essential email;
- retry counters and failure state;
- immutable communication audit events;
- student and admin message centers.

The Academy database stores message subject/body, recipient, channel, status, source workflow, retry metadata, and safe provider reference only. It must not store provider API keys, raw provider responses, rendered SMTP payloads, webhooks with secrets, or message-provider credentials.

Email delivery in this slice remains a provider boundary. The runtime can mark email messages queued and ready for a later worker/provider integration, but it does not claim live email delivery.

## Retention

Operational communication records are retained as student-record support evidence. Destructive deletion is not part of this MVP. Future retention automation requires a separate policy update that distinguishes official-record communications, transactional notices, and routine reminders.

## Consequences

- Workflows can create auditable notifications without coupling to an email vendor.
- Students can see in-app Academy messages from released workflow state.
- Staff can review queued, sent, failed, and read communication records.
- Email opt-out is respected for non-essential email while required academic/financial notices can still create in-app records.
- Future provider workers can consume the same queue without changing workflow code.

## Rejected Alternatives

- **Provider-first messaging:** rejected because provider logs are not Academy student-record evidence.
- **UI-only notifications:** rejected because workflow communications require audit, retry, and recipient visibility.
- **Store raw provider payloads:** rejected because provider responses may contain sensitive metadata or secrets.
