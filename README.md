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
- **Dependency graphs** — Import tracking with package resolution
- **Heuristic summaries** — Every file gets an automatic description (zero AI cost)
- **AI-powered summaries** — Optional `--summarize` flag for LLM-generated explanations
- **Content-level diffs** — Compare git refs with symbol/import tracking
- **Interactive web UI** — Visual graph, architecture layers, search, and cross-references

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

## AI Usage

RepoLens works **fully without AI** by default. AI is an optional enhancement.

### When AI is Used

AI is only invoked when you explicitly pass the `--summarize` flag:

```bash
repolens scan . --summarize
```

This sends each file's content (truncated to 4000 chars), symbols, and imports to your configured AI provider to generate a per-file summary. These summaries appear in `ARCHITECTURE.json` and the web UI.

### When AI is NOT Used

Everything else runs locally with zero AI calls:
- File discovery and scoring
- Symbol extraction (AST/regex)
- Import graph building
- Heuristic summaries (generated from path patterns, symbol names, and imports)
- Diff analysis between git refs
- Web UI rendering

### Disabling AI

AI is **off by default**. As long as you don't pass `--summarize`, no AI calls are made. All file summaries in the output are generated heuristically from code analysis — zero cost, instant, and fully local.

### AI Provider Configuration

If you want AI summaries, set these variables:

```bash
export AI_PROVIDER_API_KEY=sk-your-key
export AI_PROVIDER_BASE_URL=https://api.openai.com/v1  # or any OpenAI-compatible endpoint
export AI_PROVIDER_MODEL=gpt-4o-mini
```

Supported providers: OpenAI, Anthropic, Groq, Together, DeepSeek, OpenRouter, or any OpenAI-compatible API.

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
3. **Extract** — Parse symbols (AST for TS/JS, regex for others) and build import graphs
4. **Summarize** — Generate heuristic descriptions from paths, symbols, and imports
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
│   └── web/              # Interactive Explorer (static HTML)
└── .github/workflows/    # CI pipeline
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
