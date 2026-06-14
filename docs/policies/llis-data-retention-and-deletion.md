# LLIS Data Retention, Export, and Deletion Policy

- Status: Approved for governed foundation
- Effective date: 2026-06-14
- Owners: Product Council, Privacy, Security, Academic Operations
- Applies to: Living Learner Intelligence System data

## Principles

1. Consent revocation stops new protected processing immediately. It does not
   erase evidence needed to prove what processing was authorized and when.
2. LLIS data is retained only while it has a documented academic-support,
   security, audit, or legal purpose.
3. No LLIS record is an official transcript, grade, enrollment, billing, or
   disciplinary record.
4. Legal holds suspend scheduled deletion for the records named by the hold.
5. Tenant deletion never permits cross-tenant access or bulk export.

## Retention Schedule

| Data class | Default retention | End-of-period action |
| --- | --- | --- |
| Consent records and immutable consent evidence | 7 years after learner separation or final revocation, whichever is later | Delete after hold and audit review |
| Raw learner activity events | 13 months from occurrence | Delete |
| Learner memory entries | 24 months from last validation or until consent revocation review, whichever is earlier | Delete or replace with a newly reviewed entry |
| Identity snapshots | 24 months from snapshot date | Delete |
| Energy check-ins | 90 days from occurrence | Delete |
| Intervention recommendations and status history | 3 years after intervention closure | Delete |
| Operational access and export logs | 7 years from event | Delete after hold review |

Pastoral or confidential memory may have a shorter tenant policy. It may not
have a longer policy without written Council and privacy approval.

## Revocation

Revocation is effective when the consent row is updated. From that point:

- new protected activity, memory, snapshot, social-graph, learner-mirror, and
  predictive writes are blocked by service rules and RLS
- existing consent and evidence records remain immutable
- existing derived LLIS records enter deletion review
- records required for an active intervention may be retained until the
  intervention is safely closed, with a documented reason
- revocation never changes official academic records

Re-consent creates a new evidence event. It does not silently restore deleted
LLIS data.

## Learner Export

A verified learner may request an export of:

- current and historical consent
- consent evidence
- learner-visible activity and memory records
- learner-visible snapshots and intervention outcomes, once Council approves
  those learner surfaces

Exports must be tenant-scoped, generated from the verified session, encrypted
in transit, time-limited, and recorded in the access log. Staff-only notes,
pastoral/confidential memory, security metadata, and information identifying
other people require privacy review before release.

## Deletion Workflow

1. Verify the requester and tenant.
2. Inventory LLIS records by data class.
3. Check academic-record dependencies, open interventions, investigations, and
   legal holds.
4. Delete eligible derived and raw records in dependency order.
5. Preserve consent evidence until its retention period expires.
6. Record the scope, operator, reason, counts, exceptions, and completion time
   in an immutable deletion receipt.
7. Notify the learner of completion and any lawful retention exception.

Bulk or privileged deletion must use an approved operational procedure. Normal
application roles cannot update or delete append-only LLIS evidence.

## Legal Holds

Only authorized privacy, legal, or institutional administrators may create or
release a legal hold. A hold must identify:

- tenant and learner scope
- data classes
- legal or investigative basis
- approving person
- start date and review date

Held records remain subject to least-privilege access, audit logging, and tenant
isolation. When the hold is released, the normal retention schedule resumes.

## Operational Requirements

- A scheduled retention job and deletion-receipt ledger are required before
  LLIS production rollout.
- Export and deletion APIs require a separate implementation review.
- Retention configuration changes require Council, privacy, and security
  approval.
- Production operators must test restoration and deletion behavior at least
  annually.
