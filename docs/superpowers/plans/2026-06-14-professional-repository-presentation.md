# Professional Repository Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give ChurchCore Academy a professional, factual public repository surface and standard open-source governance artifacts.

**Architecture:** Keep the README concise and navigational, move detailed technology and maturity information into focused docs, and use standard root and `.github` files for community workflows. Preserve product truth by separating implemented, partial, and planned capabilities.

**Tech Stack:** Markdown, JSON package metadata, GitHub issue-form YAML, shell-based link and configuration verification.

---

### Task 1: Public Project Overview

**Files:**
- Modify: `README.md`
- Create: `docs/README.md`
- Create: `docs/technology.md`
- Create: `docs/project-status.md`

- [x] Replace the roadmap-heavy README with product positioning, maturity, architecture, technology, setup, commands, repository layout, and documentation links.
- [x] Add focused documentation index, technology, and status artifacts.
- [x] Ensure planned capabilities are not described as production-complete.

### Task 2: Licensing and Community Governance

**Files:**
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `SUPPORT.md`
- Create: `CODE_OF_CONDUCT.md`
- Modify: `CHANGELOG.md`

- [x] Add the MIT license for ChurchCore Academy contributors.
- [x] Define contribution, security reporting, support, and conduct procedures.
- [x] Convert the changelog to a structured project history.

### Task 3: Developer and GitHub Experience

**Files:**
- Create: `.env.example`
- Modify: `package.json`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/workflows/ci.yml`
- Create: `.github/dependabot.yml`

- [x] Document safe local environment variables.
- [x] Add package description, license, repository, issue, author, and engine metadata.
- [x] Add structured issue forms and pull request review prompts.
- [x] Add Node 24 CI and weekly dependency update configuration.

### Task 4: Verification and Publication

- [x] Parse `package.json` and issue-form YAML.
- [x] Verify all relative Markdown links.
- [x] Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check`.
- [x] Review the exact diff for overstated capabilities or missing governance links.
- [ ] Commit, push, open a pull request, merge, and update GitHub description and homepage metadata.
