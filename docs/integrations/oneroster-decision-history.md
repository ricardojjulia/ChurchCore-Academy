# OneRoster — Decision History

Date: 2026-09-12

## Summary

**OneRoster is the ratified Academy ↔ LMS interoperability standard**, but the implementation belongs in the **ChurchCore LMS** repository, not here. This document records what happened in this repository so the history isn't lost when the code was correctly removed from it.

## Timeline

| When (UTC) | What |
| --- | --- |
| 2026-09-12 21:20:58 | PR #98 `feat: add shared OneRoster provider contract` merged to `main`. Ratified OneRoster as the shared Academy/LMS exchange standard (ADR-0069), and added an Academy-side `oneroster-contract` module: provider/export contract, ZIP output, deterministic fixture generation, plus cross-repo fixture parity metadata for LMS-side validation. |
| 2026-09-12 21:25:14 | PR #100 `revert: remove Academy OneRoster provider contract` merged to `main`, four minutes later. Reverted all of PR #98's code and the ADR. |

The revert PR's own description states the reason plainly: *"this revert is intentional because the active workspace for the requested commit/push was ChurchCore LMS."* In other words, the work was correct in substance but landed in the wrong repository — a cross-repo mixup, not a design rejection.

## What this means going forward

- **OneRoster remains the intended Academy ↔ ChurchCore LMS (and Moodle/Canvas) rostering and gradebook exchange standard.** Nothing about that decision was reversed — only the code's location.
- **The reverted implementation is fully recoverable from git history** in this repository at commit `94dfdde` (`feat: add shared OneRoster provider contract`) and the merge commit `7a0cd03` (PR #98), for anyone porting the work to ChurchCore LMS. It included:
  - `src/modules/oneroster-contract/` — provider/export contract, CSV/ZIP output, conformance fixture generation
  - `src/modules/oneroster-standard/` — OneRoster profile definitions
  - `src/modules/lms-roster-source/oneroster.ts` — roster-source bridging
  - `fixtures/oneroster/churchcore-academy-rostering-v1/` — sample CSV rostering package
  - `scripts/generate-oneroster-fixture.ts` and `scripts/generate-oneroster-shared-fixture.ts`
  - `docs/adr/0069-oneroster-shared-exchange-standard.md`
  - `docs/integrations/oneroster-shared-exchange.md`
- **This repository's role in OneRoster, per the product boundary in `docs/product/product-context.md`, is to be the system of record Academy exposes a rostering/gradebook feed from** — the actual OneRoster provider/consumer implementation, certification-readiness work, and the CSV/REST binding surfaces belong in ChurchCore LMS.
- As of this writing, a separate in-progress planning document exists at `docs/superpowers/plans/2026-09-12-oneroster-certification-ready-compliance-plan.md`, authored outside this session, describing a certification-ready OneRoster 1.2 approach spanning both repos. That plan is the current forward-looking reference for this work — this document only records what already happened in this repo's history.

## Recommendation

Do not re-implement OneRoster provider/export logic in ChurchCore Academy. If Academy-side rostering data needs to be exposed for OneRoster export, expose it through the existing `lms-contract` module's provider-neutral interface (`src/modules/lms-contract/`) and let ChurchCore LMS's OneRoster implementation consume it — consistent with `docs/product/product-context.md`'s statement that ChurchCore LMS is the primary integration target and owns course delivery, not Academy.
