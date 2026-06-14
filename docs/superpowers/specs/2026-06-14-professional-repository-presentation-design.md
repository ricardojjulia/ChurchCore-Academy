# Professional Repository Presentation Design

## Goal

Present ChurchCore Academy as a credible open-source engineering project while accurately distinguishing implemented foundations, working vertical slices, partial workflows, and planned capabilities.

## Decisions

1. The root README is the public product and engineering overview, not the complete roadmap.
2. Current maturity is explicit and no planned workflow is presented as production-ready.
3. Technology and project status move into focused durable documents.
4. Standard open-source governance files define contribution, security, support, conduct, and licensing expectations.
5. GitHub issue forms and a pull request template guide future work through the repository software factory.
6. `package.json`, GitHub metadata, README language, and the MIT license use consistent project identity.
7. `.env.example` documents variable names and safe local defaults without containing credentials.

## Artifacts

- `README.md`
- `LICENSE`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `SUPPORT.md`
- `CODE_OF_CONDUCT.md`
- `.env.example`
- `docs/README.md`
- `docs/technology.md`
- `docs/project-status.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/ci.yml`
- `.github/dependabot.yml`
- `package.json` metadata

## Verification

- all relative Markdown links resolve
- JSON and YAML parse successfully
- documented npm scripts exist
- documented environment variables match runtime usage
- tests, lint, build, and whitespace checks pass
- repository metadata is updated only after the documentation PR merges
