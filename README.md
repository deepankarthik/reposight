# RepoLens

> Understand any codebase in minutes, not days.

[![npm version](https://img.shields.io/npm/v/repolens.svg)](https://www.npmjs.com/package/repolens)
[![CI](https://github.com/deepankarthik/repolens/actions/workflows/ci.yml/badge.svg)](https://github.com/deepankarthik/repolens/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

RepoLens scans a repository, extracts its architecture (files, symbols, imports), and generates living documentation. Built for developers who need to understand unfamiliar code quickly — onboarding to a new team, reviewing pull requests, or navigating legacy codebases.

**No code leaves your machine.** Everything runs locally.

## Quick Start

```bash
# Install globally
npm install -g repolens

# Scan any repository
repolens scan /path/to/repo

# Output as JSON for the Interactive Explorer
repolens scan /path/to/repo -f json

# Open the web UI
open apps/web/public/index.html  # or just drag it into your browser
```

Or use without installing:

```bash
npx repolens scan .
```

## Features

- **Multi-language scanning** — TypeScript/JavaScript (AST), Python, Go, Rust, Java (regex)
- **Smart file selection** — Prioritizes important files using import graphs, git recency, and test pairing
- **Symbol extraction** — Functions, classes, interfaces with line numbers
- **Comment extraction** — JSDoc, docstrings, and `//` comments captured alongside symbols
- **Dependency graphs** — Import tracking with package resolution
- **Heuristic summaries** — Every file gets an automatic description using comments, symbols, and imports (zero AI cost)
- **AI-powered summaries** — Optional `--summarize` flag for LLM-generated explanations
- **Content-level diffs** — Compare git refs with symbol/import tracking
- **Interactive web UI** — Visual graph, architecture layers, search, and cross-references
- **GitHub Action** — Auto-generate and update architecture docs on every push and PR

## CLI Commands

### `scan [dir]`

Scan a repository and generate architecture documentation.

| Option | Description |
|--------|-------------|
| `-o, --output <dir>` | Output directory (defaults to repo root) |
| `-f, --format <format>` | `markdown` (default) or `json` |
| `--no-mermaid` | Skip Mermaid diagram generation |
| `--file-level` | File-level dependency graph (vs package-level) |
| `--ignore-tests` | Exclude test files |
| `--target-file <path>` | Score files relative to this target |
| `--include <patterns...>` | Only include matching files |
| `--exclude <patterns...>` | Exclude matching files |
| `--summarize` | AI-powered file summaries (requires API key) |

**Outputs:**
- `ARCHITECTURE.md` — Architecture report with Mermaid diagrams
- `ARCHITECTURE.json` — Structured JSON for the Interactive Explorer

### `diff [dir]`

Compare two git refs with symbol and import tracking.

| Option | Description |
|--------|-------------|
| `--base <ref>` | Base ref (required) |
| `--head <ref>` | Head ref (default: `HEAD`) |
| `-o, --output <dir>` | Output directory |

### `init [dir]`

Generate a `.repolensrc.json` config file.

## Interactive Explorer

The web UI (`apps/web/public/index.html`) provides a visual way to explore any codebase:

1. **Graph View** — Clickable import graph. Click nodes to see symbols, imports, and summaries.
2. **Architecture View** — Auto-detected layers (Presentation, Business Logic, Data, etc.).
3. **Data Flow** — Trace dependencies from entry points through the codebase.
4. **Search** — Find files, symbols, or concepts with keyboard navigation.
5. **Source Viewer** — View file contents with syntax highlighting.
6. **Export** — Download the graph as a PNG image.

**No server required** — open `index.html` directly in your browser. It reads `ARCHITECTURE.json` from the same directory.

## GitHub Action

Automatically generate and update architecture documentation on every push and pull request.

Add `.github/workflows/repolens.yml` to your repo:

```yaml
jobs:
  repolens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: deepankarthik/repolens/apps/github-action@master
        with:
          commit: true      # Auto-commit ARCHITECTURE.json
          comment: true     # Post PR comment with changes
          summarize: false  # Set true for AI summaries (requires AI_PROVIDER_API_KEY secret)
```

**AI summaries are delta-only** — when `summarize: true`, only changed files get AI summaries. Unchanged files keep their existing summaries. This keeps API costs low even on large repos. Set `AI_PROVIDER_API_KEY` as a repo secret to enable.

**What it does:**
- **On push:** Scans the repo, updates `ARCHITECTURE.json`, and commits it back. Preserves existing AI summaries.
- **On PR:** Compares the PR branch against the base branch and posts a comment showing added/removed/modified files with symbol and import changes.

## Configuration

Create a `.repolensrc.json` in your repo root:

```json
{
  "maxContextFiles": 80,
  "maxContextBytes": 120000,
  "maxFileBytes": 80000,
  "maxChunkChars": 6000,
  "aiProviderModel": "gpt-4o-mini",
  "includeMermaid": true,
  "logLevel": "info"
}
```

Or use environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_PROVIDER_BASE_URL` | `https://api.openai.com/v1` | AI provider endpoint |
| `AI_PROVIDER_API_KEY` | _(none)_ | API key for AI summaries |
| `AI_PROVIDER_MODEL` | `gpt-4o-mini` | Model name |
| `REPOLENS_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

## How It Works

1. **Discover** — Walk the directory tree, respecting `.gitignore` and generated file patterns
2. **Score** — Rank files by import depth, git recency, test pairing, and directory proximity
3. **Extract** — Parse symbols (AST for TS/JS, regex for others), extract comments (JSDoc, docstrings, `//`), and build import graphs
4. **Summarize** — Generate heuristic descriptions from file comments, symbol comments, paths, and imports
5. **Output** — Produce Markdown reports, JSON data, or both

## Project Structure

```
repolens/
├── packages/
│   ├── shared/           # Core types, config, errors, logger
│   ├── context-engine/   # Scanner, symbol extractor, import graph
│   └── ai/               # AI provider (local + remote)
├── apps/
│   ├── cli/              # CLI: scan, diff, init commands
│   ├── web/              # Interactive Explorer (static HTML)
│   └── github-action/    # GitHub Action for auto-updating docs
└── .github/workflows/    # CI pipeline + RepoLens action example
```

## Development

```bash
pnpm install
pnpm run build
pnpm test
pnpm dev:cli scan .
```

## Security

- All processing happens locally — no code is uploaded anywhere
- AI summaries only sent to your configured provider (OpenAI, Anthropic, etc.)
- SSRF protection on AI provider URLs (HTTPS required, domain allowlist, blocked ports)
- Path traversal protection on file access

## License

MIT
