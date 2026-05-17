import path from "node:path";

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

export function shouldIgnorePath(relativePath: string): boolean {
  const parts = relativePath.split(path.sep).filter(Boolean);
  if (parts.some((part) => ignoredDirectories.has(part))) return true;

  const normalized = relativePath.split(path.sep).join("/");
  return ignoredFilePatterns.some((pattern) => pattern.test(normalized));
}
