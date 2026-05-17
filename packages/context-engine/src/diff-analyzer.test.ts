import { describe, it, expect } from "vitest";
import { computeSymbolDiff, computeImportDiff, formatDiffReport } from "./diff-analyzer.js";

describe("computeSymbolDiff", () => {
  it("detects added symbols", () => {
    const oldSymbols = [{ name: "foo", kind: "function" }];
    const newSymbols = [{ name: "foo", kind: "function" }, { name: "bar", kind: "function" }];

    const result = computeSymbolDiff(oldSymbols, newSymbols);
    expect(result.added).toEqual([{ name: "bar", kind: "function" }]);
    expect(result.removed).toEqual([]);
  });

  it("detects removed symbols", () => {
    const oldSymbols = [{ name: "foo", kind: "function" }, { name: "bar", kind: "function" }];
    const newSymbols = [{ name: "foo", kind: "function" }];

    const result = computeSymbolDiff(oldSymbols, newSymbols);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([{ name: "bar", kind: "function" }]);
  });

  it("detects both added and removed symbols", () => {
    const oldSymbols = [{ name: "foo", kind: "function" }];
    const newSymbols = [{ name: "bar", kind: "function" }];

    const result = computeSymbolDiff(oldSymbols, newSymbols);
    expect(result.added).toEqual([{ name: "bar", kind: "function" }]);
    expect(result.removed).toEqual([{ name: "foo", kind: "function" }]);
  });

  it("distinguishes symbols by kind", () => {
    const oldSymbols = [{ name: "foo", kind: "function" }];
    const newSymbols = [{ name: "foo", kind: "class" }];

    const result = computeSymbolDiff(oldSymbols, newSymbols);
    expect(result.added).toEqual([{ name: "foo", kind: "class" }]);
    expect(result.removed).toEqual([{ name: "foo", kind: "function" }]);
  });

  it("returns empty for identical symbol sets", () => {
    const symbols = [{ name: "foo", kind: "function" }, { name: "bar", kind: "class" }];
    const result = computeSymbolDiff(symbols, symbols);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });
});

describe("computeImportDiff", () => {
  it("detects added imports", () => {
    const result = computeImportDiff(["./foo"], ["./foo", "./bar"]);
    expect(result.added).toEqual(["./bar"]);
    expect(result.removed).toEqual([]);
  });

  it("detects removed imports", () => {
    const result = computeImportDiff(["./foo", "./bar"], ["./foo"]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual(["./bar"]);
  });

  it("handles completely different import sets", () => {
    const result = computeImportDiff(["./old"], ["./new"]);
    expect(result.added).toEqual(["./new"]);
    expect(result.removed).toEqual(["./old"]);
  });

  it("handles empty import sets", () => {
    const result = computeImportDiff([], ["./new"]);
    expect(result.added).toEqual(["./new"]);
    expect(result.removed).toEqual([]);
  });

  it("deduplicates imports", () => {
    const result = computeImportDiff(["./foo", "./foo"], ["./foo", "./bar", "./bar"]);
    expect(result.added).toEqual(["./bar"]);
    expect(result.removed).toEqual([]);
  });
});

describe("formatDiffReport", () => {
  it("formats summary correctly", () => {
    const diff = {
      files: [],
      summary: { added: 2, removed: 1, modified: 3, totalSymbolAdditions: 5, totalSymbolRemovals: 2, totalImportAdditions: 3, totalImportRemovals: 1 }
    };

    const report = formatDiffReport(diff, "main", "feature");
    expect(report).toContain("# Diff: main → feature");
    expect(report).toContain("- Added: 2 files");
    expect(report).toContain("- Removed: 1 files");
    expect(report).toContain("- Modified: 3 files");
    expect(report).toContain("- Symbol additions: 5");
    expect(report).toContain("- Symbol removals: 2");
  });

  it("formats added files", () => {
    const diff = {
      files: [{ path: "src/new.ts", status: "added" as const, newSymbols: [{ name: "newFunc", kind: "function", line: 1 }], newImports: ["./utils"] }],
      summary: { added: 1, removed: 0, modified: 0, totalSymbolAdditions: 1, totalSymbolRemovals: 0, totalImportAdditions: 1, totalImportRemovals: 0 }
    };

    const report = formatDiffReport(diff, "main", "feature");
    expect(report).toContain("+ `src/new.ts`");
    expect(report).toContain("function `newFunc`");
    expect(report).toContain("`./utils`");
  });

  it("formats removed files", () => {
    const diff = {
      files: [{ path: "src/old.ts", status: "removed" as const, oldSymbols: [{ name: "oldFunc", kind: "function", line: 1 }], oldImports: ["./utils"] }],
      summary: { added: 0, removed: 1, modified: 0, totalSymbolAdditions: 0, totalSymbolRemovals: 1, totalImportAdditions: 0, totalImportRemovals: 1 }
    };

    const report = formatDiffReport(diff, "main", "feature");
    expect(report).toContain("- `src/old.ts`");
    expect(report).toContain("function `oldFunc`");
  });

  it("formats modified files with hunks", () => {
    const diff = {
      files: [{
        path: "src/modified.ts",
        status: "modified" as const,
        oldSymbols: [{ name: "foo", kind: "function", line: 1 }],
        newSymbols: [{ name: "foo", kind: "function", line: 1 }, { name: "bar", kind: "function", line: 5 }],
        oldImports: ["./a"],
        newImports: ["./a", "./b"],
        hunks: [{ oldStart: 1, oldLines: 3, newStart: 1, newLines: 4, lines: [" existing", "-removed", "+added", " existing"] }]
      }],
      summary: { added: 0, removed: 0, modified: 1, totalSymbolAdditions: 1, totalSymbolRemovals: 0, totalImportAdditions: 1, totalImportRemovals: 0 }
    };

    const report = formatDiffReport(diff, "main", "feature");
    expect(report).toContain("~ `src/modified.ts`");
    expect(report).toContain("```diff");
    expect(report).toContain("+added");
    expect(report).toContain("-removed");
    expect(report).toContain("function `bar`");
    expect(report).toContain("`./b`");
  });

  it("truncates hunks over 10", () => {
    const hunks = Array.from({ length: 15 }, (_, i) => ({
      oldStart: i * 10 + 1, oldLines: 5, newStart: i * 10 + 1, newLines: 5, lines: [" line"]
    }));

    const diff = {
      files: [{ path: "src/big.ts", status: "modified" as const, hunks }],
      summary: { added: 0, removed: 0, modified: 1, totalSymbolAdditions: 0, totalSymbolRemovals: 0, totalImportAdditions: 0, totalImportRemovals: 0 }
    };

    const report = formatDiffReport(diff, "main", "feature");
    expect(report).toContain("... and 5 more hunks");
  });

  it("truncates symbol lists over 10", () => {
    const symbols = Array.from({ length: 15 }, (_, i) => ({ name: `func${i}`, kind: "function", line: i + 1 }));

    const diff = {
      files: [{
        path: "src/symbols.ts",
        status: "modified" as const,
        oldSymbols: [],
        newSymbols: symbols,
        oldImports: [],
        newImports: []
      }],
      summary: { added: 0, removed: 0, modified: 1, totalSymbolAdditions: 15, totalSymbolRemovals: 0, totalImportAdditions: 0, totalImportRemovals: 0 }
    };

    const report = formatDiffReport(diff, "main", "feature");
    expect(report).toContain("... and 5 more");
  });
});
