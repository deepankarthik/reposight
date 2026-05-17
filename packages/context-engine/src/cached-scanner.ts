import fs from "node:fs/promises";
import path from "node:path";
import type { ContextFile, RepositoryContext } from "@repolens/shared";
import { chunkFile } from "./chunker.js";
import { shouldIgnorePath, loadIgnoreFiles, isGeneratedFile } from "./ignore.js";
import { isLikelyTextFile, languageFromPath } from "./language.js";
import { extractSymbols, extractImportsFromSource } from "./symbol-extractor.js";
import { FileCache } from "./cache.js";
import { buildImportGraph, getImportScore, getTransitiveImportScore, type ImportGraph } from "./import-graph.js";
import { getRecentFiles, getRecencyScore, type RecentFileEntry, GIT_NOT_AVAILABLE } from "./git-recent.js";
import { getTestPairScore, isTestFile, isSourceFile } from "./test-pairing.js";
import { getDirectoryProximityScore, getSamePackageScore } from "./proximity.js";

interface ScanRepositoryOptions {
  rootDir: string;
  files?: string[];
  maxFiles?: number;
  maxBytes?: number;
  maxFileBytes?: number;
  maxChunkChars?: number;
  targetFile?: string;
  ignoreTests?: boolean;
}

function toSafeRelativePath(rootDir: string, filePath: string): string | undefined {
  const relative = path.relative(rootDir, filePath);
  if (relative.startsWith("..")) return undefined;
  return relative;
}

async function walkDirectory(rootDir: string, currentDir: string, output: string[], skipped: { count: number }, visited: Set<string>): Promise<void> {
  try {
    const realDir = await fs.realpath(currentDir);
    if (visited.has(realDir)) return;
    visited.add(realDir);

    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, absolutePath);
      if (shouldIgnorePath(relativePath)) continue;

      if (entry.isDirectory()) {
        await walkDirectory(rootDir, absolutePath, output, skipped, visited);
        continue;
      }

      if (entry.isFile()) output.push(absolutePath);
    }
  } catch {
    skipped.count += 1;
  }
}

function basePriority(filePath: string): number {
  if (/(^|\/)(package\.json|tsconfig\.json|README\.md)$/i.test(filePath)) return 0;
  if (/\/(src|app|apps|packages)\//.test(`/${filePath}`)) return 1;
  if (/\.(ts|tsx|js|jsx|py|go|rs)$/.test(filePath)) return 2;
  return 3;
}

function computeHeuristicPriority(
  relativePath: string,
  absolutePath: string,
  importGraph: ImportGraph,
  recentFiles: RecentFileEntry[] | typeof GIT_NOT_AVAILABLE,
  allRelativePaths: string[],
  targetFile?: string
): number {
  const base = basePriority(relativePath);
  const importScore = getTransitiveImportScore(importGraph, absolutePath);
  const recencyScore = getRecencyScore(recentFiles, relativePath);
  const testPairScore = targetFile ? getTestPairScore(relativePath, allRelativePaths, targetFile) : 0;
  const proximityScore = targetFile ? getDirectoryProximityScore(relativePath, targetFile) : 0;
  const samePackageScore = targetFile ? getSamePackageScore(relativePath, targetFile) : 0;

  const weightedScore =
    base * 10 +
    importScore * 2 +
    recencyScore * 3 +
    testPairScore * 4 +
    proximityScore * 2 +
    samePackageScore * 1;

  return weightedScore;
}

async function discoverFiles(rootDir: string, requestedFiles?: string[], skipped?: { count: number }): Promise<string[]> {
  if (requestedFiles?.length) {
    const resolved = requestedFiles
      .map((file) => path.resolve(rootDir, file))
      .filter((file) => toSafeRelativePath(rootDir, file) !== undefined);

    const results = await Promise.all(
      resolved.map(async (file) => {
        try {
          return (await fs.stat(file)).isFile() ? file : null;
        } catch {
          if (skipped) skipped.count += 1;
          return null;
        }
      })
    );

    return results.filter((f): f is string => f !== null);
  }

  const output: string[] = [];
  const skipCounter = skipped ?? { count: 0 };
  const visited = new Set<string>();
  await walkDirectory(rootDir, rootDir, output, skipCounter, visited);
  return output;
}

async function sortAndFilterFiles(
  rootDir: string,
  discoveredFiles: string[],
  targetFile?: string,
  ignoreTests?: boolean
): Promise<{ absolutePath: string; relativePath: string; imports: string[]; score: number }[]> {
  const filesWithRelative = discoveredFiles
    .map((absolutePath) => ({ absolutePath, relativePath: path.relative(rootDir, absolutePath).split(path.sep).join("/") }))
    .filter(({ relativePath }) => {
      if (shouldIgnorePath(relativePath, { ignoreTests })) return false;
      if (isGeneratedFile(relativePath)) return false;
      return isLikelyTextFile(relativePath);
    });

  const allRelativePaths = filesWithRelative.map((f) => f.relativePath);

  const filesWithImports: Array<{ absolutePath: string; relativePath: string; imports: string[] }> = [];
  const importResults = await Promise.all(
    filesWithRelative.map(async (f) => {
      try {
        const content = await fs.readFile(f.absolutePath, "utf8");
        const imports = extractImportsFromSource(content, languageFromPath(f.relativePath));
        return { ...f, imports };
      } catch {
        return { ...f, imports: [] };
      }
    })
  );
  filesWithImports.push(...importResults);

  const importGraph = buildImportGraph(filesWithImports);
  const recentFiles = await getRecentFiles(rootDir);

  return filesWithRelative.map((f) => ({
    ...f,
    imports: filesWithImports.find((fw) => fw.absolutePath === f.absolutePath)?.imports ?? [],
    score: computeHeuristicPriority(f.relativePath, f.absolutePath, importGraph, recentFiles, allRelativePaths, targetFile)
  })).sort((a, b) => a.score - b.score || a.relativePath.localeCompare(b.relativePath));
}

async function readFilesWithinBudget(
  sortedFiles: { absolutePath: string; relativePath: string }[],
  maxFiles: number,
  maxBytes: number,
  maxFileBytes: number,
  cache: FileCache
): Promise<{ files: ContextFile[]; totalBytes: number; truncated: boolean; skipped: number; cacheHits: number; cacheMisses: number }> {
  const files: ContextFile[] = [];
  let totalBytes = 0;
  let truncated = false;
  let skipped = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  const concurrencyLimit = 10;
  let nextIndex = 0;

  async function processNext(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= sortedFiles.length) return;
      if (files.length >= maxFiles || totalBytes >= maxBytes) {
        truncated = true;
        return;
      }

      const file = sortedFiles[currentIndex];
      const remainingBytes = Math.max(0, maxBytes - totalBytes);

      try {
        const stat = await fs.stat(file.absolutePath);
        if (stat.size > maxFileBytes) {
          truncated = true;
          continue;
        }

        const cached = cache.get(file.absolutePath, stat.mtimeMs, stat.size);
        if (cached) {
          const contentBytes = Buffer.byteLength(cached.content, "utf8");
          if (contentBytes > remainingBytes) {
            truncated = true;
            continue;
          }

          const imports = extractImportsFromSource(cached.content, languageFromPath(file.relativePath));

          files.push({
            path: file.relativePath,
            absolutePath: file.absolutePath,
            language: languageFromPath(file.relativePath),
            content: cached.content,
            size: stat.size,
            symbols: cached.symbols,
            imports
          });

          totalBytes += contentBytes;
          cacheHits += 1;
          continue;
        }

        const raw = await fs.readFile(file.absolutePath, "utf8");
        const rawBuffer = Buffer.from(raw, "utf8");
        const content = rawBuffer.length > remainingBytes
          ? rawBuffer.subarray(0, remainingBytes).toString("utf8")
          : raw;
        const language = languageFromPath(file.relativePath);
        const symbols = extractSymbols(content, language);
        const imports = extractImportsFromSource(content, language);

        cache.set(file.absolutePath, stat.mtimeMs, stat.size, content, symbols);

        files.push({
          path: file.relativePath,
          absolutePath: file.absolutePath,
          language,
          content,
          size: stat.size,
          symbols,
          imports
        });

        totalBytes += Buffer.byteLength(content, "utf8");
        cacheMisses += 1;
      } catch {
        cache.invalidate(file.absolutePath);
        skipped += 1;
        truncated = true;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrencyLimit, sortedFiles.length) }, () => processNext());
  await Promise.all(workers);

  return { files, totalBytes, truncated, skipped, cacheHits, cacheMisses };
}

export async function scanRepository(options: ScanRepositoryOptions, cache: FileCache): Promise<RepositoryContext & { importGraph: ImportGraph }> {
  const rootDir = path.resolve(options.rootDir);
  const maxFiles = options.maxFiles ?? 80;
  const maxBytes = options.maxBytes ?? 120_000;
  const maxFileBytes = options.maxFileBytes ?? 80_000;
  const maxChunkChars = options.maxChunkChars ?? 6_000;
  const skipped = { count: 0 };

  loadIgnoreFiles(rootDir);

  const discoveredFiles = await discoverFiles(rootDir, options.files, skipped);
  const sortedFiles = await sortAndFilterFiles(rootDir, discoveredFiles, options.targetFile, options.ignoreTests);
  const { files, totalBytes, truncated, skipped: readSkipped, cacheHits, cacheMisses } = await readFilesWithinBudget(sortedFiles, maxFiles, maxBytes, maxFileBytes, cache);

  const filesWithImports = files.map((f) => ({
    absolutePath: f.absolutePath ?? path.resolve(rootDir, f.path),
    relativePath: f.path,
    imports: f.imports ?? []
  }));
  const importGraph = buildImportGraph(filesWithImports);

  return {
    rootDir,
    files,
    chunks: files.flatMap((file) => chunkFile(file, maxChunkChars)),
    summary: {
      scannedFiles: discoveredFiles.length,
      includedFiles: files.length,
      totalBytes,
      truncated,
      skippedFiles: skipped.count + readSkipped,
      cacheHits,
      cacheMisses
    },
    importGraph
  };
}
