import path from "node:path";
import fs from "node:fs/promises";

export interface ImportGraphNode {
  absolutePath: string;
  relativePath: string;
  imports: string[];
  importedBy: string[];
  importCount: number;
}

export interface PackageInfo {
  name: string;
  location: string;
  dependencies: string[];
}

export interface ImportGraph {
  nodes: Map<string, ImportGraphNode>;
  packages: Map<string, PackageInfo>;
  externalDeps: Set<string>;
}

async function findPackageJsonFiles(rootDir: string): Promise<string[]> {
  const packageJsons: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 3) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;

        const absolutePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(absolutePath, depth + 1);
        } else if (entry.name === "package.json") {
          packageJsons.push(absolutePath);
        }
      }
    } catch {
      // ignore
    }
  }

  await walk(rootDir, 0);
  return packageJsons;
}

async function parsePackageJson(filePath: string): Promise<PackageInfo | null> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const pkg = JSON.parse(content);
    const location = path.dirname(filePath);

    const deps = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {})
    ];

    return {
      name: pkg.name ?? path.basename(location),
      location,
      dependencies: deps
    };
  } catch {
    return null;
  }
}

async function discoverPackages(rootDir: string): Promise<Map<string, PackageInfo>> {
  const packages = new Map<string, PackageInfo>();
  const packageJsons = await findPackageJsonFiles(rootDir);

  for (const pkgJson of packageJsons) {
    const info = await parsePackageJson(pkgJson);
    if (info) {
      packages.set(info.name, info);
    }
  }

  return packages;
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

export async function buildImportGraph(
  files: { absolutePath: string; relativePath: string; imports: string[] }[],
  rootDir: string
): Promise<ImportGraph> {
  const nodes = new Map<string, ImportGraphNode>();
  const relativeToAbsolute = new Map<string, string>();
  const packages = await discoverPackages(rootDir);
  const externalDeps = new Set<string>();

  const packageLocations = new Map<string, string>();
  for (const [name, info] of packages) {
    packageLocations.set(name, info.location);
  }

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

  for (const file of files) {
    const importerDir = path.dirname(file.absolutePath);

    for (const importSpec of file.imports) {
      let resolved: string | null;

      if (importSpec.startsWith(".") || importSpec.startsWith("/")) {
        resolved = resolveImportPath(importerDir, importSpec, rootDir);
      } else {
        const pkgName = importSpec.startsWith("@")
          ? importSpec.split("/").slice(0, 2).join("/")
          : importSpec.split("/")[0] ?? importSpec;

        const pkgLocation = packageLocations.get(pkgName);
        if (pkgLocation) {
          const pkgRelative = path.relative(rootDir, pkgLocation).split(path.sep).join("/");
          resolved = pkgRelative;
        } else {
          externalDeps.add(pkgName);
          continue;
        }
      }

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

  return { nodes, packages, externalDeps };
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
