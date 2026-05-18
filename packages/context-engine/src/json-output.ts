import type { RepositoryContext, ContextFile, CodeSymbol, PackageInfo } from "@repolens/shared";
import type { ImportGraph } from "./import-graph.js";

interface JsonFileEntry {
  path: string;
  language: string;
  content: string;
  size: number;
  symbols: CodeSymbol[];
  imports: string[];
  summary: string;
  fileComment?: string;
}

interface JsonImportGraphNode {
  path: string;
  imports: string[];
  importedBy: string[];
  importCount: number;
}

interface JsonSummary {
  rootDir: string;
  scannedFiles: number;
  includedFiles: number;
  totalBytes: number;
  truncated: boolean;
  skippedFiles: number;
  cacheHits: number;
  cacheMisses: number;
}

interface JsonArchitectureReport {
  version: "0.1.0";
  summary: JsonSummary;
  files: JsonFileEntry[];
  importGraph: {
    nodes: JsonImportGraphNode[];
    packages: Array<{ name: string; location: string; dependencies: string[] }>;
    externalDeps: string[];
  };
  entryPoints: string[];
  modules: Array<{
    name: string;
    files: string[];
    symbolCount: number;
    importedByCount: number;
  }>;
  keySymbols: Array<{
    kind: string;
    name: string;
    file: string;
    line: number;
    importedBy: number;
  }>;
}

function getPackageName(filePath: string): string {
  const scopedMatch = filePath.match(/^@[\w-]+\/([\w-]+)/);
  if (scopedMatch) return scopedMatch[1];
  const parts = filePath.split("/");
  const pkgIndex = parts.findIndex((p) => p === "packages" || p === "apps" || p === "src");
  if (pkgIndex === -1 || pkgIndex + 1 >= parts.length) return "root";
  return parts[pkgIndex + 1];
}

function getEntryPoints(files: ContextFile[]): string[] {
  const entryPatterns = ["index.ts", "index.tsx", "index.js", "main.ts", "main.py", "app.ts", "server.ts", "cli.ts"];
  return files
    .filter((f) => entryPatterns.some((pattern) => f.path.endsWith(pattern)))
    .map((f) => f.path);
}

export function generateJsonReport(context: RepositoryContext, includeContent = false): JsonArchitectureReport {
  const files: JsonFileEntry[] = context.files.map((f) => ({
    path: f.path,
    language: f.language,
    content: includeContent ? f.content : "",
    size: f.size,
    symbols: f.symbols ?? [],
    imports: f.imports ?? [],
    summary: f.summary ?? "",
    fileComment: f.fileComment
  }));

  const importGraph = context.importGraph;
  const graphNodes: JsonImportGraphNode[] = [];
  for (const [absPath, node] of (importGraph?.nodes ?? new Map())) {
    graphNodes.push({
      path: node.relativePath,
      imports: node.imports,
      importedBy: node.importedBy.map((p: string) => {
        const found = importGraph?.nodes.get(p);
        return found?.relativePath ?? p;
      }),
      importCount: node.importCount
    });
  }

  const packages = [...(importGraph?.packages ?? new Map<string, PackageInfo>()).values()].map((p: PackageInfo) => ({
    name: p.name,
    location: p.location,
    dependencies: p.dependencies
  }));

  const externalDeps = [...(importGraph?.externalDeps ?? new Set())];

  const modules = new Map<string, { files: string[]; symbolCount: number; importedByCount: number }>();
  for (const file of context.files) {
    const pkg = getPackageName(file.path);
    const existing = modules.get(pkg) ?? { files: [], symbolCount: 0, importedByCount: 0 };
    existing.files.push(file.path);
    existing.symbolCount += (file.symbols ?? []).length;
    modules.set(pkg, existing);
  }

  if (importGraph) {
    for (const file of context.files) {
      if (!file.absolutePath) continue;
      const node = importGraph.nodes.get(file.absolutePath);
      if (node) {
        const pkg = getPackageName(file.path);
        const mod = modules.get(pkg);
        if (mod) {
          mod.importedByCount += node.importCount;
        }
      }
    }
  }

  const moduleList = [...modules.entries()].map(([name, data]) => ({
    name,
    files: data.files,
    symbolCount: data.symbolCount,
    importedByCount: data.importedByCount
  }));

  const symbolMap = new Map<string, { kind: string; name: string; file: string; line: number; importedBy: number }>();
  for (const file of context.files) {
    if (!file.symbols) continue;
    for (const symbol of file.symbols) {
      const key = `${file.path}:${symbol.kind}:${symbol.name}`;
      const existing = symbolMap.get(key) ?? { kind: symbol.kind, name: symbol.name, file: file.path, line: symbol.line, importedBy: 0 };
      symbolMap.set(key, existing);
    }
  }

  if (importGraph) {
    for (const file of context.files) {
      if (!file.absolutePath) continue;
      const node = importGraph.nodes.get(file.absolutePath);
      if (!node || !file.symbols) continue;
      for (const symbol of file.symbols) {
        const key = `${file.path}:${symbol.kind}:${symbol.name}`;
        const entry = symbolMap.get(key);
        if (entry) {
          entry.importedBy = node.importCount;
        }
      }
    }
  }

  const keySymbols = [...symbolMap.entries()]
    .sort((a, b) => b[1].importedBy - a[1].importedBy)
    .slice(0, 15)
    .map(([, data]) => data);

  return {
    version: "0.1.0",
    summary: {
      rootDir: context.rootDir,
      scannedFiles: context.summary.scannedFiles,
      includedFiles: context.summary.includedFiles,
      totalBytes: context.summary.totalBytes,
      truncated: context.summary.truncated,
      skippedFiles: context.summary.skippedFiles,
      cacheHits: context.summary.cacheHits ?? 0,
      cacheMisses: context.summary.cacheMisses ?? 0
    },
    files,
    importGraph: {
      nodes: graphNodes,
      packages,
      externalDeps
    },
    entryPoints: getEntryPoints(context.files),
    modules: moduleList,
    keySymbols
  };
}
