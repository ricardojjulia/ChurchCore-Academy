# ADR-0036 — Regulated Aid Activation Boundary

**Date:** 2026-06-21  
**Status:** Accepted  
**Deciders:** Council Review VII follow-on implementation

## Context

ChurchCore Academy needs financial-aid workflows to be competitive as a SIS, but regulated aid is not the same risk class as institutional scholarships or church-sponsored discounts. Federal, Title IV, state grant, loan, satisfactory academic progress, refund-to-Title-IV, and compliance reporting workflows require policy validation, audit controls, and institution-specific approvals before runtime activation.

The billing slice introduced an immutable student-account ledger that financial aid can credit. This creates a safe path for institutional aid without pretending the system is ready to originate, certify, disburse, or reconcile regulated aid.

## Decision

The MVP financial-aid foundation supports institutional aid only.

The slice introduces:

- aid packages;
- institutional awards;
- award status changes;
- disbursement schedules;
- aid holds;
- student-visible aid summaries;
- transactional posting from accepted scheduled disbursement to the billing ledger.

Federal and regulated aid remain disabled. Runtime code may recognize federal aid inputs only to reject them with an explicit compliance-gate error. Database checks do not allow federal award/source values.

Regulated aid activation requires a future ADR and release gate covering at minimum:

- institution eligibility and program participation boundaries;
- role separation for aid, registrar, billing, and compliance functions;
- SAP policy configuration and appeal records;
- return-of-funds and refund calculations;
- required regulatory exports and audit reports;
- security and privacy review of aid documents and sensitive financial records.

## Consequences

- Schools can create and post institutional aid credits without federal-aid claims.
- Student account balances can reflect accepted institutional aid disbursements.
- Students can see released aid, disbursements, and active holds.
- Federal aid cannot be accidentally enabled by UI/API inputs or seed data.
- Follow-on regulated-aid work has a clear compliance gate instead of hidden partial behavior.

## Rejected Alternatives

- **Model federal aid as normal awards:** rejected because regulatory workflows are materially different and cannot be safely represented as generic credits.
- **Leave aid as notes only:** rejected because competitive SIS workflows require student-visible awards and ledger integration.
- **Post aid directly into balances:** rejected because balances must remain derivable from immutable ledger entries.
