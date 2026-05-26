import path from "node:path";
import fs from "node:fs";

const ignoredDirectories = new Set([
  ".git",
  ".hg",
  ".svn",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  ".cache",
  ".parcel-cache",
  ".pnpm-store",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "out",
  "target",
  "vendor",
  ".venv",
  "__pycache__",
  ".gradle",
  ".idea",
  ".vscode",
  ".nx",
  ".serverless"
]);

const ignoredFilePatterns = [
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)bun\.lockb$/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.log$/,
  /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|gz|tar|tgz|mp4|mov|woff2?|ttf|eot)$/i
];

const generatedFilePatterns = [
  /\.pb\.(go|py|java)$/,
  /\.pb\.grpc\.(go|py|java)$/,
  /\.gen\.(ts|tsx|js|jsx|go|py)$/,
  /_generated\.go$/,
  /_generated\.py$/,
  /\.generated\.(ts|tsx|js|jsx)$/,
  /\.d\.ts$/,
  /\.swagger\.ts$/,
  /\.graphql\.gen\.(ts|tsx|js)$/,
  /\.mock\.(ts|tsx|js)$/,
  /\.fixture\.(ts|tsx|js)$/,
];

const testFilePatterns = [
  /\.test\.(ts|tsx|js|jsx|py|go|rs)$/,
  /\.spec\.(ts|tsx|js|jsx|py|go|rs)$/,
  /_test\.(go|py|rs)$/,
  /_spec\.rb$/,
  /Test\.java$/,
  /Tests\.java$/,
  /^test_/,
  /^tests\//,
  /\/tests?\//,
];

interface IgnorePattern {
  regex: RegExp;
  negated: boolean;
}

let gitignorePatterns: IgnorePattern[] = [];
let reposightignorePatterns: IgnorePattern[] = [];

function gitignoreToRegex(pattern: string): RegExp {
  const hasSlash = pattern.includes("/");
  const isDir = pattern.endsWith("/");
  const isAnchored = pattern.startsWith("/");

  const core = pattern
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .replace(/\\/g, "\\\\")
    .replace(/\./g, "\\.")
    .replace(/\+/g, "\\+")
    .replace(/\?/g, "[^/]")
    .replace(/\*\*\//g, "(.+/)?")
    .replace(/\*/g, "[^/]*");

  if (isAnchored || hasSlash) {
    if (isDir) {
      return new RegExp(`^${core}/`);
    }
    return new RegExp(`^${core}(/|$)`);
  }

  if (isDir) {
    return new RegExp(`(^|/)${core}/`);
  }
  return new RegExp(`(^|/)${core}(/|$)`);
}

function parseIgnoreFile(content: string): IgnorePattern[] {
  const patterns: IgnorePattern[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const negated = trimmed.startsWith("!");
    const pattern = negated ? trimmed.slice(1) : trimmed;
    const regex = gitignoreToRegex(pattern);
    patterns.push({ regex, negated });
  }
  return patterns;
}

function matchesPatterns(patterns: IgnorePattern[], normalizedPath: string): boolean {
  let result = false;
  for (const { regex, negated } of patterns) {
    if (regex.test(normalizedPath)) {
      result = !negated;
    }
  }
  return result;
}

export function loadIgnoreFiles(rootDir: string): void {
  gitignorePatterns = [];
  reposightignorePatterns = [];

  const gitignorePath = path.join(rootDir, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    try {
      const content = fs.readFileSync(gitignorePath, "utf8");
      gitignorePatterns = parseIgnoreFile(content);
    } catch {
      gitignorePatterns = [];
    }
  }

  const reposightignorePath = path.join(rootDir, ".reposightignore");
  if (fs.existsSync(reposightignorePath)) {
    try {
      const content = fs.readFileSync(reposightignorePath, "utf8");
      reposightignorePatterns = parseIgnoreFile(content);
    } catch {
      reposightignorePatterns = [];
    }
  }
}

export function shouldIgnorePath(relativePath: string, options?: { ignoreTests?: boolean }): boolean {
  const parts = relativePath.split(path.sep).filter(Boolean);
  if (parts.some((part) => ignoredDirectories.has(part))) return true;

  const normalized = relativePath.split(path.sep).join("/");
  if (ignoredFilePatterns.some((pattern) => pattern.test(normalized))) return true;

  if (options?.ignoreTests && testFilePatterns.some((pattern) => pattern.test(normalized))) return true;

  if (matchesPatterns(gitignorePatterns, normalized)) return true;
  if (matchesPatterns(reposightignorePatterns, normalized)) return true;

  return false;
}

export function isGeneratedFile(filePath: string): boolean {
  const normalized = filePath.split(path.sep).join("/");
  return generatedFilePatterns.some((pattern) => pattern.test(normalized));
}

export function isTestFilePath(filePath: string): boolean {
  const normalized = filePath.split(path.sep).join("/");
  return testFilePatterns.some((pattern) => pattern.test(normalized));
}

let includePatterns: string[] = [];
let excludePatterns: string[] = [];

export function setIncludeExcludePatterns(include: string[], exclude: string[]): void {
  includePatterns = include;
  excludePatterns = exclude;
}

function matchesGlobPatterns(patterns: string[], normalizedPath: string): boolean {
  if (patterns.length === 0) return false;

  for (const pattern of patterns) {
    const regex = gitignoreToRegex(pattern);
    if (regex.test(normalizedPath)) return true;
  }
  return false;
}

export function shouldIncludePath(relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join("/");

  if (excludePatterns.length > 0 && matchesGlobPatterns(excludePatterns, normalized)) {
    return false;
  }

  if (includePatterns.length > 0) {
    return matchesGlobPatterns(includePatterns, normalized);
  }

  return true;
}
