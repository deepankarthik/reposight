import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function loadEnv(metaUrl: string): void {
  let dir = dirname(fileURLToPath(metaUrl));
  for (let i = 0; i < 5; i++) {
    const envFile = resolve(dir, ".env");
    if (existsSync(envFile)) {
      config({ path: envFile });
      return;
    }
    dir = resolve(dir, "..");
  }
  config();
}
