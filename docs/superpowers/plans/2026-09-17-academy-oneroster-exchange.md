# Academy OneRoster exchange implementation

Status: In progress. Owner authorized separate Academy implementation and PR on 2026-09-17.

1. Recover and review exporter and fixtures; enforce current authorization and privacy rules.
2. Add tenant-scoped admin ZIP download and expose it in LMS settings.
3. Validate fixtures against the existing LMS importer; verify persisted prerequisites through actual Academy modules and browser download.
4. Add signed sender using the existing LMS message contract after package parity passes; keep production activation disabled.
5. Verify unit, lint, build, tenant isolation, browser, signed local delivery and replay behavior.
6. Record evidence, review diff, publish separate Academy PR, and wait for hosted checks.

## September 17 verification

- Implemented selected-section delta export, admin download, disabled-by-default signed scheduler and exact cron middleware routing.
- Full suite: 1,683 tests passed; lint and production build passed; npm audit reports zero vulnerabilities. Focused fixture tests passed again after naming the privacy-corrected fixture v2.
- Fresh isolated Academy database replayed every migration. Production module functions created the full academic dependency chain and exported it. LMS accepted all 20 persisted rows, with no validation issues; the golden fixture passed all 23 rows.
- Real HTTP delivery to the isolated LMS returned awaiting_review then duplicate. Replay, stale timestamps and invalid signatures were rejected. Protected cron returned 401 without credentials and 200/duplicate with valid configuration. Saved LMS job remained validated, dry_run=true, created_count=0, updated_count=0.
- Authenticated production-build download API returned application/zip with private/no-store. Browser click received the same ZIP response without console errors. In-app native download-event capture timed out, so OS file-save completion is not claimed.
- Desktop card and mobile download controls were visually checked. The shared mobile header has pre-existing picker overlap/horizontal overflow; this slice does not change that shared shell. Hosted PR checks are pending publication. No production configuration, merge or deployment has been performed.
