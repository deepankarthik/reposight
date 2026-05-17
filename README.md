# RepoLens

> Generate living documentation from codebases — architecture maps, dependency graphs, and data flow traces.

## Overview

RepoLens is a CLI tool that scans a repository, extracts context (files, symbols, imports), scores files heuristically, and produces Markdown or JSON reports with Mermaid.js diagrams. An optional AI provider can generate architecture summaries, code flow traces, and diff analysis.

## Features

- **Architecture Reports** — Markdown or JSON reports with Overview, Module Map, Key Symbols, and Mermaid dependency graphs
- **Heuristic File Scoring** — Prioritizes important files using import graphs, git recency, test pairing, and directory proximity
- **Multi-language Support** — TypeScript/JavaScript via AST; Python, Go, Rust, and Java via regex patterns
- **Smart Filtering** — `.gitignore`/`.repolensignore` with negation, anchoring, and `**` globbing; `--include`/`--exclude` patterns; `--ignore-tests` flag; automatic generated file detection
- **Content-level Diffs** — Unified diffs, symbol additions/removals, and import changes between git refs
- **Symbol Cross-referencing** — Track which symbols reference which across files
- **File Caching** — In-memory LRU cache with mtime-based invalidation
- **AI Integration** — Optional AI-generated architecture summaries, code flow tracing, and diff analysis
- **Progress Reporting** — Real-time scan progress feedback
- **SSRF Protection** — Remote AI provider validates URLs against allowlisted domains and blocked ports

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Generate a config file
pnpm dev:cli init /path/to/repo

# Scan a repository
pnpm dev:cli scan /path/to/repo

# Scan with JSON output
pnpm dev:cli scan /path/to/repo -f json

# Scan specific files only
pnpm dev:cli scan /path/to/repo --include "src/**/*.ts" --exclude "**/*.test.ts"

# Scan relative to a target file
pnpm dev:cli scan /path/to/repo --target-file src/auth.ts

# Trace code flow (requires AI API key)
pnpm dev:cli trace /path/to/repo "how does authentication work?"

# Compare two git refs
pnpm dev:cli diff /path/to/repo --base main --head feature-branch
```

## Commands

### `scan [dir]`

Scan a repository and generate architecture documentation.

| Option | Description |
|--------|-------------|
| `-o, --output <dir>` | Output directory (defaults to repo root) |
| `-f, --format <format>` | Output format: `markdown` (default) or `json` |
| `--no-mermaid` | Skip Mermaid diagram generation |
| `--no-ai` | Skip AI-generated summary |
| `--file-level` | Generate file-level dependency graph instead of package-level |
| `--ignore-tests` | Exclude test files from scanning |
| `--target-file <path>` | Score files relative to this target (proximity, test-pairing, same-package) |
| `--include <patterns...>` | Only include files matching these glob patterns |
| `--exclude <patterns...>` | Exclude files matching these glob patterns |

**Outputs (Markdown):**
- `ARCHITECTURE.md` — Full architecture report
- `DEPENDENCIES.mmd` — Standalone Mermaid dependency diagram
- `AI_SUMMARY.md` — AI-generated architecture summary (if API key configured)

**Outputs (JSON):**
- `ARCHITECTURE.json` — Structured JSON with files, symbols, imports, import graph, modules, and key symbols

### `trace [dir] [query]`

Trace code flow through a repository using AI. Requires `AI_PROVIDER_API_KEY`.

### `diff [dir]`

Compare two git refs and analyze changes with content-level diffs, symbol tracking, and import analysis.

| Option | Description |
|--------|-------------|
| `--base <ref>` | Base git ref (e.g., `main`) — **required** |
| `--head <ref>` | Head git ref (defaults to `HEAD`) |
| `-o, --output <dir>` | Output directory (defaults to repo root) |

**Outputs:**
- `DIFF.md` — Content-level diff report with unified diffs, symbol additions/removals, and import changes (or AI analysis if API key configured)

### `init [dir]`

Generate a `.repolensrc.json` configuration file with sensible defaults.

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
│   ├── shared/           # Core types, config, errors, logger, token budget
│   ├── context-engine/   # Scanner, cache, symbol extractor, import graph, diff analyzer, JSON output, progress
│   └── ai/               # AI provider factory, remote/local providers, doc generator
├── apps/
│   └── cli/              # CLI with scan, trace, diff, and init commands
├── .github/
│   └── workflows/
│       └── ci.yml        # GitHub Actions CI
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

### Package Dependencies

```
apps/cli
├── @repolens/shared
├── @repolens/context-engine
│   └── @repolens/shared
└── @repolens/ai
    └── @repolens/shared
```

## Ignore Files & Filtering

RepoLens respects `.gitignore` and `.repolensignore` files with full support for:
- Negation patterns (`!pattern` to un-ignore)
- Root anchoring (`/pattern` to match only at root)
- Recursive globbing (`**` to match any depth)

Additionally, generated files are automatically excluded (`.pb.*`, `.gen.*`, `_generated`, `.d.ts`, `.swagger.ts`, etc.).

Use `--ignore-tests` to exclude test files, or `--include`/`--exclude` for fine-grained glob patterns.

## Heuristic File Scoring

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

## AI Provider Strategy

- **LocalAIProvider** — Dev-only provider that simulates streaming without an API key
- **RemoteAIProvider** — Production provider calling OpenAI-compatible `/chat/completions` with SSE streaming
- **Factory pattern** — `createAIProvider(config)` selects based on presence of `aiProviderApiKey`
- **SSRF protection** — HTTPS required, allowlisted domains only (openai.com, openrouter.ai, together.xyz, groq.com, anthropic.com, deepseek.com, localhost), blocked dangerous ports, 120s timeout

## Output Format

### Markdown

Reports are generated in **Markdown** with embedded Mermaid.js diagrams (renderable in GitHub, VS Code, etc.):

- **Overview** — File count, total bytes, languages, entry points
- **Module Map** — Modules with file count, symbol count, and imported-by references
- **Key Symbols** — Top 15 symbols by import count with location
- **Dependency Graph** — Mermaid `graph TD` diagram (package-level or file-level)

### JSON

Use `-f json` for structured output suitable for programmatic consumption:

```json
{
  "version": "0.1.0",
  "summary": { "rootDir": "...", "scannedFiles": 100, "includedFiles": 80, "totalBytes": 120000 },
  "files": [{ "path": "src/index.ts", "language": "typescript", "symbols": [...], "imports": [...] }],
  "importGraph": { "nodes": [...], "packages": [...], "externalDeps": [...] },
  "entryPoints": ["src/index.ts"],
  "modules": [{ "name": "src", "files": [...], "symbolCount": 10 }],
  "keySymbols": [{ "kind": "function", "name": "main", "file": "src/index.ts", "line": 1 }]
}
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
