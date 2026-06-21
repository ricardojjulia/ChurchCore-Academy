# ADR-0029 — Official Records Print and Export Strategy

**Date:** 2026-06-18  
**Status:** Accepted  
**Deciders:** Council Review IV (Agent 3 + synthesis)

---

## Context

The transcript module declares `"print"` as a delivery method (`src/modules/transcripts/types.ts`), and the admission and transcript pages are expected to produce printable or exportable official records. However:

- There are zero `@media print` CSS rules in any stylesheet.
- Browser-printing any page (`/admin/transcripts`, `/admin/students/[id]`, `/admin/reporting`) renders the full shell — sidebar, topbar, search bar, badges, and action buttons.
- No PDF generation or download action exists anywhere in the SIS.
- The `/admin/transcripts` page currently instructs staff to POST directly to the API, with no UI issuance form.

This makes it impossible for any staff member to produce an official printed or downloadable transcript record without developer access.

---

## Decision

### 1. Print CSS (immediate)

Add `@media print` rules to `src/styles/admin.css` and `src/styles/student-pwa.css` that:

- Hide: `.admin-sidebar`, `.admin-topbar`, `.admin-mobile-menu-toggle`, `.admin-search-wrapper`, `.admin-context-banner`, `.admin-page-action-*`, `.student-pwa-nav`, `.student-pwa-bottom-nav`, all `<button>` elements inside `.admin-content`, and all `.badge` action buttons.
- Show: only `.admin-content` and `.student-pwa-main` as the full-width print region.
- Add institution name and print date via `::before` on the print content area.
- Ensure tables do not break across pages (`page-break-inside: avoid` on `<tr>`).

### 2. Transcript issuance UI (immediate)

Add a transcript issuance form to `/admin/transcripts/page.tsx` that:

- Lets staff select a student (from the existing student index), delivery method (digital_download, email, print), and recipient email (when email is selected).
- POSTs to the existing `/api/academy/transcripts` route.
- Shows a success confirmation and refreshes the issued-transcripts list.

### 3. PDF generation (deferred)

Server-side PDF generation (e.g., via Puppeteer or a headless render) is **deferred to a future phase**. The immediate solution is print CSS + a transcript download that opens a print-optimized page. No client-side PDF library (jsPDF, pdfmake) may be added to the bundle — they are large and produce non-accessible PDFs.

---

## Consequences

- Staff can produce clean printed transcripts immediately after Prompt F is executed.
- The `"print"` delivery method type becomes usable from the admin UI.
- No new runtime dependencies are added.
- PDF-quality output (for certified transcripts sent to other institutions) remains a Phase 12+ deliverable.

---

## Rejected Alternatives

- **Client-side PDF generation** — large bundle, inaccessible output, inconsistent rendering across platforms.
- **Server-side PDF at MVP** — too much complexity for Phase 5 sprint; print CSS achieves 80% of the value in 20% of the effort.
