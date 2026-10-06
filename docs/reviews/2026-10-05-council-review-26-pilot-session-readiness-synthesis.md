# Council Review 26: Uncoached Pilot Session Readiness

Date: 2026-10-05
Branch: `feature/pilot-session-readiness`
Decision: **approve for protected PR delivery**

## Scope Reviewed

- Canonical status reconciliation after faculty-load PR `#217` and concealed HQ PR `#220`
- Local uncoached pilot-session protocol and evidence rules
- VM/local-network guidance
- Fail-closed pilot-readiness preflight for Academy, Supabase Auth, and Postgres
- Focused tests, documentation index, changelog, and factory record

## Council Findings

### Product And SIS

Approved. The protocol tests whether representative institutional users can complete real work without turning the session into a feature demonstration. Tasks cover the academic context, learner progress, reporting, faculty load, admissions, records, faculty work, and learner/guardian self-service. Observations—not speculative parity work—remain the source of follow-up stories.

### Architecture And Data

Approved. The preflight is isolated to the acceptance boundary and performs read-only health checks. It neither changes the schema nor seeds or mutates records. Endpoint parsing is centralized and accepts loopback or RFC1918 IPv4 hosts; public hosts fail closed. A first draft incorrectly rejected a legitimate mixed VM/host topology and was corrected before final verification.

### UX And Accessibility

Approved with a session caveat. Neutral prompts avoid naming navigation controls, and the observer records first paths, backtracking, and whether success is recognizable. This artifact prepares the session; it is not evidence that an external participant has completed it.

### Security And Privacy

Approved. Public endpoint URLs are rejected, credentials are never printed, repository evidence excludes identities and sensitive records, and S0 stop conditions cover tenant exposure and official-record integrity. The protocol correctly notes that a VM's `localhost` is the VM and requires browser-side reachability confirmation. Local Supabase may bind to the private network, so the operator must retain firewall and trusted-network controls.

### Competitive Council

Approved. The work advances the agreed controlled-pilot evidence gate without adding ungated features, Title IV claims, hosted resources, or provider activation.

### Testing Council

Approved. Four focused tests cover loopback, RFC1918 ranges, public/malformed rejection, sanitized output, and legitimate VM-to-host topology. `npm run verify` covers the complete unit, lint, and production-build gate. `npm run verify:pilot-readiness` passed against the local Auth, database, and login surface. `npm run test:full` is not required because no page, API, auth policy, role, route, schema, or browser behavior changed.

### Documenter

Approved. The development guide and current evaluation no longer claim the faculty-load closeout is pending. README, docs index, changelog, environment example, protocol, Council synthesis, and factory record describe the same local-only boundary.

## pr-review Gate

Final diff review found:

- Critical: 0
- Important: 0
- Minor: 0

The over-strict mixed-topology rule was identified and fixed before this final gate and is not an unresolved finding.

## Decision

Proceed through protected PR delivery. This decision does not claim that a pilot session has occurred and does not authorize deployment, public exposure, hosted Supabase/Vercel resources, live providers, or production records.

