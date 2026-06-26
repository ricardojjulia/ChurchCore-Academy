# ChurchCore Academy Documentation

This directory contains the durable product, architecture, delivery, operations, and governance knowledge for ChurchCore Academy.

## Start Here

- [Repository README](../README.md)
- [HOWTO](../HOWTO.md)
- [CHANGELOG](../CHANGELOG.md)
- [Versioning](../VERSIONING.md)
- [Project Status](project-status.md)
- [Technology Overview](technology.md)
- [Architecture Boundary](architecture.md)
- [Product Master Plan](product/faith-based-academy-master-plan.md)
- [Factory Roadmap](product/factory-roadmap.md)
- [Software Factory](software-factory.md)

## Architecture and Decisions

- [Architecture Overview](architecture.md)
- [Product Boundary](architecture/churchcore-academy-boundary.md)
- [Architecture Decision Records](adr/README.md)
- [Gradebook System](gradebook/README.md)
- [LMS Provider Strategy](lms-dual-provider-strategy.md)
- [ShepherdAI Academy](shepherd-ai-academy.md)

## Operations

- [Authentication and Tenant Access](runbooks/academy-auth-and-tenant-access.md)
- [Admissions Operations](runbooks/admissions-operations.md)
- [Course Registration Operations](runbooks/course-registration-operations.md)
- [Attendance and Grade Posting Operations](runbooks/attendance-grade-posting-operations.md)
- [Transcript Operations](runbooks/transcript-operations.md)
- [Billing Operations](runbooks/billing-operations.md)
- [Financial Aid Operations](runbooks/financial-aid-operations.md)
- [Reporting and Exports](runbooks/reporting-exports.md)
- [Communications Operations](runbooks/communications-operations.md)
- [LMS Execution Workers](runbooks/lms-execution-workers.md)
- [Authenticated Role Walkthrough Evidence](acceptance/authenticated-role-walkthrough-evidence.md)
- [Deployment Operations](runbooks/deployment-operations.md)
- [Incident Response](runbooks/incident-response.md)
- [Observability](runbooks/observability.md)
- [Backup and Restore](runbooks/backup-restore.md)
- [Migration Seed Rehearsal](runbooks/migration-seed-rehearsal.md)
- [Provider Activation](runbooks/provider-activation.md)
- [Moodle Configuration](integrations/moodle-provider-configuration.md)
- [Canvas Configuration](integrations/canvas-provider-configuration.md)
- [LLIS Retention and Deletion](policies/llis-data-retention-and-deletion.md)

## Delivery Artifacts

- `docs/releases/`: release notes and readiness packages
- `docs/superpowers/specs/`: approved designs
- `docs/superpowers/plans/`: implementation plans
- `docs/reviews/`: Council and delivery reviews
- `docs/agents/`: reusable factory roles and procedures

## Document Authority

When documents conflict, use this precedence:

1. accepted ADRs and security policies
2. current approved design specification
3. current implementation plan
4. product roadmap and master plan
5. historical plans and reviews

Update durable documentation in the same pull request when behavior, architecture, operations, or product status changes.
