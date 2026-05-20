import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function parseEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadEnv(metaUrl: string): void {
  let dir: string;
  if (metaUrl.startsWith("file://")) {
    dir = dirname(fileURLToPath(metaUrl));
  } else {
    dir = dirname(metaUrl);
  }
  for (let i = 0; i < 5; i++) {
    const envFile = resolve(dir, ".env");
    if (existsSync(envFile)) {
      parseEnvFile(envFile);
      return;
    }
    dir = resolve(dir, "..");
  }
  parseEnvFile(resolve(process.cwd(), ".env"));
}
