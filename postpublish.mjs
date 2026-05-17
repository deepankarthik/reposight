import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, "apps/cli/package.json");
const backupPath = join(__dirname, "apps/cli/package.json.bak");

if (existsSync(backupPath)) {
  const original = readFileSync(backupPath, "utf8");
  writeFileSync(pkgPath, original);
  unlinkSync(backupPath);
  console.log("Restored original package.json");
}
