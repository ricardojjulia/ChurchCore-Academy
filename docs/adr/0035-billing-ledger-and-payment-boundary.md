# ADR-0035 — Billing Ledger And Payment Boundary

**Date:** 2026-06-21  
**Status:** Accepted  
**Deciders:** Council Review VII follow-on implementation

## Context

ChurchCore Academy cannot be a competitive SIS without student accounts, billing, and payment workflows. Prior slices intentionally avoided billing side effects during admissions, enrollment conversion, registration, attendance, grade posting, and transcripts. That kept those domains clean, but left tuition-charging institutions without an operational finance record.

The payment boundary is high risk because raw card data, payment credentials, and provider secrets must never become Academy records.

## Decision

The Academy ledger is the financial source of truth. Payment processors are external processors, not ledgers.

The MVP billing slice introduces:

- student accounts;
- immutable billing ledger entries;
- idempotent charges, credits, manual payments, refunds, and void-compatible entry types;
- payment intents with redacted provider output;
- student account statement read models;
- admin billing UI and Student PWA account surface.

Ledger amount signs are explicit:

- charges increase balance;
- credits and payments decrease balance;
- refunds and voids are reserved for follow-on workflows and must preserve auditability.

Payment-intent records may store provider name, status, and provider reference. They must not store card data, client secrets, payment method secrets, authorization payloads, or raw provider responses.

## Consequences

- Student balances can be computed from append-only ledger entries.
- Staff can post manual charges, credits, and payments without payment-card handling.
- Students can view account statements and create safe MVP payment intents.
- Future Stripe integration must apply webhooks transactionally into the Academy ledger.
- Financial aid remains a separate domain but can post through the ledger contract.

## Rejected Alternatives

- **Processor as source of truth:** rejected because student accounts need institutional auditability independent of Stripe or another provider.
- **Mutable balance column only:** rejected because it loses accounting history and makes disputes hard to audit.
- **Store client secrets for convenience:** rejected because provider secrets do not belong in Academy persistence or API responses.
