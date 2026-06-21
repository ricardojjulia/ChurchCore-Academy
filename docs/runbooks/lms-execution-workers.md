# LMS Execution Workers Runbook

Date: 2026-06-21

## Purpose

This runbook governs Moodle and Canvas execution workers for course shell provisioning, roster sync, reviewed grade return, reviewed progress return, and reconciliation.

## Operating Rules

- Academy remains the SIS and official-record authority.
- Provider workers execute normalized operations only.
- Provider workers must use tenant/provider/capability/idempotency keys.
- Provider secrets, tokens, raw provider payloads, stack traces, and raw provider errors must not be returned to users.
- Grade and progress returns are reviewed imports until Academy staff accepts or rejects them.

## Retry Handling

1. `success`: record provider reference if available and do not retry.
2. `retryable_failure`: retry through the scheduler or operator action after the provider-safe delay.
3. `permanent_failure`: stop retries and open an operations task.
4. `conflict`: stop automatic retry and reconcile mapping/roster state.

## Duplicate Replay

If an operation key already exists for the tenant, provider, capability, and idempotency key, suppress provider execution and report success with `Duplicate operation replay suppressed.`

## Failure Recovery

- Run reconciliation for the tenant and provider.
- Compare missing mappings, stale mappings, duplicate provider objects, roster drift, grade-return drift, and progress-return drift.
- Repair Academy mapping state first; do not treat provider records as official Academy records.
- Re-run the worker only with the original idempotency key for replay or a new key for a new operator-approved attempt.

## Release Evidence

Required before enabling live provider HTTP clients:

- worker tests for success, duplicate replay, retryable failure, permanent failure, and conflict
- provider contract tests for Moodle and Canvas route planning
- reconciliation test evidence
- no provider secrets in returned payloads or audit metadata
- role-gated admin operation path
- operational owner and escalation path
