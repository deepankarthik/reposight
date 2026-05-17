import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, "apps/cli/package.json");
const backupPath = join(__dirname, "apps/cli/package.json.bak");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

// Save original for postpublish restore
writeFileSync(backupPath, JSON.stringify(pkg, null, 2) + "\n");

// Create npm-safe package.json (no workspace deps)
const publishPkg = {
  ...pkg,
  dependencies: {
    commander: pkg.dependencies.commander,
    typescript: pkg.dependencies.typescript
  }
};
// Remove workspace scripts, keep only build
publishPkg.scripts = {
  build: "node build-cli.mjs"
};

writeFileSync(pkgPath, JSON.stringify(publishPkg, null, 2) + "\n");
console.log("Prepared package.json for npm publishing");
