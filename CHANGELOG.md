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
