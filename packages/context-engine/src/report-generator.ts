import path from "node:path";
import type { RepositoryContext, ContextFile, ImportGraphNode } from "@repolens/shared";
import type { ImportGraph } from "./import-graph.js";

interface ArchitectureSection {
  heading: string;
  content: string;
}

interface ReportOptions {
  includeMermaid?: boolean;
  fileLevelGraph?: boolean;
  importGraph?: ImportGraph;
}

function getPackageName(filePath: string): string {
  const scopedMatch = filePath.match(/^@[\w-]+\/([\w-]+)/);
  if (scopedMatch) return scopedMatch[1];
  const parts = filePath.split("/");
  const pkgIndex = parts.findIndex((p) => p === "packages" || p === "apps" || p === "src");
  if (pkgIndex === -1 || pkgIndex + 1 >= parts.length) return "root";
  return parts[pkgIndex + 1];
}

function getFileExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext || "unknown";
}

function countSymbolsByKind(files: ContextFile[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const file of files) {
    if (!file.symbols) continue;
    for (const symbol of file.symbols) {
      counts.set(symbol.kind, (counts.get(symbol.kind) ?? 0) + 1);
    }
  }
  return counts;
}

function getTopImportedFiles(files: ContextFile[], importGraph?: ImportGraph, limit = 10): Array<{ path: string; importedBy: number }> {
  if (importGraph) {
    const results: Array<{ path: string; importedBy: number }> = [];
    for (const [absPath, node] of importGraph.nodes) {
      const relPath = node.relativePath;
      const relFile = files.find((f) => f.path === relPath);
      if (relFile) {
        results.push({ path: relPath, importedBy: node.importCount });
      }
    }
    return results.sort((a, b) => b.importedBy - a.importedBy).slice(0, limit);
  }

  const importCounts = new Map<string, number>();
  for (const file of files) {
    if (!file.imports) continue;
    for (const imp of file.imports) {
      importCounts.set(imp, (importCounts.get(imp) ?? 0) + 1);
    }
  }
  return [...importCounts.entries()]
    .map(([path, importedBy]) => ({ path, importedBy }))
    .sort((a, b) => b.importedBy - a.importedBy)
    .slice(0, limit);
}

function getEntryPoints(files: ContextFile[]): string[] {
  const entryPatterns = ["index.ts", "index.tsx", "index.js", "main.ts", "main.py", "app.ts", "server.ts", "cli.ts"];
  return files
    .filter((f) => entryPatterns.some((pattern) => f.path.endsWith(pattern)))
    .map((f) => f.path);
}

function generateMermaidDependencyGraph(files: ContextFile[], fileLevel = false): string {
  if (fileLevel) {
    const lines = ["```mermaid", "graph TD"];
    const seen = new Set<string>();
    const fileSet = new Set(files.map((f) => f.path));

    for (const file of files) {
      if (!file.imports) continue;
      const fromNode = file.path.replace(/[^a-zA-Z0-9]/g, "_");
      for (const imp of file.imports) {
        if (fileSet.has(imp)) {
          const toNode = imp.replace(/[^a-zA-Z0-9]/g, "_");
          const edge = `${fromNode} --> ${toNode}`;
          if (!seen.has(edge)) {
            seen.add(edge);
            lines.push(`  ${fromNode}["${file.path}"] --> ${toNode}["${imp}"]`);
          }
        }
      }
    }

    lines.push("```");
    return lines.join("\n");
  }

  const modules = new Map<string, Set<string>>();

  for (const file of files) {
    const pkg = getPackageName(file.path);
    if (!modules.has(pkg)) modules.set(pkg, new Set());
    if (file.imports) {
      for (const imp of file.imports) {
        const impPkg = getPackageName(imp);
        if (impPkg !== pkg) {
          modules.get(pkg)!.add(impPkg);
        }
      }
    }
  }

  const lines = ["```mermaid", "graph TD"];
  const seen = new Set<string>();

  for (const [from, toSet] of modules) {
    for (const to of toSet) {
      const edge = `${from} --> ${to}`;
      if (!seen.has(edge)) {
        seen.add(edge);
        lines.push(`  ${from} --> ${to}`);
      }
    }
  }

  lines.push("```");
  return lines.join("\n");
}

function generateMermaidSequenceDiagram(trace: { from: string; to: string; action: string }[]): string {
  if (trace.length === 0) return "";

  const lines = ["```mermaid", "sequenceDiagram"];
  for (const t of trace) {
    lines.push(`  ${t.from}->>${t.to}: ${t.action}`);
  }
  lines.push("```");
  return lines.join("\n");
}

function generateOverview(context: RepositoryContext): ArchitectureSection {
  const extensions = new Map<string, number>();
  for (const file of context.files) {
    const ext = getFileExtension(file.path);
    extensions.set(ext, (extensions.get(ext) ?? 0) + 1);
  }

  const langSummary = [...extensions.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([ext, count]) => `${ext} (${count} files)`)
    .join(", ");

  const entryPoints = getEntryPoints(context.files);

  return {
    heading: "Overview",
    content: [
      `- ${context.summary.includedFiles} source files scanned`,
      `- ${context.summary.totalBytes.toLocaleString()} bytes of source code`,
      `- Languages: ${langSummary}`,
      entryPoints.length > 0 ? `- Entry points: ${entryPoints.join(", ")}` : null
    ].filter(Boolean).join("\n")
  };
}

function generateModuleMap(context: RepositoryContext, importGraph?: ImportGraph): ArchitectureSection {
  const modules = new Map<string, { files: string[]; imports: Set<string>; symbols: number; absolutePaths: string[] }>();

  for (const file of context.files) {
    const pkg = getPackageName(file.path);
    const existing = modules.get(pkg) ?? { files: [], imports: new Set(), symbols: 0, absolutePaths: [] };
    existing.files.push(file.path);
    if (file.absolutePath) existing.absolutePaths.push(file.absolutePath);
    if (file.imports) {
      for (const imp of file.imports) existing.imports.add(imp);
    }
    if (file.symbols) existing.symbols += file.symbols.length;
    modules.set(pkg, existing);
  }

  const rows = [...modules.entries()]
    .map(([name, data]) => {
      let importedByCount = 0;
      if (importGraph) {
        for (const absPath of data.absolutePaths) {
          const node = importGraph.nodes.get(absPath);
          if (node) {
            importedByCount += node.importCount;
          }
        }
      }

      return `| \`${name}\` | ${data.files.length} files | ${data.symbols} symbols | ${importedByCount > 0 ? importedByCount : "none"} |`;
    })
    .join("\n");

  return {
    heading: "Module Map",
    content: [
      "| Module | Files | Symbols | Imported By |",
      "|--------|-------|---------|-------------|",
      rows
    ].join("\n")
  };
}

function generateKeySymbols(context: RepositoryContext, importGraph?: ImportGraph): ArchitectureSection {
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

  const topSymbols = [...symbolMap.entries()]
    .sort((a, b) => b[1].importedBy - a[1].importedBy)
    .slice(0, 15);

  if (topSymbols.length === 0) {
    return { heading: "Key Symbols", content: "_No symbols extracted._" };
  }

  const rows = topSymbols
    .map(([, data]) => `| \`${data.kind}\` \`${data.name}\` | ${data.file}:${data.line} | ${data.importedBy} |`)
    .join("\n");

  return {
    heading: "Key Symbols",
    content: [
      "| Symbol | Location | Imported By |",
      "|--------|----------|-------------|",
      rows
    ].join("\n")
  };
}

function generateDependencyGraph(context: RepositoryContext, fileLevel = false): ArchitectureSection {
  return {
    heading: "Dependency Graph",
    content: generateMermaidDependencyGraph(context.files, fileLevel)
  };
}

export function generateArchitectureReport(context: RepositoryContext, options?: ReportOptions): string {
  const includeMermaid = options?.includeMermaid ?? true;
  const fileLevelGraph = options?.fileLevelGraph ?? false;
  const importGraph = options?.importGraph;
  const sections: ArchitectureSection[] = [
    generateOverview(context),
    generateModuleMap(context, importGraph),
    generateKeySymbols(context, importGraph)
  ];

  if (includeMermaid) {
    sections.push(generateDependencyGraph(context, fileLevelGraph));
  }

  const repoName = path.basename(context.rootDir);
  const lines = [`# Architecture: ${repoName}`, ""];

  for (const section of sections) {
    lines.push(`## ${section.heading}`, "", section.content, "");
  }

  return lines.join("\n");
}

export function generateMermaidDiagram(context: RepositoryContext, fileLevel = false): string {
  return generateMermaidDependencyGraph(context.files, fileLevel);
}
