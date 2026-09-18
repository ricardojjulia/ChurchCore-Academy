# Academy OneRoster provider review

Owner authorization: separate Academy implementation and PR explicitly approved on September 17. This record applies the existing cross-repository compliance plan and LMS COUNCIL-2026-019 transport decision. It records focused engineering review passes, not an invented human council vote or approval to activate production.

- Product boundary: Academy projects SIS records; LMS remains responsible for course delivery and reviewed import/apply.
- Data/privacy: explicit administrator and tenant checks precede export; repository results are checked for tenant contamination; no Auth creation, academic mutations or unapproved phone/guardian/demographic export.
- Architecture: manual download and signed scheduling use the same export module. The scheduler derives current roles from persisted identity and uses a transaction-bound repository context. Secrets remain deployment-owned.
- Security: Ed25519, exact connection binding, HTTPS origins, no redirect following, bounded packages, safe errors, disabled-by-default configuration. The exact cron route bypasses browser-cookie middleware because it enforces its own scheduler secret; other routes retain their existing gate.
- Test evidence: real dependency workflow and local LMS acceptance/deduplication/replay rejection verified. Runtime receipt leaves one validated dry-run job with zero create/update counts. Browser button returned HTTP 200 with application/zip. Native browser download-event capture timed out in the in-app browser, so file-save completion was not independently observed; the authenticated API bytes were captured and validated separately.
- UI review: widened the roster card and labelled the first-party exchange. Mobile card controls fit, but the unchanged shared header has picker overlap/horizontal overflow.
- Remaining scope: this is the selected-section CSV/signed-delivery slice. Full provider conformance, archived structure deletion reconciliation, multiple tenant schedules, REST and grade return remain on the broader plan. Production key registration and activation remain externally gated.

Delivery decision: publish the independently verified Academy PR for owner review; do not merge or activate production automatically.

September 18 merge review: corrected text section IDs in both entry points, enforced lmsRosterSync for manual and scheduled export, and retained archived course/year/term parents as active historical references while their sections remain exported. Added regressions for text IDs and archived parents.
