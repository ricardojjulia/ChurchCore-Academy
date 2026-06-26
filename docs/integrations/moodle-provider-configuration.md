# Moodle Provider Configuration

## Purpose

This guide documents the ChurchCore Academy Moodle provider boundary for tenant onboarding, support, and release review.

ChurchCore Academy remains the SIS and official-record authority. Moodle remains the external learning runtime. Moodle data enters Academy only through the provider-neutral LMS contract and reviewed-import workflows.

## Required Tenant Setup

Before activating Moodle for a tenant:

- Confirm the tenant selected Moodle as the active LMS provider.
- Confirm the Moodle base URL uses HTTPS in production.
- Store non-secret activation settings in `lms_provider_configs` with provider `moodle`, launch mode, enabled operation families, Moodle context identifiers, and validation evidence.
- Store only secret references in `lms_provider_secret_refs`; the actual Moodle token or launch secret must remain in the encrypted provider secret layer.
- Configure identity launch separately from server-to-server sync credentials.
- Enable Moodle Web Services only if the tenant uses course, roster, grade, progress, or reconciliation sync.
- Enable only the Moodle protocol required by the selected adapter path.
- Create a custom External Service with only the functions required by enabled sync families.
- Assign least-privilege Moodle capabilities to the service user.
- Create service credentials through the tenant-scoped secret layer, not Academy domain records.
- Run `assertProviderCanActivate` successfully before setting the tenant provider to active. Activation requires passed validation evidence and the required Moodle secret reference, including `moodleWebServiceToken` for server-to-server Web Services.
- Run reconciliation after launch, course shell, roster, grade, or progress configuration changes.

## Secret Handling

Store the following only in the tenant-scoped secret layer:

- Moodle Web Service tokens
- OIDC client secrets
- LTI keys or shared secrets
- webhook secrets
- refresh tokens
- private signing keys

`lms_provider_configs` may store only non-secret values such as base URL, launch mode, enabled operations, account/context identifiers, provider status, and validation evidence. Any token, credential, password, private key, signature, authorization header, or raw provider payload belongs outside that table.

Never expose Moodle tokens, raw provider payloads, provider error bodies, internal Moodle user ids, or raw Moodle course ids through:

- Student PWA responses
- Academy course catalog records
- Academy people or guardian records
- grading records
- transcript or official-record records
- ShepherdAI inputs
- audit metadata
- reconciliation summaries

## Sync Families

### Identity Launch

Launch returns a provider-neutral `LmsLaunchResponse`. The browser receives only a display-safe launch URL, expiration, display label, and audit reference.

### Course Shell Sync

Course shell sync produces idempotent provider-operation plans from Academy course and section ids. Moodle course ids remain provider mapping/runtime details and do not become Academy course catalog ids.

### Roster Sync

Roster sync maps Academy instructor and student memberships to Moodle-compatible roles. Guardian relationships do not create Moodle roster access unless a future explicit business rule allows it.

### Grade And Progress Return

Moodle grade and progress values enter Academy as reviewed imports. Returned values remain `pending_review` until Academy review workflows accept them for official use or release.

### Reconciliation

Reconciliation compares Academy-expected mappings, roster memberships, grade return ids, progress return ids, and capability requirements with the observed Moodle snapshot. Reports recommend Academy-owned actions; they do not silently rewrite official records.

## Deployment Notes

- Use HTTPS for production Moodle base URLs.
- Confirm Moodle version and enabled functions before tenant activation.
- Keep local Docker Moodle profiles separate from production cloud-to-cloud configuration.
- Document firewall, IP restriction, token expiration, and credential rotation settings per tenant.
- Rotate service credentials during tenant provider migration or staff turnover.
- Pause Moodle provider selection if capability drift or credential compromise is detected.

## Trademark Notes

Moodle names and marks should be used only to describe interoperability. ChurchCore Academy materials must not imply Moodle endorsement, certification, partnership, or sponsorship unless a separate written agreement exists.

Keep ChurchCore Academy branding distinct from Moodle branding in tenant-facing materials.

## Review Checklist

- Moodle selected and active for the tenant.
- Launch configuration exists when Student PWA launch is enabled.
- Web Services are enabled only for selected sync families.
- Custom External Service is least privilege.
- Credentials are tenant scoped and secret stored.
- Provider responses are redacted in audit and reconciliation outputs.
- Grade/progress return remains reviewed import only.
- Reconciliation is run before pilot activation and after configuration changes.
