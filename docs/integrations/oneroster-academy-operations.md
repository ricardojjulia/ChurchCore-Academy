# Academy roster export and signed delivery

This slice restores Academy's roster-provider boundary under the owner's explicit September 17 authorization. It implements the approved CSV roster subset, not formal OneRoster certification, REST exchange or grade return.

## Administrator download

Open **System → LMS Providers → ChurchCore LMS roster exchange**, select a section, and choose **Download OneRoster ZIP**. The selected section makes the academic scope explicit. Only an institution administrator may export. The authenticated route reads persisted records in the actor's tenant context and returns a private, non-cacheable ZIP. Phone numbers, guardians, demographics and credentials are excluded. LMS still requires explicit identity links and human review before applying changes.

The first slice exports delta packages for scheduled/open/in-progress/completed sections. Bulk snapshots, complete deletion reconciliation for archived academic structure, v1.1 export and REST are not implemented by this slice. A withdrawal emits a deleted enrollment. Exporting a section does not assert that omitted sections have been deleted.

## Scheduled delivery (disabled until configured)

The protected `/api/cron/oneroster-delivery` endpoint runs at 06:00 UTC daily. It requires `CRON_SECRET`. Without an enabled delivery configuration it performs no roster reads or network delivery.

After sandbox verification and operator approval, configure these server-side deployment variables:

- `ONEROSTER_DELIVERY_CONFIG`: JSON with `enabled`, `tenantId`, `externalSubject`, `sectionId`, `connectionId`, `lmsOrigin`, and `keyId`.
- `ONEROSTER_SIGNING_PRIVATE_KEY`: an Ed25519 PKCS#8 PEM private key. Never put this in a public environment variable, source control or logs.
- `CRON_SECRET`: the existing scheduler credential.

This initial configuration binds one selected section in one Academy tenant to one LMS connection per deployment. `externalSubject` must resolve to an active, persisted Academy account with the institution-admin role in that exact tenant. Every execution checks current account/role state and tenant lifecycle. It does not trust roles or tenant identifiers from request headers. Expansion to multiple tenant schedules requires a later scoped change.

`lmsOrigin` must be an HTTPS origin without credentials, paths, queries or fragments. Local development permits loopback HTTP for disposable verification. The exact LMS connection must have signed push enabled, the matching key identifier/public key, and the intended Academy source tenant. Set LMS's expected cadence to 1440 minutes. Register a dedicated public/private key pair for each configured connection. Production configuration and activation are not part of this PR.

The sender binds the connection ID, UUID delivery ID, timestamp and SHA-256 ZIP digest to the existing `churchcore-oneroster-delivery-v1` message. It refuses redirects, times out after 15 seconds, and does not expose receiver payloads or signing errors. Deterministic ZIP timestamps make unchanged source data produce identical bytes. LMS's package hash deduplicates retries, while delivery IDs prevent replay. A response confirms staging for review, never application of records. After a timeout, inspect LMS history before retrying; the next scheduled execution may report a duplicate.

## Verification

Run `npm test`, `npm run lint`, and `npm run build`. `ONEROSTER_DISPOSABLE_DATABASE=true node --env-file=.env.local --import tsx scripts/verify-oneroster-workflow.ts` is restricted to loopback databases and creates disposable prerequisites using production module functions: tenant provisioning, people, academic year/term, course/section, program, admissions, enrollment conversion and section registration. It writes synthetic ZIP and temporary browser credentials to the parent directory; remove them and the disposable stack after verification. Never point it at a shared or hosted database.

The JSZip dependency is pinned to 3.10.1 to create standard compressed ZIP packages compatible with the LMS reader. The exporter caps expanded CSV at 50 MB and compressed ZIP at 10 MB. The versioned `churchcore-academy-rostering-v2` fixture removes phone data from the older v1 artifact; it passed the LMS reader without edits. Test fixtures are imported directly by tests/scripts and are not exported by the runtime module barrel.
