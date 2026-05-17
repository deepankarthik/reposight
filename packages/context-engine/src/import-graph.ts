import path from "node:path";

export interface ImportGraphNode {
  absolutePath: string;
  relativePath: string;
  imports: string[];
  importedBy: string[];
  importCount: number;
}

export interface ImportGraph {
  nodes: Map<string, ImportGraphNode>;
}

function resolveImportPath(importerDir: string, importSpecifier: string, rootDir: string): string | null {
  if (importSpecifier.startsWith(".") || importSpecifier.startsWith("/")) {
    const resolved = path.resolve(importerDir, importSpecifier);
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"];
    for (const ext of extensions) {
      const candidate = resolved + ext;
      const relative = path.relative(rootDir, candidate).split(path.sep).join("/");
      if (relative.length > 0 && !relative.startsWith("..")) {
        return candidate;
      }
    }
    return null;
  }

  if (!importSpecifier.startsWith(".") && !importSpecifier.startsWith("/")) {
    const relative = importSpecifier.split(path.sep).join("/");
    return relative;
  }

  return null;
}

export function buildImportGraph(
  files: { absolutePath: string; relativePath: string; imports: string[] }[]
): ImportGraph {
  const nodes = new Map<string, ImportGraphNode>();
  const relativeToAbsolute = new Map<string, string>();

  for (const file of files) {
    const node: ImportGraphNode = {
      absolutePath: file.absolutePath,
      relativePath: file.relativePath,
      imports: file.imports,
      importedBy: [],
      importCount: 0
    };
    nodes.set(file.absolutePath, node);
    relativeToAbsolute.set(file.relativePath, file.absolutePath);
  }

  const rootDir = files.length > 0 ? path.dirname(files[0].relativePath.split("/")[0] ?? "") : "";

  for (const file of files) {
    const importerDir = path.dirname(file.absolutePath);

    for (const importSpec of file.imports) {
      const resolved = resolveImportPath(importerDir, importSpec, rootDir);
      if (!resolved) continue;

      const targetNode = nodes.get(resolved);
      if (targetNode) {
        if (!targetNode.importedBy.includes(file.absolutePath)) {
          targetNode.importedBy.push(file.absolutePath);
          targetNode.importCount += 1;
        }
      } else {
        const relativeMatch = relativeToAbsolute.get(importSpec);
        if (relativeMatch) {
          const target = nodes.get(relativeMatch);
          if (target && !target.importedBy.includes(file.absolutePath)) {
            target.importedBy.push(file.absolutePath);
            target.importCount += 1;
          }
        }
      }
    }
  }

  return { nodes };
}

export function getImportScore(graph: ImportGraph, absolutePath: string): number {
  const node = graph.nodes.get(absolutePath);
  if (!node) return 0;

  return node.importCount;
}

export function getTransitiveImportScore(graph: ImportGraph, absolutePath: string, maxDepth = 2): number {
  const visited = new Set<string>();
  let score = 0;

  function traverse(currentPath: string, depth: number): void {
    if (depth > maxDepth || visited.has(currentPath)) return;
    visited.add(currentPath);

    const node = graph.nodes.get(currentPath);
    if (!node) return;

    score += node.importCount;

    for (const importer of node.importedBy) {
      traverse(importer, depth + 1);
    }
  }

  traverse(absolutePath, 0);
  return score;
}
