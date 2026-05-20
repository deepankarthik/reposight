# RepoSight

> Understand any codebase in minutes, not days.

[![npm version](https://img.shields.io/npm/v/reposight.svg)](https://www.npmjs.com/package/reposight)
[![CI](https://github.com/deepankarthik/reposight/actions/workflows/ci.yml/badge.svg)](https://github.com/deepankarthik/reposight/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

RepoSight scans a repository, extracts its architecture (files, symbols, imports), and generates living documentation. Built for developers who need to understand unfamiliar code quickly — onboarding to a new team, reviewing pull requests, or navigating legacy codebases.

**No code leaves your machine.** Everything runs locally.

> **Experimental:** This project is under active development. Expect bugs, breaking changes, and incomplete features. Use at your own risk.

## Quick Start

```bash
# Install globally
npm install -g reposight

# Scan any repository
reposight scan /path/to/repo

# Output as JSON for the Interactive Explorer
reposight scan /path/to/repo -f json

# Option 1: Start a local server (recommended)
reposight serve /path/to/repo

# Option 2: Copy the web UI next to your JSON
reposight explorer /path/to/repo
# Then open index.html in your browser
```

Or use without installing:

```bash
npx reposight scan .
```

## Why RepoSight?

| | RepoSight | CodeSee | Sourcegraph |
|---|---|---|---|
| **Cost** | Free, open-source | $49+/user/month | $49+/user/month |
| **Setup** | `npx reposight scan .` | SaaS signup, GitHub app | Self-host or cloud |
| **Data** | Stays in your repo | Stored on their servers | Stored on their servers |
| **AI** | Optional, delta-only | Required | Required |
| **Offline** | Full support | No | No |
| **Self-hosted** | Yes | No | Limited |

**RepoSight is the `prettier` of architecture docs** — run it, get docs, done. No SaaS, no signup, no pricing tiers.

## Features

- **Multi-language scanning** — TypeScript/JavaScript (AST), Python, Go, Rust, Java (regex)
- **Smart file selection** — Prioritizes important files using import graphs, git recency, and test pairing
- **Symbol extraction** — Functions, classes, interfaces with line numbers
- **Comment extraction** — JSDoc, docstrings, and `//` comments captured alongside symbols
- **Dependency graphs** — Import tracking with package resolution
- **Heuristic summaries** — Every file gets an automatic description using comments, symbols, and imports (zero AI cost)
- **AI-powered summaries** — Optional `--summarize` flag for LLM-generated explanations
- **Content-level diffs** — Compare git refs with symbol/import tracking
- **Interactive web UI** — Visual graph, architecture layers, search, dark/light mode, and cross-references
- **GitHub Action** — Auto-generate and update architecture docs on every push and PR

## CLI Commands

### `scan [dir]`

Scan a repository and generate architecture documentation.

| Option | Description |
|--------|-------------|
| `-o, --output <dir>` | Output directory (defaults to repo root) |
| `-f, --format <format>` | `json` (default) or `markdown` |
| `--no-mermaid` | Skip Mermaid diagram in markdown report |
| `--file-level` | File-level dependency graph (vs package-level) |
| `--ignore-tests` | Exclude test files |
| `--target-file <path>` | Score files relative to this target |
| `--include <patterns...>` | Only include matching files |
| `--exclude <patterns...>` | Exclude matching files |
| `--files <paths...>` | Scan only these specific files |
| `--summarize` | AI-powered file summaries (requires API key) |

**Outputs:**
- `ARCHITECTURE.json` — Structured JSON for the Interactive Explorer (always generated)
- `ARCHITECTURE.md` — Architecture report with embedded Mermaid diagram (only with `-f markdown`)

### `diff [dir]`

Compare two git refs with symbol and import tracking.

| Option | Description |
|--------|-------------|
| `--base <ref>` | Base ref (required) |
| `--head <ref>` | Head ref (default: `HEAD`) |
| `-o, --output <dir>` | Output directory |

### `init [dir]`

Generate a `.reposightrc.json` config file.

### `explorer [dir]`

Copy the web UI next to your `ARCHITECTURE.json` for local viewing.

| Option | Description |
|--------|-------------|
| `-o, --output <dir>` | Output directory (defaults to current directory) |

### `serve [dir]`

Start a local HTTP server to view the architecture graph.

| Option | Description |
|--------|-------------|
| `-p, --port <port>` | Port to serve on (default: 3000) |

Serves `index.html` and `ARCHITECTURE.json` from the target directory. Open `http://localhost:3000` in your browser.

## Interactive Explorer

The web UI provides a visual way to explore any codebase:

1. **Graph View** — Clickable import graph. Click nodes to see symbols, imports, and summaries.
2. **Architecture View** — Auto-detected layers (Presentation, Business Logic, Data, etc.).
3. **Data Flow** — Trace dependencies from entry points through the codebase.
4. **Diff View** — Compare architecture between git refs to see what changed.
5. **Search** — Find files, symbols, comments, or concepts with keyboard navigation.
6. **Source Viewer** — View file contents with syntax highlighting.
7. **Dark/Light Mode** — Toggle between themes.
8. **Export** — Download the graph as a PNG image.

**Viewing options:**

```bash
# Start a local server (recommended)
reposight serve /path/to/repo   # http://localhost:3000

# Or copy the HTML next to your JSON
reposight explorer /path/to/repo
# Open index.html in your browser
```

No server required for the HTML file — it reads `ARCHITECTURE.json` from the same directory.

## GitHub Action

Automatically generate and update architecture documentation on every push and pull request.

Add `.github/workflows/reposight.yml` to your repo:

```yaml
jobs:
  reposight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: deepankarthik/reposight/apps/github-action@master
        with:
          commit: true      # Auto-commit ARCHITECTURE.json
          comment: true     # Post PR comment with changes
          summarize: false  # Set true for AI summaries (requires AI_PROVIDER_API_KEY secret)
```

**AI summaries are delta-only** — when `summarize: true`, only changed files get AI summaries. Unchanged files keep their existing summaries. This keeps API costs low even on large repos. Set `AI_PROVIDER_API_KEY` as a repo secret to enable.

**What it does:**
- **On push:** Scans only changed files, surgically updates `ARCHITECTURE.json`, preserves existing AI summaries.
- **On PR:** Compares the PR branch against the base branch and posts a comment showing added/removed/modified files with symbol and import changes.

## Configuration

Create a `.reposightrc.json` in your repo root:

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
| `REPOSIGHT_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

## How It Works

1. **Discover** — Walk the directory tree, respecting `.gitignore` and generated file patterns
2. **Score** — Rank files by import depth, git recency, test pairing, and directory proximity
3. **Extract** — Parse symbols (AST for TS/JS, regex for others), extract comments (JSDoc, docstrings, `//`), and build import graphs
4. **Summarize** — Generate heuristic descriptions from file comments, symbol comments, paths, and imports
5. **Output** — Produce Markdown reports, JSON data, or both

## Project Structure

```
reposight/
├── packages/
│   ├── shared/           # Core types, config, errors, logger
│   ├── context-engine/   # Scanner, symbol extractor, import graph
│   └── ai/               # AI provider (local + remote)
├── apps/
│   ├── cli/              # CLI: scan, diff, trace, init, explorer, serve
│   ├── web/              # Interactive Explorer (static HTML)
│   └── github-action/    # GitHub Action for auto-updating docs
└── .github/workflows/    # CI pipeline + RepoSight action example
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
