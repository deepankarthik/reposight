# Release Process

## How to Release

Run the interactive release script from the repo root:

```bash
node release.mjs
```

Or preview what would happen without making changes:

```bash
node release.mjs --dry-run
```

The script will:
1. Check that the working directory is clean
2. Show the current version and prompt for bump type (patch/minor/major/prerelease)
3. Display the changelog entries generated from git commits
4. Ask for confirmation
5. Update `apps/cli/package.json` and `apps/github-action/package.json`
6. Prepend entries to `CHANGELOG.md`
7. Commit changes with message `chore: release vX.Y.Z`
8. Create git tag `vX.Y.Z`
9. Push to GitHub (code + tags)

## Publish to npm

After the release script completes, publish the CLI manually:

```bash
cd apps/cli && npm publish --otp=YOUR_CODE
```

This step is manual because npm requires a 2FA one-time password that cannot be scripted.

## GitHub Action Marketplace

The Action is located at `apps/github-action/` and is bundled with the CLI internally.

To list it on the Marketplace:

1. Go to [GitHub Releases](https://github.com/deepankarthik/reposight/releases)
2. Click "Create a new release"
3. Select the tag `vX.Y.Z`
4. Write release notes (copy from CHANGELOG.md)
5. Publish the release

Users reference the Action in their workflows:

```yaml
# Pinned to exact version (recommended)
- uses: deepankarthik/reposight/apps/github-action@v0.1.4

# Auto-updates within 0.x
- uses: deepankarthik/reposight/apps/github-action@v0
```

## How It Works

### CLI Bundle

The CLI is bundled as a **CJS** file (`apps/cli/dist/index.cjs`) using esbuild:

- All dependencies (commander, etc.) are bundled into a single file
- No `node_modules` required at runtime
- Works on Node 18+

```bash
node build-cli.mjs
```

### GitHub Action

The Action bundles the CLI internally during its build step:

```bash
cd apps/github-action && pnpm run build
# Produces: dist/index.js (Action) + dist/reposight-cli.cjs (CLI)
```

The Action runs the CLI via `node reposight-cli.cjs` — **no npm dependency at runtime**. This avoids issues with `npx` pulling stale or broken packages.

### Output

- **Default:** `ARCHITECTURE.json` (always generated)
- **Optional:** `ARCHITECTURE.md` with embedded Mermaid diagram (with `-f markdown`)

## Versioning

- CLI and Action share the **same version number**
- Single git tag (`vX.Y.Z`) covers both
- `CHANGELOG.md` is auto-generated from conventional commit messages
- Commit types map to changelog sections:
  - `feat` → Features
  - `fix` → Bug Fixes
  - `refactor` → Refactoring
  - `docs` → Documentation
  - `chore` → Chores
  - `ci` → CI/CD
  - `build` → Build
  - `perf` → Performance
  - `test` → Tests

## Troubleshooting

### "Dynamic require of 'commander' is not supported"

**Cause:** The CLI was bundled as ESM but `commander` uses CommonJS internally. ESM doesn't support dynamic `require()`.

**Fix:** Bundle as CJS format. The build script (`build-cli.mjs`) uses `format: "cjs"` and outputs to `index.cjs`.

### "Cannot find package 'commander'"

**Cause:** `commander` was listed in esbuild's `external` array, so it wasn't bundled into the output file.

**Fix:** Remove `commander` from the `external` list so it gets bundled. The CLI must be fully self-contained since the Action runs it in an environment without `node_modules`.

### "__dirname is not defined"

**Cause:** `__dirname` doesn't exist in ESM modules. The Action's `dist/index.js` runs as ESM (ncc output format).

**Fix:** Define it using `import.meta.url`:
```typescript
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
```

### "npx failed with exit code 1"

**Cause:** `npx` pulls packages from npm, which may be stale, broken, or have incorrect `bin` entries.

**Fix:** Bundle the CLI inside the Action and run it directly via `node`. The Action's build script copies `index.cjs` to `dist/reposight-cli.cjs` and the Action runs it as a local file.

### Progress output showing as errors in GitHub Actions

**Cause:** The CLI writes progress to stderr (`process.stderr.write('\rScanning...')`). If the Action captures stderr and passes it to `core.error()`, GitHub interprets every progress line as an error annotation.

**Fix:** Don't capture stderr in the Action. Let `exec.exec()` handle stdout/stderr naturally. Only check the exit code.

### "Invalid URL" from loadEnv

**Cause:** `loadEnv()` receives `__filename` (a file path) instead of `import.meta.url` (a `file://` URL). The function tried to call `fileURLToPath()` on a non-URL string.

**Fix:** Check if the input starts with `file://` before calling `fileURLToPath()`:
```typescript
if (metaUrl.startsWith("file://")) {
  dir = dirname(fileURLToPath(metaUrl));
} else {
  dir = dirname(metaUrl);
}
```

### Duplicate shebang lines in bundle

**Cause:** The source file (`index.ts`) had `#!/usr/bin/env node` at the top, and esbuild's `banner` option also added one.

**Fix:** Remove the shebang from the source file. Let the build script add it via `banner: { js: "#!/usr/bin/env node" }`.
