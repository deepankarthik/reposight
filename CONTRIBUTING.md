# Contributing

## Getting Started

```bash
pnpm install
pnpm run build
pnpm test
```

## Project Structure

```
reposight/
├── packages/
│   ├── shared/           # Core types, config, errors, logger
│   ├── context-engine/   # Scanner, symbol extractor, import graph
│   └── ai/               # AI provider (local + remote)
├── apps/
│   ├── cli/              # CLI: scan, diff, trace, init, explorer, serve
│   ├── web/              # Interactive Explorer (single-file HTML)
│   └── github-action/    # GitHub Action
```

## Running the CLI During Development

```bash
pnpm dev:cli scan .
```

## Testing

```bash
# Run all tests
pnpm test

# Run a single test file
pnpm vitest run packages/context-engine/src/ignore.test.ts
```

## Code Style

- TypeScript with strict mode enabled
- ES modules (`import`/`export`)
- No semicolons
- 2-space indentation
- `camelCase` for variables and functions
- `PascalCase` for types and classes

Before submitting a PR, ensure:
- `pnpm run typecheck` passes
- `pnpm test` passes
- New features include tests

## Adding a New Language Scanner

1. Add a file extension matcher in `packages/context-engine/src/symbol-extractor.ts`
2. Implement `extractFunctions` and `extractClasses` for the language
3. Add test fixtures and update `symbol-extractor.test.ts`

## Pull Request Process

1. Keep changes focused — one feature or fix per PR
2. Write a clear commit message describing what and why
3. Reference any related issues
