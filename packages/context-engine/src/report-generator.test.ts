import { describe, it, expect } from "vitest";
import { generateArchitectureReport } from "./report-generator.js";
import type { RepositoryContext } from "@reposight/shared";

function makeContext(overrides?: Partial<RepositoryContext>): RepositoryContext {
  return {
    rootDir: "/test/repo",
    files: [
      {
        path: "src/index.ts",
        absolutePath: "/test/repo/src/index.ts",
        language: "typescript",
        content: "export function main() {}",
        size: 25,
        symbols: [{ name: "main", kind: "function", line: 1 }],
        imports: ["./utils"]
      },
      {
        path: "src/utils.ts",
        absolutePath: "/test/repo/src/utils.ts",
        language: "typescript",
        content: "export function helper() {}",
        size: 28,
        symbols: [{ name: "helper", kind: "function", line: 1 }],
        imports: []
      }
    ],
    chunks: [],
    summary: {
      scannedFiles: 2,
      includedFiles: 2,
      totalBytes: 53,
      truncated: false,
      skippedFiles: 0
    },
    ...overrides
  };
}

describe("generateArchitectureReport", () => {
  it("should generate a markdown report", () => {
    const context = makeContext();
    const report = generateArchitectureReport(context);
    expect(report).toContain("# Architecture: repo");
    expect(report).toContain("## Overview");
    expect(report).toContain("## Module Map");
    expect(report).toContain("## Key Symbols");
  });

  it("should include Mermaid diagram by default", () => {
    const context = makeContext();
    const report = generateArchitectureReport(context);
    expect(report).toContain("```mermaid");
  });

  it("should skip Mermaid when includeMermaid is false", () => {
    const context = makeContext();
    const report = generateArchitectureReport(context, { includeMermaid: false });
    expect(report).not.toContain("```mermaid");
  });

  it("should show file-level graph when requested", () => {
    const context = makeContext();
    const report = generateArchitectureReport(context, { fileLevelGraph: true });
    expect(report).toContain("src/index.ts");
  });

  it("should include importedBy counts when importGraph is provided", () => {
    const context = makeContext();
    const importGraph = {
      nodes: new Map([
        [
          "/test/repo/src/utils.ts",
          {
            absolutePath: "/test/repo/src/utils.ts",
            relativePath: "src/utils.ts",
            imports: [],
            importedBy: ["/test/repo/src/index.ts"],
            importCount: 1
          }
        ],
        [
          "/test/repo/src/index.ts",
          {
            absolutePath: "/test/repo/src/index.ts",
            relativePath: "src/index.ts",
            imports: ["./utils"],
            importedBy: [],
            importCount: 0
          }
        ]
      ]),
      packages: new Map(),
      externalDeps: new Set<string>()
    };
    const report = generateArchitectureReport(context, { importGraph });
    expect(report).toContain("1");
  });
});
