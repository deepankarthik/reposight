import { describe, it, expect } from "vitest";
import { buildSymbolCrossReference, getTopReferencedSymbols, getSymbolDependencies } from "./symbol-crossref.js";
import type { CodeSymbol } from "@repolens/shared";

describe("buildSymbolCrossReference", () => {
  it("creates entries for all symbols", () => {
    const files: Array<{ path: string; symbols: CodeSymbol[]; imports: string[]; content: string }> = [
      { path: "a.ts", symbols: [{ name: "foo", kind: "function", line: 1 }], imports: [], content: "" },
      { path: "b.ts", symbols: [{ name: "bar", kind: "function", line: 1 }], imports: [], content: "" }
    ];

    const crossRef = buildSymbolCrossReference(files);
    expect(crossRef.symbols.size).toBe(2);
  });

  it("tracks import references", () => {
    const files: Array<{ path: string; symbols: CodeSymbol[]; imports: string[]; content: string }> = [
      { path: "a.ts", symbols: [{ name: "foo", kind: "function", line: 1 }], imports: ["b.ts"], content: "" },
      { path: "b.ts", symbols: [{ name: "bar", kind: "function", line: 1 }], imports: [], content: "" }
    ];

    const crossRef = buildSymbolCrossReference(files);
    expect(crossRef.references.length).toBeGreaterThan(0);
  });

  it("tracks symbol usage references", () => {
    const files: Array<{ path: string; symbols: CodeSymbol[]; imports: string[]; content: string }> = [
      { path: "a.ts", symbols: [{ name: "foo", kind: "function", line: 1 }], imports: [], content: "foo()" },
      { path: "b.ts", symbols: [{ name: "foo", kind: "function", line: 1 }], imports: [], content: "" }
    ];

    const crossRef = buildSymbolCrossReference(files);
    const refs = crossRef.references.filter((r) => r.kind === "usage");
    expect(refs.length).toBeGreaterThan(0);
  });

  it("does not create self-references", () => {
    const files: Array<{ path: string; symbols: CodeSymbol[]; imports: string[]; content: string }> = [
      { path: "a.ts", symbols: [{ name: "foo", kind: "function", line: 1 }], imports: [], content: "foo()" }
    ];

    const crossRef = buildSymbolCrossReference(files);
    const selfRefs = crossRef.references.filter((r) => r.fromFile === r.toFile);
    expect(selfRefs.length).toBe(0);
  });
});

describe("getTopReferencedSymbols", () => {
  it("returns symbols sorted by reference count", () => {
    const files: Array<{ path: string; symbols: CodeSymbol[]; imports: string[]; content: string }> = [
      { path: "a.ts", symbols: [{ name: "popular", kind: "function", line: 1 }], imports: [], content: "" },
      { path: "b.ts", symbols: [{ name: "popular", kind: "function", line: 1 }], imports: [], content: "" },
      { path: "c.ts", symbols: [{ name: "popular", kind: "function", line: 1 }], imports: [], content: "" },
      { path: "d.ts", symbols: [{ name: "rare", kind: "function", line: 1 }], imports: [], content: "" }
    ];

    const crossRef = buildSymbolCrossReference(files);
    const top = getTopReferencedSymbols(crossRef, 5);

    expect(top.length).toBeGreaterThan(0);
    expect(top[0].referenceCount).toBeGreaterThanOrEqual(top[top.length - 1].referenceCount);
  });

  it("respects the limit parameter", () => {
    const files: Array<{ path: string; symbols: CodeSymbol[]; imports: string[]; content: string }> = Array.from({ length: 10 }, (_, i) => ({
      path: `file${i}.ts`,
      symbols: [{ name: `func${i}`, kind: "function", line: 1 }],
      imports: [],
      content: ""
    }));

    const crossRef = buildSymbolCrossReference(files);
    const top = getTopReferencedSymbols(crossRef, 3);

    expect(top.length).toBeLessThanOrEqual(3);
  });
});

describe("getSymbolDependencies", () => {
  it("returns references for a symbol", () => {
    const files: Array<{ path: string; symbols: CodeSymbol[]; imports: string[]; content: string }> = [
      { path: "a.ts", symbols: [{ name: "foo", kind: "function", line: 1 }], imports: [], content: "" },
      { path: "b.ts", symbols: [{ name: "foo", kind: "function", line: 1 }], imports: [], content: "" }
    ];

    const crossRef = buildSymbolCrossReference(files);
    const deps = getSymbolDependencies(crossRef, "foo", "a.ts");

    expect(deps).toHaveProperty("references");
    expect(deps).toHaveProperty("referencedBy");
  });

  it("returns empty arrays for unknown symbols", () => {
    const files: Array<{ path: string; symbols: CodeSymbol[]; imports: string[]; content: string }> = [
      { path: "a.ts", symbols: [{ name: "foo", kind: "function", line: 1 }], imports: [], content: "" }
    ];

    const crossRef = buildSymbolCrossReference(files);
    const deps = getSymbolDependencies(crossRef, "unknown", "a.ts");

    expect(deps.references).toEqual([]);
    expect(deps.referencedBy).toEqual([]);
  });
});
