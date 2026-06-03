# ChurchCore Academy LMS Provider Strategy (Moodle First, Canvas Compatible)

## Decision Summary

It is feasible to ship ChurchCore Academy with multiple LMS options, where each institution can choose Moodle, Canvas, or no LMS.

This should be implemented as:

- one ChurchCore Academy core application
- one LMS integration contract
- a Moodle provider adapter first
- a Canvas provider adapter second
- a no-LMS mode for institutions that only need Academy SIS and student PWA workflows

This preserves Academy's SIS boundary and keeps LMS runtime concerns outside Academy business logic.

## Boundary Rules

ChurchCore Academy remains the faith-based SIS and education-management system.

ChurchCore Academy must not contain LMS runtime implementation details such as:

- Moodle core/runtime code
- Moodle plugins/themes
- Canvas runtime internals
- LMS-specific business logic inside Academy domain workflows

Integration must be performed through explicit contracts only.

## Integration Contract (Provider-Neutral)

The contract should standardize at least:

- identity handoff (SSO launch and logout)
- tenant/campus context handoff
- roster and enrollment sync
- course/section mapping
- grade/progress return path
- webhook/event callback handling
- audit logging and reconciliation
- error semantics, retries, and idempotency
- provider capabilities, including supported grading sync, course shell creation, sections, roles, and launch methods

## Provider Recommendation

Moodle should be the first supported LMS provider because it is open source under the GPL license, self-hostable, customizable, widely extended through plugins, and operationally realistic for smaller faith-based schools and Bible institutes.

Canvas should be supported as a second provider because it is open source under AGPLv3 and has a strong REST API, but it is generally a better fit for institutions that already run Canvas or have the operational capacity for a more enterprise-oriented LMS.

The product should not force an LMS decision at the platform level. Provider choice should be tenant configuration.

## Deployment Model

### Local Development / Validation (Docker)

For local environments, it is practical to run with Docker and support both LMS targets for testing:

- Academy services + shared dependencies
- Moodle stack profile
- Canvas stack profile

Recommended pattern:

- use Docker Compose profiles (or compose overlays)
- run one provider profile at a time for normal development
- optionally run both for side-by-side contract validation

### Production (Cloud)

In production, ChurchCore Academy is cloud-hosted, and Moodle and Canvas are also cloud-hosted.

Recommended production approach:

- deploy Academy to cloud as the system of record for SIS workflows
- connect to cloud-hosted Moodle and/or cloud-hosted Canvas through provider adapters
- activate one LMS provider per tenant by configuration (default)
- optionally support tenant-level provider switching with controlled migration tooling

Production should avoid coupling to local container assumptions. Docker is primarily a local/dev parity tool in this model.

## Risks and Mitigations

1. Provider model mismatch
- Risk: Moodle and Canvas differ in courses, grading, role semantics, and event models.
- Mitigation: define a minimum common capability contract and provider capability matrix.

2. Authentication and launch differences
- Risk: SSO/LTI/OIDC flows can fail differently per provider.
- Mitigation: isolate auth flows per adapter and enforce contract-level integration tests.

3. Sync reliability
- Risk: duplicate updates, ordering issues, and transient failures.
- Mitigation: idempotent sync operations, retry policies, and reconciliation jobs.

4. Parity drift
- Risk: one provider adapter may lag over time.
- Mitigation: contract conformance tests and release gates requiring both adapters to pass required capabilities.

5. Operational complexity
- Risk: supporting two LMS integrations increases QA and support workload.
- Mitigation: narrow contract, clear ownership boundaries, and observability per provider.

## Implementation Path

1. Define and approve provider-neutral LMS contract.
2. Implement no-LMS mode so Academy remains useful without course-delivery runtime.
3. Implement Moodle adapter against the contract.
4. Add contract conformance test suite used in CI.
5. Implement Canvas adapter to required parity where provider capabilities match.
6. Add deployment configuration for tenant-level provider selection.
7. Add migration/reconciliation tooling for provider transitions.

## Source Notes

- Moodle describes Moodle LMS as open source and customizable: https://moodle.com/about/open-source/
- Moodle downloads state Moodle LMS is open source under the GPL license: https://download.moodle.org/
- Moodle External Services document the web service framework for external systems: https://moodledev.io/docs/5.3/apis/subsystems/external
- Canvas LMS is published by Instructure under AGPLv3: https://github.com/instructure/canvas-lms
- Canvas documents a REST API for external access and modification: https://canvas.instructure.com/doc/api/

## Practical Recommendation

Proceed with a contract-first provider architecture:

- local Docker for development and integration testing
- cloud-to-cloud integration in production
- provider selected by configuration, not by branching Academy business logic

This gives institutions real choice while preserving ChurchCore Academy product boundaries and long-term maintainability.
