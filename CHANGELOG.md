# Changelog

## v0.1.0 - 2026-05-20

### Features

- feat: add heuristic summaries and architecture diagram to web UI
- feat: add interactive web explorer prototype
- feat: add JSON output, glob filtering, progress reporting, init command, symbol cross-ref, and config validation
- feat: add Go/Rust/Java support, smart filtering, and parallel processing
- feat: default dir to current directory for scan and diff commands
- feat: fix all known issues - Python extractor, diff CLI, import graph wiring, file-level Mermaid, tests, config limits
- feat: extract code comments for better heuristic summaries
- feat: prepare CLI for npm publishing
- feat: wire up --summarize flag for AI-powered file summaries
- feat: enhance web UI with search, cross-references, source viewer, and responsive design
- feat: add GitHub Action for auto-generating architecture docs
- feat: surgical updates to ARCHITECTURE.json with --files CLI option
- feat: web UI refactor with dark/light mode, diff view, improved search
- feat: improve Diff view UI/UX and fix pnpm dev:cli filter
- feat(cli): add explorer and serve commands for web UI
- feat(cli): make JSON the default output format

### Bug Fixes

- fix: handle missing arguments gracefully for all commands
- fix: show help instead of error when no command provided
- fix: diff command output dir creation and remove dead execFile call
- fix: address code review issues - race condition, cache counting, gitignore parsing, regex fixes
- fix: prevent budget overflow in parallel worker queue
- fix: escape all user-controlled content in web UI to prevent XSS
- fix: remove explicit pnpm version from CI to avoid packageManager conflict
- fix(ci): update actions to v6 for Node.js 24 support
- fix: commit pnpm-lock.yaml for CI reproducibility
- fix: delta-only AI summarization in GitHub Action
- fix: proper delta detection for AI summarization
- fix: restore workspace deps for dev, add prepublish/postpublish scripts for npm

### Refactoring

- refactor: remove dead code, fix shell injection, simplify CLI
- refactor: remove AI_SUMMARY.md and --no-ai flag, keep only --summarize for per-file AI summaries
- refactor(cli): remove standalone .mmd file generation

### Documentation

- docs: add comprehensive README
- docs: add roadmap, reposition product as codebase navigator + living docs
- docs: update README with current features and web UI documentation
- docs: add explicit AI usage section and remove CONTRIBUTING.md reference

### Chores

- chore: remove internal ROADMAP.md from public repo

## v0.1.1 - 2026-05-20

### Features

- feat(cli): make JSON the default output format
- feat(cli): add explorer and serve commands for web UI
- feat: improve Diff view UI/UX and fix pnpm dev:cli filter
- feat: web UI refactor with dark/light mode, diff view, improved search
- feat: surgical updates to ARCHITECTURE.json with --files CLI option
- feat: add GitHub Action for auto-generating architecture docs
- feat: extract code comments for better heuristic summaries
- feat: prepare CLI for npm publishing
- feat: wire up --summarize flag for AI-powered file summaries
- feat: enhance web UI with search, cross-references, source viewer, and responsive design
- feat: add heuristic summaries and architecture diagram to web UI
- feat: add interactive web explorer prototype
- feat: add JSON output, glob filtering, progress reporting, init command, symbol cross-ref, and config validation
- feat: add Go/Rust/Java support, smart filtering, and parallel processing
- feat: default dir to current directory for scan and diff commands
- feat: fix all known issues - Python extractor, diff CLI, import graph wiring, file-level Mermaid, tests, config limits

### Bug Fixes

- fix(cli): use global fetch instead of importing from node:https
- fix: proper delta detection for AI summarization
- fix: delta-only AI summarization in GitHub Action
- fix: restore workspace deps for dev, add prepublish/postpublish scripts for npm
- fix: commit pnpm-lock.yaml for CI reproducibility
- fix(ci): update actions to v6 for Node.js 24 support
- fix: remove explicit pnpm version from CI to avoid packageManager conflict
- fix: escape all user-controlled content in web UI to prevent XSS
- fix: prevent budget overflow in parallel worker queue
- fix: address code review issues - race condition, cache counting, gitignore parsing, regex fixes
- fix: handle missing arguments gracefully for all commands
- fix: show help instead of error when no command provided
- fix: diff command output dir creation and remove dead execFile call

### Refactoring

- refactor(cli): remove standalone .mmd file generation
- refactor: remove AI_SUMMARY.md and --no-ai flag, keep only --summarize for per-file AI summaries
- refactor: remove dead code, fix shell injection, simplify CLI

### Documentation

- docs: add explicit AI usage section and remove CONTRIBUTING.md reference
- docs: update README with current features and web UI documentation
- docs: add roadmap, reposition product as codebase navigator + living docs
- docs: add comprehensive README

### Chores

- chore: add release script and CHANGELOG
- chore: remove internal ROADMAP.md from public repo

## v0.1.2 - 2026-05-20

### Bug Fixes

- fix(action): update to Node.js 24 to avoid deprecation warning
- fix(build): resolve paths relative to script location

### Refactoring

- refactor: rename repolens to reposight across entire codebase

### Documentation

- docs: update README with RepoSight branding

### Build

- build: rebuild GitHub Action with renamed packages

## v0.1.3 - 2026-05-20

### Bug Fixes

- fix(cli): change bin entry to bundle.mjs for npx compatibility

## v0.1.4 - 2026-05-20

### Bug Fixes

- fix(action): remove stderr listener that misreported progress as errors
- fix(cli): switch to CJS bundle for Action compatibility
- fix(cli): bundle commander into CLI for self-contained execution
- fix(action): add detailed error logging for CLI execution
- fix(action): rename CLI bundle to .mjs for ESM compatibility
- fix(action): use import.meta.url for __dirname in ESM
- fix(action): bundle CLI inside Action to avoid npx dependency
- fix(cli): output bundle directly to index.js for npm compatibility

### Documentation

- docs: add RELEASE.md with release process and troubleshooting notes

### Chores

- chore: remove accidentally committed tarball

## v0.1.5-alpha.0 - 2026-05-20

### Bug Fixes

- fix: remove prepublish/postpublish scripts, restore workspace deps

## v0.1.5 - 2026-05-20

### Bug Fixes

- fix(release): promote prerelease to stable on patch bump

## v0.1.6 - 2026-05-26

### Features

- feat(web): natural language search with MiniSearch

### Refactoring

- refactor: improve type safety and simplify code
- refactor: remove dead code and fix double summarization bug
- refactor: remove dead code, simplify, fix bugs

## v0.1.7 - 2026-05-27

### Features

- feat(web): enhance drop zone with branding, icon, description, loading state
- feat(web): add GitHub Pages workflow for deployment

### Bug Fixes

- fix: use theme-aware background in PNG export via destination-over compositing
- fix: export PNG with white background instead of transparent
- fix: ReDoS in JAVA_METHOD_RE - three nested space-matching sources
- fix: DOM XSS - escape getRepoPath() and result.id in innerHTML
- fix: ReDoS in RUST_IMPORT_RE - greedy .+ matching semicolons
- fix: ReDoS vulnerability in Rust regexes (nested quantifiers in symbol-extractor)
- fix: add types node to tsconfig for NodeJS namespace resolution
- fix(web): split diff drop zone into two separate zones for base and head
- fix(web): address security and maintainability review feedback
- fix(web): center drop zone and enhance visual design
- fix(web): restore layout, add file:// drop-zone with drag-and-drop

### Documentation

- docs: add live demo link to Interactive Explorer section
- docs: remove why reposight section, update beta status, document .reposightignore

### Chores

- chore(deps): bump typescript from 5.9.3 to 6.0.3 (#7)
- chore(deps): bump @actions/github from 6.0.1 to 9.1.1 (#6)
- chore(deps): bump @actions/exec from 1.1.1 to 3.0.0 (#5)
- chore(deps-dev): bump vitest from 4.1.6 to 4.1.7 (#4)
- chore(deps): bump github/codeql-action from 3 to 4 (#3)
- chore(deps): bump actions/upload-pages-artifact from 4 to 5 (#2)
- chore(deps): bump actions/checkout from 5 to 6 (#1)
- chore: polish and ship — license, linting, CI hardening, contributing guide

### CI/CD

- ci: add workflow_dispatch trigger to CodeQL

### Other

- Potential fix for code scanning alert no. 10: Incomplete string escaping or encoding (#11)

