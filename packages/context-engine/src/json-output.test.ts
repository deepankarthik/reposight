import { describe, it, expect } from "vitest";
import { generateJsonReport } from "./json-output.js";
import type { RepositoryContext, ContextFile } from "@reposight/shared";

function makeContext(overrides: Partial<RepositoryContext> = {}): RepositoryContext {
  return {
    rootDir: "/test/repo",
    files: [
      {
        path: "src/index.ts",
        absolutePath: "/test/repo/src/index.ts",
        language: "typescript",
        content: "export function main() {}",
        size: 28,
        symbols: [{ name: "main", kind: "function", line: 1 }],
        imports: ["./utils"]
      },
      {
        path: "src/utils.ts",
        absolutePath: "/test/repo/src/utils.ts",
        language: "typescript",
        content: "export function helper() {}",
        size: 30,
        symbols: [{ name: "helper", kind: "function", line: 1 }],
        imports: []
      }
    ],
    chunks: [],
    summary: {
      scannedFiles: 10,
      includedFiles: 2,
      totalBytes: 58,
      truncated: false,
      skippedFiles: 8,
      cacheHits: 0,
      cacheMisses: 2
    },
    importGraph: {
      nodes: new Map([
        [
          "/test/repo/src/index.ts",
          {
            absolutePath: "/test/repo/src/index.ts",
            relativePath: "src/index.ts",
            imports: ["./utils"],
            importedBy: [],
            importCount: 0
          }
        ],
        [
          "/test/repo/src/utils.ts",
          {
            absolutePath: "/test/repo/src/utils.ts",
            relativePath: "src/utils.ts",
            imports: [],
            importedBy: ["/test/repo/src/index.ts"],
            importCount: 1
          }
        ]
      ]),
      packages: new Map(),
      externalDeps: new Set<string>()
    },
    ...overrides
  };
}

describe("generateJsonReport", () => {
  it("generates valid JSON structure", () => {
    const context = makeContext();
    const report = generateJsonReport(context);

    expect(report.version).toBe("0.1.0");
    expect(report.summary.rootDir).toBe("/test/repo");
    expect(report.summary.includedFiles).toBe(2);
    expect(report.summary.totalBytes).toBe(58);
  });

  it("includes file entries with symbols and imports", () => {
    const context = makeContext();
    const report = generateJsonReport(context);

    expect(report.files).toHaveLength(2);
    expect(report.files[0].path).toBe("src/index.ts");
    expect(report.files[0].symbols).toHaveLength(1);
    expect(report.files[0].imports).toContain("./utils");
  });

  it("excludes content by default", () => {
    const context = makeContext();
    const report = generateJsonReport(context);

    expect(report.files[0].content).toBe("");
    expect(report.files[1].content).toBe("");
  });

  it("includes content when requested", () => {
    const context = makeContext();
    const report = generateJsonReport(context, true);

    expect(report.files[0].content).toBe("export function main() {}");
    expect(report.files[1].content).toBe("export function helper() {}");
  });

  it("includes importGraph nodes", () => {
    const context = makeContext();
    const report = generateJsonReport(context);

    expect(report.importGraph.nodes).toHaveLength(2);
    const utilsNode = report.importGraph.nodes.find((n) => n.path === "src/utils.ts");
    expect(utilsNode?.importCount).toBe(1);
    expect(utilsNode?.importedBy).toContain("src/index.ts");
  });

  it("includes entry points", () => {
    const context = makeContext();
    const report = generateJsonReport(context);

    expect(report.entryPoints).toContain("src/index.ts");
  });

  it("includes modules", () => {
    const context = makeContext();
    const report = generateJsonReport(context);

    expect(report.modules.length).toBeGreaterThan(0);
    expect(report.modules[0].files.length).toBeGreaterThan(0);
    expect(report.modules.reduce((sum, m) => sum + m.symbolCount, 0)).toBe(2);
  });

  it("includes key symbols sorted by import count", () => {
    const context = makeContext();
    const report = generateJsonReport(context);

    expect(report.keySymbols.length).toBeGreaterThan(0);
    const helperSymbol = report.keySymbols.find((s) => s.name === "helper");
    expect(helperSymbol?.importedBy).toBe(1);
  });

  it("limits key symbols to 15", () => {
    const files: ContextFile[] = Array.from({ length: 20 }, (_, i) => ({
      path: `src/file${i}.ts`,
      absolutePath: `/test/repo/src/file${i}.ts`,
      language: "typescript",
      content: `export function func${i}() {}`,
      size: 30,
      symbols: [{ name: `func${i}`, kind: "function" as const, line: 1 }],
      imports: []
    }));

    const context = makeContext({ files });
    const report = generateJsonReport(context);

    expect(report.keySymbols.length).toBeLessThanOrEqual(15);
  });

  it("handles missing import graph", () => {
    const context = makeContext({ importGraph: undefined });
    const report = generateJsonReport(context);

    expect(report.importGraph.nodes).toHaveLength(0);
    expect(report.importGraph.packages).toHaveLength(0);
    expect(report.importGraph.externalDeps).toHaveLength(0);
  });

  it("includes external dependencies", () => {
    const context = makeContext({
      importGraph: {
        nodes: new Map(),
        packages: new Map(),
        externalDeps: new Set(["lodash", "express"])
      }
    });
    const report = generateJsonReport(context);

    expect(report.importGraph.externalDeps).toContain("lodash");
    expect(report.importGraph.externalDeps).toContain("express");
  });

  it("includes package information", () => {
    const context = makeContext({
      importGraph: {
        nodes: new Map(),
        packages: new Map([
          ["@repo/shared", { name: "@repo/shared", location: "/test/repo/packages/shared", dependencies: ["lodash"] }]
        ]),
        externalDeps: new Set<string>()
      }
    });
    const report = generateJsonReport(context);

    expect(report.importGraph.packages).toHaveLength(1);
    expect(report.importGraph.packages[0].name).toBe("@repo/shared");
    expect(report.importGraph.packages[0].dependencies).toContain("lodash");
  });

  it("serializes to valid JSON", () => {
    const context = makeContext();
    const report = generateJsonReport(context);
    const json = JSON.stringify(report);

    expect(() => JSON.parse(json)).not.toThrow();
  });
});
