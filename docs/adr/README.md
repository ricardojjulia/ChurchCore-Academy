# Architecture Decision Records

## Purpose

Architecture Decision Records capture durable decisions for ChurchCore Academy. ADRs prevent repeated debate, preserve rationale, and give Codex, GitHub Copilot, Claude Code, and reviewers a stable decision history.

## When An ADR Is Required

Create an ADR when a change affects:

- tenant isolation
- institution configuration structure
- academic calendar or subdivision hierarchy
- course, grading, transcript, promotion, or graduation rules
- student, guardian, teacher, professor, faculty, or administrator permissions
- student PWA routing, offline behavior, or exposed data
- LMS provider contract
- Moodle or Canvas adapter architecture
- ShepherdAI signal policy, explanation policy, or forbidden data sources
- persistence strategy, migrations, audit logs, or reconciliation

Do not create an ADR for small copy edits, narrow UI polish, test-only changes, or local refactors that do not change architecture.

## ADR File Naming

Use:

```text
docs/adr/NNNN-short-decision-title.md
```

Examples:

```text
docs/adr/0001-use-one-week-factory-sprints.md
docs/adr/0002-institution-type-model.md
docs/adr/0003-lms-provider-contract-boundary.md
```

## ADR Template

```markdown
# ADR NNNN: Title

Date: YYYY-MM-DD
Status: proposed | accepted | superseded | rejected

## Context

What problem forced this decision?

## Decision

What are we deciding?

## Consequences

What becomes easier, harder, safer, or riskier?

## Alternatives Considered

What other options were considered, and why were they rejected?

## Review Notes

- Product boundary:
- Security/privacy:
- Testing:
- Rollback:
```

## ADR Review Procedure

1. Draft ADR during sprint design.
2. Review against `docs/software-factory.md`.
3. Confirm Academy/LMS boundary.
4. Confirm student, guardian, grade, transcript, LMS, and ShepherdAI risks.
5. Mark status as `accepted` only after implementation approach is approved.
6. Supersede old ADRs instead of rewriting history.
