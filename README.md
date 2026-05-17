# RepoLens

> Generate living documentation from codebases — architecture maps, dependency graphs, and data flow traces.

## Overview

RepoLens is a CLI tool that scans a repository, extracts context (files, symbols, imports), scores files heuristically, and produces Markdown reports with Mermaid.js diagrams. An optional AI provider can generate architecture summaries and trace explanations.

## Features

- **Architecture Reports** — Markdown reports with Overview, Module Map, Key Symbols, and Mermaid dependency graphs
- **Heuristic File Scoring** — Prioritizes important files using import graphs, git recency, test pairing, and directory proximity
- **File Caching** — In-memory LRU cache with mtime-based invalidation for fast repeated scans
- **Multi-language Support** — TypeScript/JavaScript symbol extraction via AST; Python support via regex patterns
- **AI Integration** — Optional AI-generated architecture summaries, code flow tracing, and diff analysis
- **SSRF Protection** — Remote AI provider validates URLs against allowlisted domains and blocked ports

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Scan a repository
pnpm dev:cli scan /path/to/repo

# Scan with output directory
pnpm dev:cli scan /path/to/repo -o ./docs

# Scan with file-level dependency graph
pnpm dev:cli scan /path/to/repo --file-level

# Trace code flow (requires AI API key)
pnpm dev:cli trace /path/to/repo "how does authentication work?"

# Compare two git refs
pnpm dev:cli diff /path/to/repo --base main --head feature-branch
```

## Commands

### `scan <dir>`

Scan a repository and generate architecture documentation.

| Option | Description |
|--------|-------------|
| `-o, --output <dir>` | Output directory (defaults to repo root) |
| `--no-mermaid` | Skip Mermaid diagram generation |
| `--no-ai` | Skip AI-generated summary |
| `--file-level` | Generate file-level dependency graph instead of package-level |

**Outputs:**
- `ARCHITECTURE.md` — Full architecture report
- `DEPENDENCIES.mmd` — Standalone Mermaid dependency diagram
- `AI_SUMMARY.md` — AI-generated architecture summary (if API key configured)

### `trace <dir> <query>`

Trace code flow through a repository using AI. Requires `AI_PROVIDER_API_KEY`.

### `diff <dir>`

Compare two git refs and analyze changes.

| Option | Description |
|--------|-------------|
| `--base <ref>` | Base git ref (e.g., `main`) — **required** |
| `--head <ref>` | Head git ref (defaults to `HEAD`) |
| `-o, --output <dir>` | Output directory (defaults to repo root) |

**Outputs:**
- `DIFF.md` — Structural diff report (or AI analysis if API key configured)

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
| `REPOLENS_OUTPUT_FORMAT` | `markdown` | `markdown` or `json` |
| `REPOLENS_INCLUDE_MERMAID` | `true` | Include Mermaid diagrams |

## Project Structure

```
repolens/
├── packages/
│   ├── shared/           # Core types, config, errors, logger, token budget
│   ├── context-engine/   # Scanner, cache, symbol extractor, import graph, report generator
│   └── ai/               # AI provider factory, remote/local providers, doc generator
├── apps/
│   └── cli/              # CLI with scan, trace, and diff commands
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

Reports are generated in **Markdown** with embedded Mermaid.js diagrams (renderable in GitHub, VS Code, etc.):

- **Overview** — File count, total bytes, languages, entry points
- **Module Map** — Modules with file count, symbol count, and imported-by references
- **Key Symbols** — Top 15 symbols by import count with location
- **Dependency Graph** — Mermaid `graph TD` diagram (package-level or file-level)

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
