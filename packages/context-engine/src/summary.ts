import type { CodeSymbol } from "@reposight/shared";

export function generateHeuristicSummary(
  filePath: string,
  symbols: CodeSymbol[],
  imports: string[],
  fileComment?: string
): string {
  const name = filePath.split("/").pop() ?? filePath;
  const ext = name.split(".").pop()?.toLowerCase();
  const dirParts = filePath.split("/").slice(0, -1);
  const parentDir = dirParts[dirParts.length - 1] ?? "root";

  const functionNames = symbols.filter((s) => s.kind === "function").map((s) => s.name);
  const classNames = symbols.filter((s) => s.kind === "class").map((s) => s.name);
  const interfaceNames = symbols.filter((s) => s.kind === "interface").map((s) => s.name);
  const methodNames = symbols.filter((s) => s.kind === "method").map((s) => s.name);

  const parts: string[] = [];

  // Use file-level comment if available
  if (fileComment) {
    parts.push(fileComment);
  } else if (filePath.includes("index")) {
    parts.push(`Entry point for the ${parentDir} module`);
  } else if (filePath.includes("test") || filePath.includes("spec")) {
    parts.push(`Test file for ${name.replace(/\.test\.\w+/, "").replace(/\.spec\.\w+/, "")}`);
  } else if (filePath.includes("config")) {
    parts.push(`Configuration definitions`);
  } else if (filePath.includes("types")) {
    parts.push(`Type definitions and interfaces`);
  } else if (filePath.includes("utils") || filePath.includes("helpers")) {
    parts.push(`Utility functions`);
  } else if (filePath.includes("components")) {
    parts.push(`UI component`);
  } else if (filePath.includes("services")) {
    parts.push(`Service layer module`);
  } else if (filePath.includes("models") || filePath.includes("db")) {
    parts.push(`Data model definitions`);
  } else if (filePath.includes("hooks")) {
    parts.push(`Custom React hook`);
  } else if (filePath.includes("middleware")) {
    parts.push(`Middleware handler`);
  } else if (filePath.includes("controller") || filePath.includes("handler")) {
    parts.push(`Request handler`);
  }

  // Add symbol details with comments
  const symbolsWithComments = symbols.filter((s) => s.comment);
  if (symbolsWithComments.length > 0) {
    const topComments = symbolsWithComments.slice(0, 3).map((s) => `${s.name}: ${s.comment}`);
    parts.push(topComments.join(". "));
  } else {
    if (classNames.length > 0) {
      parts.push(`Defines ${classNames.length > 1 ? "classes" : "class"}: ${classNames.slice(0, 3).join(", ")}`);
    }
    if (interfaceNames.length > 0) {
      parts.push(`Defines ${interfaceNames.length > 1 ? "interfaces" : "interface"}: ${interfaceNames.slice(0, 3).join(", ")}`);
    }
    if (functionNames.length > 0) {
      parts.push(`Exports ${functionNames.length > 1 ? "functions" : "function"}: ${functionNames.slice(0, 3).join(", ")}`);
    }
    if (methodNames.length > 0 && classNames.length === 0) {
      parts.push(`Contains methods: ${methodNames.slice(0, 3).join(", ")}`);
    }
  }

  // Add import details
  const externalImports = imports.filter((i) => !i.startsWith("."));
  const internalImports = imports.filter((i) => i.startsWith("."));

  if (externalImports.length > 0) {
    parts.push(`Depends on external packages: ${externalImports.slice(0, 3).join(", ")}`);
  }
  if (internalImports.length > 0) {
    parts.push(`Imports from ${internalImports.length} internal module${internalImports.length > 1 ? "s" : ""}`);
  }

  // Fallback for files with no symbols
  if (parts.length === 0) {
    if (ext === "json") {
      parts.push(`JSON configuration or data file`);
    } else if (ext === "md" || ext === "mdx") {
      parts.push(`Documentation file`);
    } else if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") {
      parts.push(`Source file in ${parentDir} directory`);
    } else {
      parts.push(`${ext?.toUpperCase() ?? "Unknown"} file`);
    }
  }

  return parts.join(". ") + ".";
}
