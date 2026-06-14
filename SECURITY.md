# Security Policy

## Supported Versions

ChurchCore Academy is in active pre-production development. Security fixes are applied to the latest `main` branch. No older release line is currently supported.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| `0.1.x` tags | Best effort |
| Older snapshots | No |

## Reporting a Vulnerability

Do not disclose suspected vulnerabilities in public issues, discussions, pull requests, or screenshots.

Use GitHub's private vulnerability reporting feature from the repository **Security** tab. If that feature is unavailable, contact the repository owner privately through GitHub before sharing technical details.

Include:

- affected route, module, migration, or workflow
- reproduction steps or proof of concept
- expected and observed authorization behavior
- tenant, role, and data-exposure impact
- suggested remediation, if known

Do not include real student, guardian, faculty, institution, authentication, or payment data.

## Response Expectations

Maintainers will:

1. acknowledge a complete report as soon as practical
2. validate severity and affected versions
3. coordinate remediation and verification privately
4. publish a security notice when disclosure is appropriate

This project does not currently promise a formal response SLA.

## Security Boundaries

High-risk areas include:

- Supabase session verification and account linking
- PostgreSQL RLS and request transaction context
- cross-tenant references and role assignments
- student, guardian, academic, transcript, and financial records
- LMS credentials, launches, sync, and reconciliation
- audit events and immutable evidence
- ShepherdAI and learner-intelligence inputs, consent, and outputs

Never commit secrets. Rotate any credential that may have entered git history, logs, screenshots, test fixtures, or external services.
