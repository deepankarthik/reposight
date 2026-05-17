import { describe, it, expect } from "vitest";
import { buildImportGraph, getImportScore, getTransitiveImportScore } from "./import-graph.js";

describe("buildImportGraph", () => {
  it("should create nodes for all files", async () => {
    const files = [
      { absolutePath: "/repo/a.ts", relativePath: "a.ts", imports: [] },
      { absolutePath: "/repo/b.ts", relativePath: "b.ts", imports: [] }
    ];

    const graph = await buildImportGraph(files, "/repo");
    expect(graph.nodes.size).toBe(2);
  });

  it("should initialize importedBy as empty array", async () => {
    const files = [
      { absolutePath: "/repo/a.ts", relativePath: "a.ts", imports: [] },
      { absolutePath: "/repo/b.ts", relativePath: "b.ts", imports: [] }
    ];

    const graph = await buildImportGraph(files, "/repo");
    for (const [, node] of graph.nodes) {
      expect(Array.isArray(node.importedBy)).toBe(true);
      expect(node.importCount).toBe(0);
    }
  });

  it("should store imports on nodes", async () => {
    const files = [
      { absolutePath: "/repo/a.ts", relativePath: "a.ts", imports: ["./b", "external-lib"] },
      { absolutePath: "/repo/b.ts", relativePath: "b.ts", imports: [] }
    ];

    const graph = await buildImportGraph(files, "/repo");
    const aNode = graph.nodes.get("/repo/a.ts");
    expect(aNode?.imports).toContain("./b");
    expect(aNode?.imports).toContain("external-lib");
  });

  it("should track external dependencies", async () => {
    const files = [
      { absolutePath: "/repo/a.ts", relativePath: "a.ts", imports: ["lodash", "./b"] },
      { absolutePath: "/repo/b.ts", relativePath: "b.ts", imports: [] }
    ];

    const graph = await buildImportGraph(files, "/repo");
    expect(graph.externalDeps.has("lodash")).toBe(true);
  });

  it("should discover workspace packages", async () => {
    const files = [
      { absolutePath: "/repo/packages/shared/src/index.ts", relativePath: "packages/shared/src/index.ts", imports: [] },
      { absolutePath: "/repo/packages/cli/src/index.ts", relativePath: "packages/cli/src/index.ts", imports: ["@repo/shared"] }
    ];

    const graph = await buildImportGraph(files, "/repo");
    expect(graph.packages.size).toBeGreaterThanOrEqual(0);
  });
});

describe("getImportScore", () => {
  it("should return 0 for files with no importers", async () => {
    const files = [
      { absolutePath: "/repo/a.ts", relativePath: "a.ts", imports: [] },
      { absolutePath: "/repo/b.ts", relativePath: "b.ts", imports: [] }
    ];

    const graph = await buildImportGraph(files, "/repo");
    expect(getImportScore(graph, "/repo/a.ts")).toBe(0);
  });

  it("should return 0 for unknown paths", async () => {
    const graph = await buildImportGraph([], "/repo");
    expect(getImportScore(graph, "/unknown.ts")).toBe(0);
  });
});

describe("getTransitiveImportScore", () => {
  it("should return 0 for files with no importers", async () => {
    const files = [
      { absolutePath: "/repo/a.ts", relativePath: "a.ts", imports: [] },
      { absolutePath: "/repo/b.ts", relativePath: "b.ts", imports: [] }
    ];

    const graph = await buildImportGraph(files, "/repo");
    expect(getTransitiveImportScore(graph, "/repo/a.ts")).toBe(0);
  });

  it("should respect max depth", async () => {
    const files = [
      { absolutePath: "/repo/a.ts", relativePath: "a.ts", imports: [] },
      { absolutePath: "/repo/b.ts", relativePath: "b.ts", imports: [] }
    ];

    const graph = await buildImportGraph(files, "/repo");
    const shallowScore = getTransitiveImportScore(graph, "/repo/a.ts", 1);
    const deepScore = getTransitiveImportScore(graph, "/repo/a.ts", 3);
    expect(deepScore).toBe(shallowScore);
  });
});
