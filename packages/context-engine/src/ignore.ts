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
  /\.spec\.(ts|tsx|js|py|go|rs)$/,
  /\.test\.(ts|tsx|js|py|go|rs)$/,
  /_test\.(go|py|rs)$/,
  /_test\.go$/,
  /_spec\.rb$/,
  /\.spec\.java$/,
  /Test\.java$/,
  /Tests\.java$/,
  /_test\.java$/,
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

let gitignorePatterns: RegExp[] = [];
let repolensignorePatterns: RegExp[] = [];

function parseIgnoreFile(content: string): RegExp[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((pattern) => {
      const escaped = pattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".");
      if (escaped.endsWith("/")) {
        return new RegExp(`(^|/)${escaped}.*`);
      }
      return new RegExp(`(^|/)${escaped}(/|$)`);
    });
}

export function loadIgnoreFiles(rootDir: string): void {
  gitignorePatterns = [];
  repolensignorePatterns = [];

  const gitignorePath = path.join(rootDir, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    try {
      const content = fs.readFileSync(gitignorePath, "utf8");
      gitignorePatterns = parseIgnoreFile(content);
    } catch {
      gitignorePatterns = [];
    }
  }

  const repolensignorePath = path.join(rootDir, ".repolensignore");
  if (fs.existsSync(repolensignorePath)) {
    try {
      const content = fs.readFileSync(repolensignorePath, "utf8");
      repolensignorePatterns = parseIgnoreFile(content);
    } catch {
      repolensignorePatterns = [];
    }
  }
}

export function shouldIgnorePath(relativePath: string, options?: { ignoreTests?: boolean }): boolean {
  const parts = relativePath.split(path.sep).filter(Boolean);
  if (parts.some((part) => ignoredDirectories.has(part))) return true;

  const normalized = relativePath.split(path.sep).join("/");
  if (ignoredFilePatterns.some((pattern) => pattern.test(normalized))) return true;

  if (options?.ignoreTests && testFilePatterns.some((pattern) => pattern.test(normalized))) return true;

  for (const pattern of gitignorePatterns) {
    if (pattern.test(normalized)) return true;
  }

  for (const pattern of repolensignorePatterns) {
    if (pattern.test(normalized)) return true;
  }

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
