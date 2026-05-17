import { extname } from "node:path";

const extensionToLanguage: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".js": "javascript",
  ".jsx": "javascriptreact",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".mdx": "mdx",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".cs": "csharp",
  ".php": "php",
  ".rb": "ruby",
  ".swift": "swift",
  ".vue": "vue",
  ".svelte": "svelte",
  ".css": "css",
  ".scss": "scss",
  ".html": "html",
  ".yml": "yaml",
  ".yaml": "yaml"
};

export function languageFromPath(filePath: string): string {
  return extensionToLanguage[extname(filePath).toLowerCase()] ?? "text";
}

export function isLikelyTextFile(filePath: string): boolean {
  const language = languageFromPath(filePath);
  if (language !== "text") return true;

  return /(^|\/)(Dockerfile|Makefile|Procfile|LICENSE|NOTICE)$/i.test(filePath);
}
