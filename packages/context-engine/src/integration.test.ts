import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { scanRepository, FileCache, generateArchitectureReport, generateJsonReport } from "@repolens/context-engine";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "repolens-integration-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function writeTestProject() {
  await fs.mkdir(path.join(tmpDir, "src"), { recursive: true });
  await fs.mkdir(path.join(tmpDir, "src", "utils"), { recursive: true });
  await fs.mkdir(path.join(tmpDir, "lib"), { recursive: true });

  await fs.writeFile(path.join(tmpDir, "package.json"), JSON.stringify({ name: "test-project", version: "1.0.0" }));

  await fs.writeFile(path.join(tmpDir, "src", "index.ts"), `
import { helper } from "./utils/helper";
import { calculate } from "./utils/math";

export function main() {
  const result = helper();
  return calculate(result);
}
`);

  await fs.writeFile(path.join(tmpDir, "src", "utils", "helper.ts"), `
export function helper(): string {
  return "hello";
}
`);

  await fs.writeFile(path.join(tmpDir, "src", "utils", "math.ts"), `
export function calculate(input: string): number {
  return input.length;
}
`);

  await fs.writeFile(path.join(tmpDir, "src", "types.ts"), `
export interface Config {
  name: string;
  value: number;
}
`);

  await fs.writeFile(path.join(tmpDir, "lib", "core.py"), `
class CoreProcessor:
    def __init__(self):
        self.data = []

    def process(self, item):
        self.data.append(item)
        return len(self.data)
`);

  await fs.writeFile(path.join(tmpDir, "README.md"), "# Test Project\n\nA sample project for testing.");

  await fs.mkdir(path.join(tmpDir, "node_modules"), { recursive: true });
  await fs.writeFile(path.join(tmpDir, "node_modules", "lodash.js"), "// minified");
}

describe("Integration: scan repository", () => {
  beforeEach(async () => {
    await writeTestProject();
  });

  it("discovers and scans files correctly", async () => {
    const cache = new FileCache();
    const context = await scanRepository({ rootDir: tmpDir }, cache);

    expect(context.summary.scannedFiles).toBeGreaterThan(0);
    expect(context.summary.includedFiles).toBeGreaterThan(0);
    expect(context.summary.totalBytes).toBeGreaterThan(0);
  });

  it("excludes node_modules", async () => {
    const cache = new FileCache();
    const context = await scanRepository({ rootDir: tmpDir }, cache);

    const hasNodeModules = context.files.some((f) => f.path.includes("node_modules"));
    expect(hasNodeModules).toBe(false);
  });

  it("extracts TypeScript symbols", async () => {
    const cache = new FileCache();
    const context = await scanRepository({ rootDir: tmpDir }, cache);

    const indexFile = context.files.find((f) => f.path === "src/index.ts");
    expect(indexFile).toBeDefined();
    expect(indexFile?.symbols?.some((s) => s.name === "main")).toBe(true);
  });

  it("extracts TypeScript imports", async () => {
    const cache = new FileCache();
    const context = await scanRepository({ rootDir: tmpDir }, cache);

    const indexFile = context.files.find((f) => f.path === "src/index.ts");
    expect(indexFile?.imports).toContain("./utils/helper");
    expect(indexFile?.imports).toContain("./utils/math");
  });

  it("extracts Python symbols", async () => {
    const cache = new FileCache();
    const context = await scanRepository({ rootDir: tmpDir }, cache);

    const pyFile = context.files.find((f) => f.path === "lib/core.py");
    expect(pyFile).toBeDefined();
    expect(pyFile?.symbols?.some((s) => s.name === "CoreProcessor")).toBe(true);
    expect(pyFile?.symbols?.some((s) => s.name === "process")).toBe(true);
  });

  it("generates valid Markdown report", () => {
    const cache = new FileCache();
    const context = scanRepository({ rootDir: tmpDir }, cache);

    context.then((ctx) => {
      const report = generateArchitectureReport(ctx, { includeMermaid: true });
      expect(report).toContain("# Architecture:");
      expect(report).toContain("## Overview");
      expect(report).toContain("## Module Map");
      expect(report).toContain("```mermaid");
    });
  });

  it("generates valid JSON report", async () => {
    const cache = new FileCache();
    const context = await scanRepository({ rootDir: tmpDir }, cache);

    const jsonReport = generateJsonReport(context);
    expect(jsonReport.version).toBe("0.1.0");
    expect(jsonReport.summary.includedFiles).toBeGreaterThan(0);
    expect(jsonReport.files.length).toBeGreaterThan(0);

    const serialized = JSON.stringify(jsonReport);
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  it("respects maxFiles limit", async () => {
    const cache = new FileCache();
    const context = await scanRepository({ rootDir: tmpDir, maxFiles: 2 }, cache);

    expect(context.summary.includedFiles).toBeLessThanOrEqual(2);
  });

  it("respects maxBytes limit", async () => {
    const cache = new FileCache();
    const context = await scanRepository({ rootDir: tmpDir, maxBytes: 500 }, cache);

    expect(context.summary.totalBytes).toBeLessThanOrEqual(500);
  });

  it("builds import graph with nodes", async () => {
    const cache = new FileCache();
    const context = await scanRepository({ rootDir: tmpDir }, cache);

    expect(context.importGraph.nodes.size).toBeGreaterThan(0);
  });

  it("tracks external dependencies", async () => {
    const cache = new FileCache();
    const context = await scanRepository({ rootDir: tmpDir }, cache);

    expect(context.importGraph.externalDeps).toBeDefined();
  });

  it("handles --ignore-tests flag", async () => {
    await fs.writeFile(path.join(tmpDir, "src", "index.test.ts"), `
import { main } from "./index";
test("main works", () => { expect(main()).toBeDefined(); });
`);

    const cacheWithTests = new FileCache();
    const contextWithTests = await scanRepository({ rootDir: tmpDir }, cacheWithTests);
    const hasTestFile = contextWithTests.files.some((f) => f.path.includes(".test."));

    const cacheWithoutTests = new FileCache();
    const contextWithoutTests = await scanRepository({ rootDir: tmpDir, ignoreTests: true }, cacheWithoutTests);
    const hasTestFileIgnored = contextWithoutTests.files.some((f) => f.path.includes(".test."));

    expect(hasTestFile).toBe(true);
    expect(hasTestFileIgnored).toBe(false);
  });

  it("handles --include patterns", async () => {
    const cache = new FileCache();
    const context = await scanRepository({ rootDir: tmpDir, include: ["src/**/*.ts"] }, cache);

    const allInSrc = context.files.every((f) => f.path.startsWith("src/"));
    expect(allInSrc).toBe(true);
  });

  it("handles --exclude patterns", async () => {
    const cache = new FileCache();
    const context = await scanRepository({ rootDir: tmpDir, exclude: ["**/*.py"] }, cache);

    const hasPython = context.files.some((f) => f.path.endsWith(".py"));
    expect(hasPython).toBe(false);
  });

  it("provides progress callbacks", async () => {
    const phases: string[] = [];
    const cache = new FileCache();

    await scanRepository({
      rootDir: tmpDir,
      onProgress: (progress) => {
        phases.push(progress.phase);
      }
    }, cache);

    expect(phases).toContain("scoring");
    expect(phases).toContain("reading");
    expect(phases).toContain("complete");
  });

  it("caches file reads", async () => {
    const cache = new FileCache();

    const first = await scanRepository({ rootDir: tmpDir }, cache);
    expect(first.summary.cacheMisses).toBeGreaterThan(0);

    const second = await scanRepository({ rootDir: tmpDir }, cache);
    expect(second.summary.cacheHits).toBeGreaterThan(0);
  });
});
