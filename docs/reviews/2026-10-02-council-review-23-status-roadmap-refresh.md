# Council Review 23 - MVP And Competitive Status Refresh

Date: 2026-10-02
Branch: `fix/status-roadmap-refresh`
Issue: `#214`
Decision requested: accept / revise / defer / reject

## Executive Verdict

Decision: **accept**

The prior status snapshot is materially stale after PRs `#196`-`#206`. The
repository-owned MVP is complete and the approved first-customer P1 slices have
shipped, but faculty-load correctness and primary-path E2E issue `#216` remains a
required closeout. Further speculative feature work would bypass the guide's
evidence-first rule.

## Council Findings

### Product And SIS

After issue `#216`, the first-customer wedge is credible for non-Title-IV faith-based institutions,
subject to controlled-pilot boundaries. The next product question is no longer
which planned feature to build; it is where an uncoached institution user fails,
hesitates, or requests missing capability.

### Architecture And Data

No architecture or data-model change is proposed. Academy remains the academic
system of record, and LMS behavior remains behind provider-neutral contracts.
No ADR is needed for a status-only reconciliation.

### Security And Privacy

The refresh preserves deployment, provider activation, regulated-aid, and
official-record restrictions. A pilot must use approved non-production data and
must not introduce real student records without a separate data-handling decision.

### UX And Accessibility

Repository surface coverage cannot prove workflow clarity. The next evidence
should come from an uncoached authenticated session, with dead ends, unclear
language, navigation misses, and accessibility friction recorded as observations.

### Competitive Council

Custom reports, bulk email, donor campaigns, advising, faculty load, trusted
public routing, and OneRoster deletion reconciliation have moved from gaps to
shipped initial slices. Faculty-load incomplete-value accuracy and primary-path
E2E remain tracked in issue `#216`. Multilingual expansion remains
customer-language gated. Title IV parity remains compliance-gated and is not an
implied roadmap item.

### Testing Council

This change alters documentation only. No new page, API, role, schema, or runtime
behavior is introduced, so no new E2E journey is required. Governance validation,
documentation link checks covered by the build, and diff review are sufficient;
the current hosted CI/E2E evidence is cited rather than rerun as product proof.

## Decision

Accept the refreshed status, close issue `#216`, and then make pilot observation
the next evidence gate.
Do not deploy, activate providers, begin multilingual work, or begin regulated-aid
work without the approvals already required by the canonical guide.
