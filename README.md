# RepoLens

> Understand any codebase in minutes, not days.

## Overview

RepoLens scans a repository, extracts architecture (files, symbols, imports), and provides two ways to explore it:

1. **Interactive Explorer** — Web UI for navigating codebase architecture, tracing data flow, and understanding how pieces connect
2. **Living Docs** — GitHub Action that auto-generates architecture documentation and detects architectural changes on every PR

The core engine uses heuristic scoring to prioritize important files, multi-language symbol extraction, and import graph analysis — all optimized for helping developers understand unfamiliar codebases quickly.

## Features

### Core Engine
- **Multi-language Support** — TypeScript/JavaScript via AST; Python, Go, Rust, and Java via regex patterns
- **Smart File Scoring** — Prioritizes important files using import graphs, git recency, test pairing, and directory proximity
- **Symbol Extraction** — Functions, classes, methods, interfaces with line numbers
- **Import Graph** — Dependency tracking with package resolution and external dependency detection
- **Content-level Diffs** — Unified diffs, symbol additions/removals, and import changes between git refs
- **Smart Filtering** — `.gitignore`/`.repolensignore` with negation, anchoring, and `**` globbing; `--include`/`--exclude` patterns; automatic generated file detection

### Interactive Explorer (Coming Soon)
- Visual architecture map with clickable nodes
- Trace data flow from entry point to database
- Search: "auth" → highlight all auth-related files and symbols
- Click any symbol → see where it's referenced across the codebase

### Living Docs (Coming Soon)
- GitHub Action that auto-generates `ARCHITECTURE.md` on every push
- PR comments showing architectural impact: new deps, removed deps, modified flows
- Documentation that stays current as code changes

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Scan a repository (generates ARCHITECTURE.md + JSON)
pnpm dev:cli scan /path/to/repo

# Scan with JSON output (powers the web UI)
pnpm dev:cli scan /path/to/repo -f json

# Compare two git refs
pnpm dev:cli diff /path/to/repo --base main --head feature-branch
```

See [ROADMAP.md](./ROADMAP.md) for the full product roadmap and upcoming features.

## CLI Reference

The CLI is the foundation that powers both the Interactive Explorer and Living Docs.

### `scan [dir]`
Scan a repository and generate architecture documentation.

| Option | Description |
|--------|-------------|
| `-o, --output <dir>` | Output directory |
| `-f, --format <format>` | `markdown` (default) or `json` |
| `--include <patterns...>` | Only include matching files |
| `--exclude <patterns...>` | Exclude matching files |

### `diff [dir]`
Compare two git refs with content-level diffs and symbol tracking.

| Option | Description |
|--------|-------------|
| `--base <ref>` | Base ref (required) |
| `--head <ref>` | Head ref (default: `HEAD`) |

## Configuration

RepoLens can be configured via environment variables or a `.repolensrc.json` file in the repository root. Config file values are overridden by environment variables.

Generate a config file with `repolens init /path/to/repo`.

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
| `REPOLENS_MAX_TOKEN_BUDGET` | `100000` | Max token budget for conversations |
| `REPOLENS_INCLUDE_MERMAID` | `true` | Include Mermaid diagrams |

## Project Structure

```
repolens/
├── packages/
│   ├── shared/           # Core types, config, errors, logger
│   ├── context-engine/   # Scanner, symbol extractor, import graph, diff analyzer
│   └── ai/               # AI provider (optional, for future features)
├── apps/
│   ├── cli/              # CLI: scan, diff commands
│   ├── web/              # Interactive Explorer (coming soon)
│   └── github-action/    # Living Docs Action (coming soon)
├── .github/
│   └── workflows/
│       └── ci.yml        # GitHub Actions CI
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── ROADMAP.md            # Product roadmap
```

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

### Output Formats

**Markdown** — Human-readable reports with Mermaid.js diagrams:
- Overview, Module Map, Key Symbols, Dependency Graph

**JSON** — Structured data powering the Interactive Explorer:
- Files with symbols and imports, import graph with packages, modules, key symbols

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
