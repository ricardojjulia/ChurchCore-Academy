# Changelog

All notable changes to ChurchCore Academy are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic versioning for development milestones.

## [Unreleased]

### Added

- Professional repository documentation and community health files.
- AGPL-3.0 open-source license and explicit package metadata.
- Technology, project-status, contribution, security, support, and conduct documentation.
- GitHub issue forms and pull request template.
- GitHub Actions quality gate and Dependabot configuration.
- Safe `.env.example` for local configuration.

### Changed

- Reworked the README to distinguish implemented foundations, working vertical slices, and planned capabilities.

## [0.1.0] - 2026-06-14

### Added

- Multi-tenant institution configuration, academic calendar, course catalog, people, guardian, faculty, grading, and transcript-rule foundations.
- Verified Supabase session identity, persisted Academy account links and roles, request-scoped PostgreSQL context, forced RLS, and immutable audit events.
- Tenant-isolated admissions application, submission, review, decision, and accepted-application enrollment conversion workflows.
- Student PWA shell, installability, safe offline fallback, and provider-neutral LMS launch orchestration.
- Provider-neutral LMS contract with no-LMS, Moodle, and Canvas adapter foundations.
- Deterministic ShepherdAI Academy workflow recommendations and review lifecycle.
- Governed Living Learner Intelligence System foundation with learner-owned consent, immutable consent evidence, and live RLS verification.
- Demo feedback capture and protected platform triage workflow.
- Repository-owned software factory, design specifications, implementation plans, ADRs, runbooks, and review procedures.

### Security

- Removed production trust in caller-supplied Academy identity headers.
- Added tenant-aware composite foreign keys and database role-matrix verification.
- Added append-only audit and learner-intelligence evidence storage.

[Unreleased]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/9c41beb...HEAD
[0.1.0]: https://github.com/ricardojjulia/ChurchCore-Academy/tree/9c41beb
