import fs from "node:fs/promises";
import path from "node:path";
import type { RepositoryContext } from "@repolens/shared";
import { extractSymbols, extractImportsFromSource } from "./symbol-extractor.js";
import { languageFromPath } from "./language.js";

interface FileDiff {
  path: string;
  status: "added" | "removed" | "modified";
  oldSymbols?: Array<{ name: string; kind: string; line: number }>;
  newSymbols?: Array<{ name: string; kind: string; line: number }>;
  oldImports?: string[];
  newImports?: string[];
  hunks?: Array<{ oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }>;
}

interface DiffResult {
  files: FileDiff[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    totalSymbolAdditions: number;
    totalSymbolRemovals: number;
    totalImportAdditions: number;
    totalImportRemovals: number;
  };
}

function computeUnifiedDiff(oldContent: string, newContent: string, oldPath: string, newPath: string, contextLines = 3): FileDiff["hunks"] {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const hunks: FileDiff["hunks"] = [];
  const changes: Array<{ type: "equal" | "delete" | "insert"; oldLine: number; newLine: number }> = [];

  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx < oldLines.length && newIdx < newLines.length && oldLines[oldIdx] === newLines[newIdx]) {
      changes.push({ type: "equal", oldLine: oldIdx, newLine: newIdx });
      oldIdx++;
      newIdx++;
    } else if (oldIdx < oldLines.length && (newIdx >= newLines.length || shouldDelete(oldLines[oldIdx], newLines, newIdx))) {
      changes.push({ type: "delete", oldLine: oldIdx, newLine: newIdx });
      oldIdx++;
    } else {
      changes.push({ type: "insert", oldLine: oldIdx, newLine: newIdx });
      newIdx++;
    }
  }

  const changeIndices: number[] = [];
  changes.forEach((c, i) => {
    if (c.type !== "equal") changeIndices.push(i);
  });

  if (changeIndices.length === 0) return [];

  const hunkRanges: Array<{ start: number; end: number }> = [];
  let currentStart = Math.max(0, changeIndices[0] - contextLines);
  let currentEnd = Math.min(changes.length - 1, changeIndices[0] + contextLines);

  for (let i = 1; i < changeIndices.length; i++) {
    const nextStart = Math.max(0, changeIndices[i] - contextLines);
    const nextEnd = Math.min(changes.length - 1, changeIndices[i] + contextLines);

    if (nextStart <= currentEnd + 1) {
      currentEnd = Math.max(currentEnd, nextEnd);
    } else {
      hunkRanges.push({ start: currentStart, end: currentEnd });
      currentStart = nextStart;
      currentEnd = nextEnd;
    }
  }
  hunkRanges.push({ start: currentStart, end: currentEnd });

  for (const range of hunkRanges) {
    const hunkLines: string[] = [];
    let oldStart = -1;
    let newStart = -1;
    let oldLineCount = 0;
    let newLineCount = 0;

    for (let i = range.start; i <= range.end; i++) {
      const change = changes[i];
      if (change.type === "equal") {
        hunkLines.push(` ${oldLines[change.oldLine]}`);
        if (oldStart === -1) oldStart = change.oldLine + 1;
        if (newStart === -1) newStart = change.newLine + 1;
        oldLineCount++;
        newLineCount++;
      } else if (change.type === "delete") {
        hunkLines.push(`-${oldLines[change.oldLine]}`);
        if (oldStart === -1) oldStart = change.oldLine + 1;
        if (newStart === -1) newStart = change.newLine + 1;
        oldLineCount++;
      } else {
        hunkLines.push(`+${newLines[change.newLine]}`);
        if (oldStart === -1) oldStart = change.oldLine + 1;
        if (newStart === -1) newStart = change.newLine + 1;
        newLineCount++;
      }
    }

    hunks.push({
      oldStart: oldStart || 1,
      oldLines: oldLineCount,
      newStart: newStart || 1,
      newLines: newLineCount,
      lines: hunkLines
    });
  }

  return hunks;
}

function shouldDelete(oldLine: string, newLines: string[], newIdx: number): boolean {
  for (let i = newIdx; i < Math.min(newIdx + 5, newLines.length); i++) {
    if (oldLine === newLines[i]) return true;
  }
  return newIdx >= newLines.length;
}

export function computeSymbolDiff(oldSymbols: Array<{ name: string; kind: string }>, newSymbols: Array<{ name: string; kind: string }>): { added: Array<{ name: string; kind: string }>; removed: Array<{ name: string; kind: string }> } {
  const oldSet = new Set(oldSymbols.map((s) => `${s.kind}:${s.name}`));
  const newSet = new Set(newSymbols.map((s) => `${s.kind}:${s.name}`));

  const added = newSymbols.filter((s) => !oldSet.has(`${s.kind}:${s.name}`));
  const removed = oldSymbols.filter((s) => !newSet.has(`${s.kind}:${s.name}`));

  return { added, removed };
}

export function computeImportDiff(oldImports: string[], newImports: string[]): { added: string[]; removed: string[] } {
  const oldSet = new Set(oldImports);
  const newSet = new Set(newImports);

  const added = [...newSet].filter((i) => !oldSet.has(i));
  const removed = [...oldSet].filter((i) => !newSet.has(i));

  return { added, removed };
}

async function readFileContent(baseDir: string, relativePath: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(baseDir, relativePath), "utf8");
  } catch {
    return null;
  }
}

export async function analyzeDiff(baseContext: RepositoryContext, headContext: RepositoryContext, baseDir: string, headDir: string): Promise<DiffResult> {
  const baseFileSet = new Set(baseContext.files.map((f) => f.path));
  const headFileSet = new Set(headContext.files.map((f) => f.path));

  const addedFiles = [...headFileSet].filter((f) => !baseFileSet.has(f));
  const removedFiles = [...baseFileSet].filter((f) => !headFileSet.has(f));
  const commonFiles = [...headFileSet].filter((f) => baseFileSet.has(f));

  const diffs: FileDiff[] = [];
  let totalSymbolAdditions = 0;
  let totalSymbolRemovals = 0;
  let totalImportAdditions = 0;
  let totalImportRemovals = 0;

  for (const filePath of addedFiles) {
    const content = await readFileContent(headDir, filePath);
    if (!content) continue;

    const language = languageFromPath(filePath);
    const symbols = extractSymbols(content, language);
    const imports = extractImportsFromSource(content, language);

    diffs.push({
      path: filePath,
      status: "added",
      newSymbols: symbols,
      newImports: imports
    });

    totalSymbolAdditions += symbols.length;
    totalImportAdditions += imports.length;
  }

  for (const filePath of removedFiles) {
    const content = await readFileContent(baseDir, filePath);
    if (!content) continue;

    const language = languageFromPath(filePath);
    const symbols = extractSymbols(content, language);
    const imports = extractImportsFromSource(content, language);

    diffs.push({
      path: filePath,
      status: "removed",
      oldSymbols: symbols,
      oldImports: imports
    });

    totalSymbolRemovals += symbols.length;
    totalImportRemovals += imports.length;
  }

  for (const filePath of commonFiles) {
    const baseContent = await readFileContent(baseDir, filePath);
    const headContent = await readFileContent(headDir, filePath);

    if (baseContent === null || headContent === null) continue;
    if (baseContent === headContent) continue;

    const language = languageFromPath(filePath);
    const baseSymbols = extractSymbols(baseContent, language);
    const headSymbols = extractSymbols(headContent, language);
    const baseImports = extractImportsFromSource(baseContent, language);
    const headImports = extractImportsFromSource(headContent, language);

    const symbolDiff = computeSymbolDiff(baseSymbols, headSymbols);
    const importDiff = computeImportDiff(baseImports, headImports);
    const hunks = computeUnifiedDiff(baseContent, headContent, filePath, filePath);

    diffs.push({
      path: filePath,
      status: "modified",
      oldSymbols: baseSymbols,
      newSymbols: headSymbols,
      oldImports: baseImports,
      newImports: headImports,
      hunks
    });

    totalSymbolAdditions += symbolDiff.added.length;
    totalSymbolRemovals += symbolDiff.removed.length;
    totalImportAdditions += importDiff.added.length;
    totalImportRemovals += importDiff.removed.length;
  }

  diffs.sort((a, b) => {
    const statusOrder = { added: 0, removed: 1, modified: 2 };
    return (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0) || a.path.localeCompare(b.path);
  });

  return {
    files: diffs,
    summary: {
      added: addedFiles.length,
      removed: removedFiles.length,
      modified: commonFiles.filter((f) => diffs.some((d) => d.path === f && d.status === "modified")).length,
      totalSymbolAdditions,
      totalSymbolRemovals,
      totalImportAdditions,
      totalImportRemovals
    }
  };
}

export function formatDiffReport(diff: DiffResult, baseRef: string, headRef: string): string {
  const lines: string[] = [
    `# Diff: ${baseRef} → ${headRef}`,
    "",
    "## Summary",
    "",
    `- Added: ${diff.summary.added} files`,
    `- Removed: ${diff.summary.removed} files`,
    `- Modified: ${diff.summary.modified} files`,
    `- Symbol additions: ${diff.summary.totalSymbolAdditions}`,
    `- Symbol removals: ${diff.summary.totalSymbolRemovals}`,
    `- Import additions: ${diff.summary.totalImportAdditions}`,
    `- Import removals: ${diff.summary.totalImportRemovals}`,
    ""
  ];

  for (const fileDiff of diff.files) {
    lines.push(`### ${fileDiff.status === "added" ? "+" : fileDiff.status === "removed" ? "-" : "~"} \`${fileDiff.path}\``);
    lines.push("");

    if (fileDiff.status === "modified" && fileDiff.hunks && fileDiff.hunks.length > 0) {
      for (const hunk of fileDiff.hunks.slice(0, 10)) {
        lines.push(`\`\`\`diff`);
        lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
        lines.push(...hunk.lines);
        lines.push("```");
        lines.push("");
      }
      if (fileDiff.hunks.length > 10) {
        lines.push(`... and ${fileDiff.hunks.length - 10} more hunks`);
        lines.push("");
      }
    }

    if (fileDiff.newSymbols || fileDiff.oldSymbols) {
      const symbolDiff = computeSymbolDiff(fileDiff.oldSymbols ?? [], fileDiff.newSymbols ?? []);
      if (symbolDiff.added.length > 0) {
        lines.push("**Added symbols:**");
        for (const s of symbolDiff.added.slice(0, 10)) {
          lines.push(`- ${s.kind} \`${s.name}\``);
        }
        if (symbolDiff.added.length > 10) {
          lines.push(`- ... and ${symbolDiff.added.length - 10} more`);
        }
        lines.push("");
      }
      if (symbolDiff.removed.length > 0) {
        lines.push("**Removed symbols:**");
        for (const s of symbolDiff.removed.slice(0, 10)) {
          lines.push(`- ${s.kind} \`${s.name}\``);
        }
        if (symbolDiff.removed.length > 10) {
          lines.push(`- ... and ${symbolDiff.removed.length - 10} more`);
        }
        lines.push("");
      }
    }

    if (fileDiff.newImports || fileDiff.oldImports) {
      const importDiff = computeImportDiff(fileDiff.oldImports ?? [], fileDiff.newImports ?? []);
      if (importDiff.added.length > 0) {
        lines.push("**Added imports:**");
        for (const imp of importDiff.added.slice(0, 10)) {
          lines.push(`- \`${imp}\``);
        }
        if (importDiff.added.length > 10) {
          lines.push(`- ... and ${importDiff.added.length - 10} more`);
        }
        lines.push("");
      }
      if (importDiff.removed.length > 0) {
        lines.push("**Removed imports:**");
        for (const imp of importDiff.removed.slice(0, 10)) {
          lines.push(`- \`${imp}\``);
        }
        if (importDiff.removed.length > 10) {
          lines.push(`- ... and ${importDiff.removed.length - 10} more`);
        }
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}
