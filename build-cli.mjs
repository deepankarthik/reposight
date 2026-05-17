import { build } from "esbuild";
import { writeFileSync, chmodSync } from "node:fs";

const nodeBuiltins = [
  "fs", "path", "os", "crypto", "stream", "util", "events",
  "http", "https", "net", "dns", "url", "querystring", "zlib",
  "buffer", "child_process", "readline", "tty", "string_decoder",
  "constants", "assert", "perf_hooks", "async_hooks", "inspector",
  "module", "process", "timers", "console", "v8", "vm", "worker_threads"
];

await build({
  entryPoints: ["apps/cli/src/index.ts"],
  bundle: true,
  outfile: "apps/cli/dist/bundle.mjs",
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

writeFileSync("apps/cli/dist/index.js", wrapper);
chmodSync("apps/cli/dist/index.js", 0o755);

console.log("Bundle created at apps/cli/dist/bundle.mjs");
