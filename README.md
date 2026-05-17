# RepoLens

> Understand any codebase in minutes, not days.

## Overview

RepoLens is an open-source utility tool that scans a repository, extracts architecture (files, symbols, imports), and provides an interactive web UI for exploring codebases. Built for developers who need to understand unfamiliar code quickly — whether onboarding to a new team, reviewing legacy code, or conducting code reviews.

## Features

### Core Engine
- **Multi-language Support** — TypeScript/JavaScript via AST; Python, Go, Rust, and Java via regex patterns
- **Smart File Scoring** — Prioritizes important files using import graphs, git recency, test pairing, and directory proximity
- **Symbol Extraction** — Functions, classes, methods, interfaces with line numbers
- **Import Graph** — Dependency tracking with package resolution and external dependency detection
- **Content-level Diffs** — Unified diffs, symbol additions/removals, and import changes between git refs
- **Smart Filtering** — `.gitignore`/`.repolensignore` with negation, anchoring, and `**` globbing; `--include`/`--exclude` patterns; automatic generated file detection
- **Heuristic Summaries** — Automatic file descriptions generated from symbols, imports, and path analysis

### Interactive Explorer
- **Import Graph Visualization** — Clickable node-link diagram showing file dependencies
- **Architecture Layers** — Auto-detected layers (Presentation, Business Logic, Data, etc.) with file grouping
- **File Summaries** — Every file has a description explaining its role and key symbols
- **Search** — Find files, symbols, or summary content instantly
- **Symbol Details** — Click any node to see symbols, imports, and file context

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Scan a repository
pnpm dev:cli scan /path/to/repo

# Scan with JSON output (powers the web UI)
pnpm dev:cli scan /path/to/repo -f json

# Open the Interactive Explorer
open apps/web/public/index.html
```

## Interactive Explorer

The web UI provides a visual way to explore any codebase:

1. **Graph View** — Import graph with clickable nodes. Click any file to see its symbols, imports, and summary.
2. **Architecture View** — Auto-detected layers showing how the codebase is organized. Click files to navigate.
3. **Search** — Type to find files, symbols, or concepts across the entire codebase.

**No server required** — just open `apps/web/public/index.html` in your browser. The UI reads `ARCHITECTURE.json` directly.

## CLI Reference

### `scan [dir]`

Scan a repository and generate architecture documentation.

| Option | Description |
|--------|-------------|
| `-o, --output <dir>` | Output directory (defaults to repo root) |
| `-f, --format <format>` | `markdown` (default) or `json` |
| `--no-mermaid` | Skip Mermaid diagram generation |
| `--no-ai` | Skip AI-generated summary |
| `--file-level` | Generate file-level dependency graph |
| `--ignore-tests` | Exclude test files from scanning |
| `--target-file <path>` | Score files relative to this target |
| `--include <patterns...>` | Only include matching files |
| `--exclude <patterns...>` | Exclude matching files |
| `--summarize` | Generate AI-powered file summaries (requires API key) |

**Outputs:**
- `ARCHITECTURE.md` — Full architecture report with Mermaid diagrams
- `ARCHITECTURE.json` — Structured JSON powering the Interactive Explorer

### `diff [dir]`

Compare two git refs with content-level diffs and symbol tracking.

| Option | Description |
|--------|-------------|
| `--base <ref>` | Base ref (required) |
| `--head <ref>` | Head ref (default: `HEAD`) |
| `-o, --output <dir>` | Output directory |

### `init [dir]`

Generate a `.repolensrc.json` configuration file with sensible defaults.

## Configuration

RepoLens can be configured via environment variables or a `.repolensrc.json` file.

Example `.repolensrc.json`:
```json
{
  "maxContextFiles": 100,
  "maxContextBytes": 150000,
  "maxFileBytes": 80000,
  "maxChunkChars": 6000,
  "aiProviderModel": "claude-3-sonnet",
  "includeMermaid": true,
  "logLevel": "info"
}
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_PROVIDER_BASE_URL` | `https://api.openai.com/v1` | AI provider endpoint |
| `AI_PROVIDER_API_KEY` | _(none)_ | API key (triggers remote provider) |
| `AI_PROVIDER_MODEL` | `gpt-4o-mini` | Model name |
| `REPOLENS_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `REPOLENS_MAX_CONTEXT_FILES` | `80` | Max files to include in context |
| `REPOLENS_MAX_CONTEXT_BYTES` | `120000` | Max total bytes of context |
| `REPOLENS_MAX_FILE_BYTES` | `80000` | Max bytes per individual file |
| `REPOLENS_MAX_CHUNK_CHARS` | `6000` | Max characters per chunk |
| `REPOLENS_INCLUDE_MERMAID` | `true` | Include Mermaid diagrams |

## How It Works

### Smart File Scoring

Files are scored and sorted before inclusion. Lower score = higher priority:

```
score = base * 10 + importScore * 2 + recencyScore * 3 + testPairScore * 4 + proximityScore * 2 + samePackageScore * 1
```

| Component | Weight | Description |
|-----------|--------|-------------|
| `base` | 10 | Config files (0) > src/ files (1) > code files (2) > other (3) |
| `importScore` | 2 | Transitive import graph traversal (depth 2) |
| `recencyScore` | 3 | Git log recency (7-day exponential decay) + commit frequency |
| `testPairScore` | 4 | 1.0 if test/source pair match, 0.3 if same directory |
| `proximityScore` | 2 | Directory depth overlap with target file |
| `samePackageScore` | 1 | 0.5 if in same package/apps directory |

### Heuristic Summaries

Every file gets an automatic summary generated from:
- **File path** — Detects role (entry point, config, types, utils, etc.)
- **Symbols** — Lists key functions, classes, and interfaces
- **Imports** — Identifies external dependencies and internal modules

No AI required. Summaries are generated instantly during scanning.

### Output Formats

**Markdown** — Human-readable reports with Mermaid.js diagrams:
- Overview, Module Map, Key Symbols, Dependency Graph

**JSON** — Structured data powering the Interactive Explorer:
- Files with symbols, imports, and summaries
- Import graph with packages and external dependencies
- Architecture layers and key symbols

## Project Structure

```
repolens/
├── packages/
│   ├── shared/           # Core types, config, errors, logger
│   ├── context-engine/   # Scanner, symbol extractor, import graph, diff analyzer, summaries
│   └── ai/               # AI provider (optional)
├── apps/
│   ├── cli/              # CLI: scan, diff, init commands
│   └── web/              # Interactive Explorer (static HTML)
├── .github/
│   └── workflows/
│       └── ci.yml        # GitHub Actions CI
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── ROADMAP.md            # Product roadmap
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Typecheck
pnpm run typecheck

# Run tests
pnpm test

# Run CLI in dev mode
pnpm dev:cli

# Clean build artifacts
pnpm run clean
```

## License

MIT
