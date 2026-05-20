import { build } from "esbuild";
import { writeFileSync, chmodSync, copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const nodeBuiltins = [
  "fs", "path", "os", "crypto", "stream", "util", "events",
  "http", "https", "net", "dns", "url", "querystring", "zlib",
  "buffer", "child_process", "readline", "tty", "string_decoder",
  "constants", "assert", "perf_hooks", "async_hooks", "inspector",
  "module", "process", "timers", "console", "v8", "vm", "worker_threads"
];

await build({
  entryPoints: [join(__dirname, "apps/cli/src/index.ts")],
  bundle: true,
  outfile: join(__dirname, "apps/cli/dist/bundle.mjs"),
  platform: "node",
  target: "node18",
  format: "esm",
  external: [...nodeBuiltins, "commander", "typescript"],
  sourcemap: false,
  minify: false,
  define: {
    "process.env.NODE_ENV": '"production"'
  }
});

const wrapper = `#!/usr/bin/env node
import "./bundle.mjs";
`;

mkdirSync(join(__dirname, "apps/cli/dist"), { recursive: true });
chmodSync(join(__dirname, "apps/cli/dist/bundle.mjs"), 0o755);
writeFileSync(join(__dirname, "apps/cli/dist/index.js"), wrapper);
chmodSync(join(__dirname, "apps/cli/dist/index.js"), 0o755);
copyFileSync(join(__dirname, "apps/web/public/index.html"), join(__dirname, "apps/cli/dist/index.html"));

console.log("Bundle created at apps/cli/dist/bundle.mjs");
console.log("Explorer UI copied to apps/cli/dist/index.html");
