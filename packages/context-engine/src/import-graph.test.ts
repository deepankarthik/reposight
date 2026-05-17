import { describe, it, expect } from "vitest";
import { buildImportGraph, getImportScore, getTransitiveImportScore } from "./import-graph.js";

describe("buildImportGraph", () => {
  it("should create nodes for all files", () => {
    const files = [
      { absolutePath: "/repo/a.ts", relativePath: "a.ts", imports: [] },
      { absolutePath: "/repo/b.ts", relativePath: "b.ts", imports: [] }
    ];

    const graph = buildImportGraph(files);
    expect(graph.nodes.size).toBe(2);
  });

  it("should initialize importedBy as empty array", () => {
    const files = [
      { absolutePath: "/repo/a.ts", relativePath: "a.ts", imports: [] },
      { absolutePath: "/repo/b.ts", relativePath: "b.ts", imports: [] }
    ];

    const graph = buildImportGraph(files);
    for (const [, node] of graph.nodes) {
      expect(Array.isArray(node.importedBy)).toBe(true);
      expect(node.importCount).toBe(0);
    }
  });

  it("should store imports on nodes", () => {
    const files = [
      { absolutePath: "/repo/a.ts", relativePath: "a.ts", imports: ["./b", "external-lib"] },
      { absolutePath: "/repo/b.ts", relativePath: "b.ts", imports: [] }
    ];

    const graph = buildImportGraph(files);
    const aNode = graph.nodes.get("/repo/a.ts");
    expect(aNode?.imports).toContain("./b");
    expect(aNode?.imports).toContain("external-lib");
  });
});

describe("getImportScore", () => {
  it("should return 0 for files with no importers", () => {
    const files = [
      { absolutePath: "/repo/a.ts", relativePath: "a.ts", imports: [] },
      { absolutePath: "/repo/b.ts", relativePath: "b.ts", imports: [] }
    ];

    const graph = buildImportGraph(files);
    expect(getImportScore(graph, "/repo/a.ts")).toBe(0);
  });

  it("should return 0 for unknown paths", () => {
    const graph = buildImportGraph([]);
    expect(getImportScore(graph, "/unknown.ts")).toBe(0);
  });
});

describe("getTransitiveImportScore", () => {
  it("should return 0 for files with no importers", () => {
    const files = [
      { absolutePath: "/repo/a.ts", relativePath: "a.ts", imports: [] },
      { absolutePath: "/repo/b.ts", relativePath: "b.ts", imports: [] }
    ];

    const graph = buildImportGraph(files);
    expect(getTransitiveImportScore(graph, "/repo/a.ts")).toBe(0);
  });

  it("should respect max depth", () => {
    const files = [
      { absolutePath: "/repo/a.ts", relativePath: "a.ts", imports: [] },
      { absolutePath: "/repo/b.ts", relativePath: "b.ts", imports: [] }
    ];

    const graph = buildImportGraph(files);
    const shallowScore = getTransitiveImportScore(graph, "/repo/a.ts", 1);
    const deepScore = getTransitiveImportScore(graph, "/repo/a.ts", 3);
    expect(deepScore).toBe(shallowScore);
  });
});
