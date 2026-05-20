#!/usr/bin/env node

// packages/shared/dist/config.js
function envValue(env, key, fallback) {
  const value = env[key];
  return value && value.trim().length > 0 ? value : fallback;
}
function envNumber(env, key, fallback) {
  const raw = env[key];
  if (!raw)
    return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function envLogLevel(env) {
  const value = envValue(env, "REPOLENS_LOG_LEVEL", "info");
  return value === "debug" || value === "warn" || value === "error" ? value : "info";
}
function normalizeServerUrl(url) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
function readConfigFromEnv(env = process.env) {
  return {
    logLevel: envLogLevel(env),
    aiProviderBaseUrl: normalizeServerUrl(envValue(env, "AI_PROVIDER_BASE_URL", "https://api.openai.com/v1")),
    aiProviderApiKey: env.AI_PROVIDER_API_KEY,
    aiProviderModel: envValue(env, "AI_PROVIDER_MODEL", "gpt-4o-mini"),
    maxContextFiles: envNumber(env, "REPOLENS_MAX_CONTEXT_FILES", 80),
    maxContextBytes: envNumber(env, "REPOLENS_MAX_CONTEXT_BYTES", 12e4),
    maxTokenBudget: envNumber(env, "REPOLENS_MAX_TOKEN_BUDGET", 1e5),
    includeMermaid: env.REPOLENS_INCLUDE_MERMAID !== "false",
    maxFileBytes: envNumber(env, "REPOLENS_MAX_FILE_BYTES", 8e4),
    maxChunkChars: envNumber(env, "REPOLENS_MAX_CHUNK_CHARS", 6e3)
  };
}
async function loadConfigFile(rootDir) {
  const fs6 = await import("node:fs/promises");
  const path10 = await import("node:path");
  const configPath = path10.join(rootDir, ".reposightrc.json");
  try {
    const content = await fs6.readFile(configPath, "utf8");
    const parsed = JSON.parse(content);
    return validateConfig(parsed);
  } catch {
    return null;
  }
}
function validateConfig(config) {
  if (typeof config !== "object" || config === null) {
    return {};
  }
  const obj = config;
  const validated = {};
  if ("logLevel" in obj) {
    if (typeof obj.logLevel === "string" && ["debug", "info", "warn", "error"].includes(obj.logLevel)) {
      validated.logLevel = obj.logLevel;
    }
  }
  if ("aiProviderBaseUrl" in obj) {
    if (typeof obj.aiProviderBaseUrl === "string") {
      validated.aiProviderBaseUrl = obj.aiProviderBaseUrl;
    }
  }
  if ("aiProviderApiKey" in obj) {
    if (typeof obj.aiProviderApiKey === "string") {
      validated.aiProviderApiKey = obj.aiProviderApiKey;
    }
  }
  if ("aiProviderModel" in obj) {
    if (typeof obj.aiProviderModel === "string") {
      validated.aiProviderModel = obj.aiProviderModel;
    }
  }
  if ("maxContextFiles" in obj) {
    if (typeof obj.maxContextFiles === "number" && obj.maxContextFiles > 0) {
      validated.maxContextFiles = obj.maxContextFiles;
    }
  }
  if ("maxContextBytes" in obj) {
    if (typeof obj.maxContextBytes === "number" && obj.maxContextBytes > 0) {
      validated.maxContextBytes = obj.maxContextBytes;
    }
  }
  if ("maxTokenBudget" in obj) {
    if (typeof obj.maxTokenBudget === "number" && obj.maxTokenBudget > 0) {
      validated.maxTokenBudget = obj.maxTokenBudget;
    }
  }
  if ("includeMermaid" in obj) {
    if (typeof obj.includeMermaid === "boolean") {
      validated.includeMermaid = obj.includeMermaid;
    }
  }
  if ("maxFileBytes" in obj) {
    if (typeof obj.maxFileBytes === "number" && obj.maxFileBytes > 0) {
      validated.maxFileBytes = obj.maxFileBytes;
    }
  }
  if ("maxChunkChars" in obj) {
    if (typeof obj.maxChunkChars === "number" && obj.maxChunkChars > 0) {
      validated.maxChunkChars = obj.maxChunkChars;
    }
  }
  return validated;
}
function mergeConfig(fileConfig, envConfig) {
  if (!fileConfig)
    return envConfig;
  return {
    logLevel: fileConfig.logLevel ?? envConfig.logLevel,
    aiProviderBaseUrl: fileConfig.aiProviderBaseUrl ?? envConfig.aiProviderBaseUrl,
    aiProviderApiKey: fileConfig.aiProviderApiKey ?? envConfig.aiProviderApiKey,
    aiProviderModel: fileConfig.aiProviderModel ?? envConfig.aiProviderModel,
    maxContextFiles: fileConfig.maxContextFiles ?? envConfig.maxContextFiles,
    maxContextBytes: fileConfig.maxContextBytes ?? envConfig.maxContextBytes,
    maxTokenBudget: fileConfig.maxTokenBudget ?? envConfig.maxTokenBudget,
    includeMermaid: fileConfig.includeMermaid ?? envConfig.includeMermaid,
    maxFileBytes: fileConfig.maxFileBytes ?? envConfig.maxFileBytes,
    maxChunkChars: fileConfig.maxChunkChars ?? envConfig.maxChunkChars
  };
}

// packages/shared/dist/env.js
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
function parseEnvFile(filePath) {
  if (!existsSync(filePath))
    return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#"))
      continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1)
      continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === void 0) {
      process.env[key] = value;
    }
  }
}
function loadEnv(metaUrl) {
  let dir = dirname(fileURLToPath(metaUrl));
  for (let i = 0; i < 5; i++) {
    const envFile = resolve(dir, ".env");
    if (existsSync(envFile)) {
      parseEnvFile(envFile);
      return;
    }
    dir = resolve(dir, "..");
  }
  parseEnvFile(resolve(process.cwd(), ".env"));
}

// packages/shared/dist/errors.js
var RepoLensError = class extends Error {
  code;
  statusCode;
  constructor(message, code, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = "RepoLensError";
  }
};
function errorMessage(error) {
  if (error instanceof Error)
    return error.message;
  return String(error);
}

// packages/shared/dist/json.js
function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return void 0;
  }
}

// packages/shared/dist/logger.js
var levelPriority = { debug: 0, info: 1, warn: 2, error: 3 };
function createLogger(name, level = "info") {
  const minLevel = levelPriority[level] ?? 1;
  function log2(lvl, msg, data) {
    if (levelPriority[lvl] < minLevel)
      return;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const payload = data ? ` ${JSON.stringify(data)}` : "";
    const line = `${timestamp} [${lvl.toUpperCase()}] ${name}: ${msg}${payload}`;
    if (lvl === "error")
      process.stderr.write(line + "\n");
    else
      process.stdout.write(line + "\n");
  }
  return {
    debug: (msg, data) => log2("debug", msg, data),
    info: (msg, data) => log2("info", msg, data),
    warn: (msg, data) => log2("warn", msg, data),
    error: (msg, data) => log2("error", msg, data)
  };
}

// apps/cli/src/index.ts
import process2 from "node:process";
import { writeFile, mkdir, rm, readFile as fsReadFile, copyFile, stat as fsStat } from "node:fs/promises";
import path9, { join, dirname as dirname2 } from "node:path";
import { execFile as execFile2 } from "node:child_process";
import { promisify as promisify2 } from "node:util";
import { createServer } from "node:http";
import { Command } from "commander";

// packages/context-engine/dist/cache.js
var DEFAULT_MAX_ENTRIES = 500;
var FileCache = class {
  entries = /* @__PURE__ */ new Map();
  maxEntries;
  hits = 0;
  misses = 0;
  constructor(options) {
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }
  get(absolutePath, mtimeMs, size) {
    const entry = this.entries.get(absolutePath);
    if (!entry || entry.mtimeMs !== mtimeMs || entry.size !== size) {
      this.misses += 1;
      return null;
    }
    entry.lastAccess = Date.now();
    this.hits += 1;
    return entry;
  }
  set(absolutePath, mtimeMs, size, content, symbols, fileComment) {
    if (this.entries.size >= this.maxEntries) {
      this.evictOldest();
    }
    this.entries.set(absolutePath, { content, symbols, fileComment, mtimeMs, size, lastAccess: Date.now() + this.entries.size });
  }
  invalidate(absolutePath) {
    this.entries.delete(absolutePath);
  }
  clear() {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
  }
  getStats() {
    const total = this.hits + this.misses;
    return {
      entries: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0
    };
  }
  evictOldest() {
    let oldestKey;
    let oldestTime = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }
    if (oldestKey)
      this.entries.delete(oldestKey);
  }
};

// packages/context-engine/dist/chunker.js
function chunkFile(file, maxChunkChars = 6e3) {
  if (file.content.length <= maxChunkChars) {
    return [{ ...file, chunkIndex: 1, totalChunks: 1 }];
  }
  const lines = file.content.split(/\r?\n/);
  const chunks = [];
  let current = [];
  let currentLength = 0;
  let startLine = 1;
  for (const [index, line] of lines.entries()) {
    const lineLength = line.length + 1;
    if (current.length > 0 && currentLength + lineLength > maxChunkChars) {
      chunks.push({
        ...file,
        content: current.join("\n"),
        startLine,
        endLine: startLine + current.length - 1,
        chunkIndex: chunks.length + 1
      });
      current = [];
      currentLength = 0;
      startLine = index + 1;
    }
    current.push(line);
    currentLength += lineLength;
  }
  if (current.length > 0) {
    chunks.push({
      ...file,
      content: current.join("\n"),
      startLine,
      endLine: lines.length,
      chunkIndex: chunks.length + 1
    });
  }
  const totalChunks = chunks.length;
  return chunks.map((chunk) => ({ ...chunk, totalChunks }));
}

// packages/context-engine/dist/ignore.js
import path from "node:path";
import fs from "node:fs";
var ignoredDirectories = /* @__PURE__ */ new Set([
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
var ignoredFilePatterns = [
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)bun\.lockb$/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.log$/,
  /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|gz|tar|tgz|mp4|mov|woff2?|ttf|eot)$/i
];
var generatedFilePatterns = [
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
  /\.fixture\.(ts|tsx|js)$/
];
var testFilePatterns = [
  /\.test\.(ts|tsx|js|jsx|py|go|rs)$/,
  /\.spec\.(ts|tsx|js|jsx|py|go|rs)$/,
  /_test\.(go|py|rs)$/,
  /_spec\.rb$/,
  /Test\.java$/,
  /Tests\.java$/,
  /^test_/,
  /^tests\//,
  /\/tests?\//
];
var gitignorePatterns = [];
var reposightignorePatterns = [];
function gitignoreToRegex(pattern) {
  const hasSlash = pattern.includes("/");
  const isDir = pattern.endsWith("/");
  const isAnchored = pattern.startsWith("/");
  let core = pattern.replace(/^\//, "").replace(/\/$/, "").replace(/\./g, "\\.").replace(/\+/g, "\\+").replace(/\?/g, "[^/]").replace(/\*\*\//g, "(.+/)?").replace(/\*/g, "[^/]*");
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
function parseIgnoreFile(content) {
  const patterns = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#"))
      continue;
    const negated = trimmed.startsWith("!");
    const pattern = negated ? trimmed.slice(1) : trimmed;
    const regex = gitignoreToRegex(pattern);
    patterns.push({ regex, negated });
  }
  return patterns;
}
function matchesPatterns(patterns, normalizedPath) {
  let result = false;
  for (const { regex, negated } of patterns) {
    if (regex.test(normalizedPath)) {
      result = !negated;
    }
  }
  return result;
}
function loadIgnoreFiles(rootDir) {
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
function shouldIgnorePath(relativePath, options) {
  const parts = relativePath.split(path.sep).filter(Boolean);
  if (parts.some((part) => ignoredDirectories.has(part)))
    return true;
  const normalized = relativePath.split(path.sep).join("/");
  if (ignoredFilePatterns.some((pattern) => pattern.test(normalized)))
    return true;
  if (options?.ignoreTests && testFilePatterns.some((pattern) => pattern.test(normalized)))
    return true;
  if (matchesPatterns(gitignorePatterns, normalized))
    return true;
  if (matchesPatterns(reposightignorePatterns, normalized))
    return true;
  return false;
}
function isGeneratedFile(filePath) {
  const normalized = filePath.split(path.sep).join("/");
  return generatedFilePatterns.some((pattern) => pattern.test(normalized));
}
var includePatterns = [];
var excludePatterns = [];
function setIncludeExcludePatterns(include, exclude) {
  includePatterns = include;
  excludePatterns = exclude;
}
function matchesGlobPatterns(patterns, normalizedPath) {
  if (patterns.length === 0)
    return false;
  for (const pattern of patterns) {
    const regex = gitignoreToRegex(pattern);
    if (regex.test(normalizedPath))
      return true;
  }
  return false;
}
function shouldIncludePath(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  if (excludePatterns.length > 0 && matchesGlobPatterns(excludePatterns, normalized)) {
    return false;
  }
  if (includePatterns.length > 0) {
    return matchesGlobPatterns(includePatterns, normalized);
  }
  return true;
}

// packages/context-engine/dist/language.js
import { extname } from "node:path";
var extensionToLanguage = {
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
function languageFromPath(filePath) {
  return extensionToLanguage[extname(filePath).toLowerCase()] ?? "text";
}
function isLikelyTextFile(filePath) {
  const language = languageFromPath(filePath);
  if (language !== "text")
    return true;
  return /(^|\/)(Dockerfile|Makefile|Procfile|LICENSE|NOTICE)$/i.test(filePath);
}

// packages/context-engine/dist/symbol-extractor.js
import ts from "typescript";
var MAX_SYMBOLS = 60;
var PYTHON_FUNC_RE = /^(\s*)def\s+(\w+)\s*\(/gm;
var PYTHON_CLASS_RE = /^(\s*)class\s+(\w+)\s*[:\(]/gm;
var PYTHON_IMPORT_RE = /^(?:from\s+(\S+)\s+)?import\s+(.+)/gm;
var GO_FUNC_RE = /^func\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?(\w+)\s*\(/gm;
var GO_STRUCT_RE = /^type\s+(\w+)\s+struct\s*\{/gm;
var GO_INTERFACE_RE = /^type\s+(\w+)\s+interface\s*\{/gm;
var GO_IMPORT_RE = /^import\s+(?:\(\n([\s\S]*?)\n\)|"([^"]+)")/gm;
var RUST_FN_RE = /^\s*(?:pub\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(/gm;
var RUST_STRUCT_RE = /^(?:pub\s+)?struct\s+(\w+)\s*(?:<[^>]*>)?\s*\{/gm;
var RUST_ENUM_RE = /^(?:pub\s+)?enum\s+(\w+)\s*(?:<[^>]*>)?\s*\{/gm;
var RUST_TRAIT_RE = /^(?:pub\s+)?trait\s+(\w+)\s*(?:<[^>]*>)?\s*\{/gm;
var RUST_IMPL_RE = /^(?:pub\s+)?impl\s+(?:<[^>]*>\s+)?(\w+)(?:<[^>]*>)?\s*(?:for\s+\w+)?\s*\{/gm;
var RUST_IMPORT_RE = /^(?:pub\s+)?use\s+(.+);/gm;
var RUST_MOD_RE = /^(?:pub\s+)?mod\s+(\w+);/gm;
var JAVA_CLASS_RE = /^(?:public\s+|abstract\s+|final\s+)*(?:class|interface|enum)\s+(\w+)/gm;
var JAVA_METHOD_RE = /^\s*(?:public|private|protected|static|final|abstract|synchronized|\s)+[\w<>\[\],\s]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/gm;
var JAVA_IMPORT_RE = /^import\s+(static\s+)?([\w.*]+);/gm;
function extractLeadingComment(source, lines, symbolLine) {
  if (symbolLine <= 1)
    return void 0;
  const commentLines = [];
  for (let i = symbolLine - 2; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line)
      break;
    if (line.startsWith("//")) {
      commentLines.unshift(line.slice(2).trim());
    } else if (line.startsWith("*/")) {
      commentLines.unshift(line.slice(0, -2).replace(/^\*\s?/, "").trim());
      i--;
      while (i >= 0 && !lines[i].trim().startsWith("/*")) {
        const inner = lines[i].trim().replace(/^\*\s?/, "");
        if (inner)
          commentLines.unshift(inner);
        i--;
      }
      if (i >= 0) {
        const startLine = lines[i].trim();
        if (startLine.startsWith("/*")) {
          const inner = startLine.slice(2).replace(/^\*/, "").trim();
          if (inner)
            commentLines.unshift(inner);
        }
      }
      break;
    } else if (line.startsWith("/*")) {
      commentLines.unshift(line.slice(2).replace(/^\*\s?/, "").trim());
      break;
    } else if (line.startsWith("*") || line.startsWith("* ")) {
      commentLines.unshift(line.replace(/^\*\s?/, "").trim());
    } else if (line.startsWith('"""') || line.startsWith("'''")) {
      const quote = line.slice(0, 3);
      const content = line.replace(/^['"]{3}|['"]{3}$/g, "").trim();
      if (content)
        commentLines.unshift(content);
      break;
    } else {
      break;
    }
  }
  const comment = commentLines.filter(Boolean).join(" ").trim();
  return comment.length > 0 ? comment : void 0;
}
function extractPythonSymbols(source) {
  const symbols = [];
  const classStack = [];
  const lines = source.split("\n");
  let match;
  while ((match = PYTHON_CLASS_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS)
      break;
    const indent = match[1]?.length ?? 0;
    const name = match[2];
    const lineNum = getLineNumber(source, match.index);
    while (classStack.length > 0 && classStack[classStack.length - 1].indent >= indent) {
      classStack.pop();
    }
    symbols.push({ name, kind: "class", line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
    classStack.push({ name, indent });
  }
  while ((match = PYTHON_FUNC_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS)
      break;
    const indent = match[1]?.length ?? 0;
    const name = match[2];
    const lineNum = getLineNumber(source, match.index);
    const parentClass = [...classStack].reverse().find((c) => c.indent < indent);
    const kind = parentClass ? "method" : "function";
    symbols.push({ name, kind, line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
  }
  return symbols.slice(0, MAX_SYMBOLS);
}
function countLeadingSpaces(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}
function getLineNumber(source, index) {
  let lineNum = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === "\n")
      lineNum++;
  }
  return lineNum;
}
function getLineContent(source, lines, index) {
  let lineNum = 0;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === "\n")
      lineNum++;
  }
  if (lineNum < lines.length && lines[lineNum].trim() === "" && lineNum + 1 < lines.length) {
    lineNum++;
  }
  return lines[lineNum] || "";
}
function extractPythonImports(source) {
  const imports = [];
  let match;
  while ((match = PYTHON_IMPORT_RE.exec(source)) !== null) {
    if (match[1]) {
      imports.push(match[1]);
    }
    if (match[2]) {
      const parts = match[2].split(",").map((p) => p.trim());
      for (const part of parts) {
        const importName = part.split(" as ")[0]?.trim() ?? part;
        if (importName && !importName.includes("*") && !importName.includes("(")) {
          imports.push(importName);
        }
      }
    }
  }
  return [...new Set(imports)];
}
function extractGoSymbols(source) {
  const symbols = [];
  const structStack = [];
  const interfaceStack = [];
  const lines = source.split("\n");
  let match;
  while ((match = GO_STRUCT_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS)
      break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    const lineContent = getLineContent(source, lines, match.index);
    const indent = countLeadingSpaces(lineContent);
    symbols.push({ name, kind: "class", line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
    structStack.push({ name, indent });
  }
  while ((match = GO_INTERFACE_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS)
      break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    const lineContent = getLineContent(source, lines, match.index);
    const indent = countLeadingSpaces(lineContent);
    symbols.push({ name, kind: "interface", line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
    interfaceStack.push({ name, indent });
  }
  while ((match = GO_FUNC_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS)
      break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    const lineContent = getLineContent(source, lines, match.index);
    const indent = countLeadingSpaces(lineContent);
    const isMethod = lineContent.includes("func (") && lineContent.includes(") ");
    const inStruct = structStack.some((s) => s.indent < indent);
    const inInterface = interfaceStack.some((s) => s.indent < indent);
    const kind = isMethod || inStruct || inInterface ? "method" : "function";
    symbols.push({ name, kind, line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
  }
  return symbols.slice(0, MAX_SYMBOLS);
}
function extractGoImports(source) {
  const imports = [];
  let match;
  while ((match = GO_IMPORT_RE.exec(source)) !== null) {
    if (match[1]) {
      const lines = match[1].split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("//"))
          continue;
        const importPath = trimmed.replace(/"/g, "").split(" ")[0];
        if (importPath)
          imports.push(importPath);
      }
    }
    if (match[2]) {
      imports.push(match[2]);
    }
  }
  return [...new Set(imports)];
}
function extractRustSymbols(source) {
  const symbols = [];
  const implBlocks = [];
  const lines = source.split("\n");
  let match;
  while ((match = RUST_STRUCT_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS)
      break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    symbols.push({ name, kind: "class", line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
  }
  while ((match = RUST_ENUM_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS)
      break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    symbols.push({ name, kind: "type", line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
  }
  while ((match = RUST_TRAIT_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS)
      break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    symbols.push({ name, kind: "interface", line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
  }
  while ((match = RUST_IMPL_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS)
      break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    const lineContent = getLineContent(source, lines, match.index);
    const indent = countLeadingSpaces(lineContent);
    implBlocks.push({ name, indent, startPos: match.index });
  }
  while ((match = RUST_FN_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS)
      break;
    const name = match[1];
    const fnIndex = match.index;
    const lineNum = getLineNumber(source, fnIndex);
    const lineContent = getLineContent(source, lines, fnIndex);
    const indent = countLeadingSpaces(lineContent);
    const parentImpl = [...implBlocks].reverse().find((impl) => impl.startPos < fnIndex && impl.indent < indent);
    const kind = parentImpl ? "method" : "function";
    symbols.push({ name, kind, line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
  }
  return symbols.slice(0, MAX_SYMBOLS);
}
function extractRustImports(source) {
  const imports = [];
  let match;
  while ((match = RUST_IMPORT_RE.exec(source)) !== null) {
    const importPath = match[1].trim();
    const parts = importPath.split("::");
    if (parts.length > 0) {
      imports.push(parts.join("::"));
    }
  }
  while ((match = RUST_MOD_RE.exec(source)) !== null) {
    imports.push(match[1]);
  }
  return [...new Set(imports)];
}
function extractJavaSymbols(source) {
  const symbols = [];
  const classStack = [];
  const lines = source.split("\n");
  let match;
  while ((match = JAVA_CLASS_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS)
      break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    const lineContent = getLineContent(source, lines, match.index);
    const indent = countLeadingSpaces(lineContent);
    while (classStack.length > 0 && classStack[classStack.length - 1].indent >= indent) {
      classStack.pop();
    }
    const fullMatch = match[0];
    const kind = fullMatch.includes("interface") ? "interface" : fullMatch.includes("enum") ? "type" : "class";
    symbols.push({ name, kind, line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
    classStack.push({ name, indent });
  }
  while ((match = JAVA_METHOD_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS)
      break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    const lineContent = getLineContent(source, lines, match.index);
    const indent = countLeadingSpaces(lineContent);
    const inClass = classStack.some((c) => c.indent < indent);
    const kind = inClass ? "method" : "function";
    symbols.push({ name, kind, line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
  }
  return symbols.slice(0, MAX_SYMBOLS);
}
function extractJavaImports(source) {
  const imports = [];
  let match;
  while ((match = JAVA_IMPORT_RE.exec(source)) !== null) {
    const isStatic = !!match[1];
    const importPath = match[2].trim();
    if (!isStatic && importPath.startsWith("java.lang.")) {
      continue;
    }
    imports.push(importPath);
  }
  return [...new Set(imports)];
}
function getSymbolKind(node) {
  if (ts.isFunctionDeclaration(node))
    return "function";
  if (ts.isClassDeclaration(node))
    return "class";
  if (ts.isInterfaceDeclaration(node))
    return "interface";
  if (ts.isTypeAliasDeclaration(node))
    return "type";
  if (ts.isEnumDeclaration(node))
    return "type";
  if (ts.isMethodDeclaration(node))
    return "method";
  if (ts.isPropertyDeclaration(node))
    return "method";
  if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      if (decl.initializer && (ts.isFunctionExpression(decl.initializer) || ts.isArrowFunction(decl.initializer))) {
        return "function";
      }
    }
  }
  return void 0;
}
function getNodeName(node) {
  if (ts.isFunctionDeclaration(node))
    return node.name?.text;
  if (ts.isClassDeclaration(node))
    return node.name?.text;
  if (ts.isInterfaceDeclaration(node))
    return node.name.text;
  if (ts.isTypeAliasDeclaration(node))
    return node.name.text;
  if (ts.isEnumDeclaration(node))
    return node.name.text;
  if (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node)) {
    if (ts.isIdentifier(node.name))
      return node.name.text;
    if (ts.isStringLiteral(node.name))
      return node.name.text;
  }
  if (ts.isVariableStatement(node)) {
    const names = [];
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name))
        names.push(decl.name.text);
    }
    return names.join(", ");
  }
  return void 0;
}
function extractLeadingTsComment(sourceFile, node) {
  const fullText = sourceFile.getFullText();
  const comments = ts.getLeadingCommentRanges(fullText, node.getFullStart());
  if (!comments || comments.length === 0)
    return void 0;
  const parts = [];
  for (const comment2 of comments) {
    const text = fullText.slice(comment2.pos, comment2.end);
    if (comment2.kind === ts.SyntaxKind.SingleLineCommentTrivia) {
      parts.push(text.replace(/^\/\/\s?/, "").trim());
    } else if (comment2.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
      const cleaned = text.replace(/^\/\*+|\*+\/$/g, "").split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim()).filter(Boolean).join(" ");
      parts.push(cleaned);
    }
  }
  const comment = parts.join(" ").trim();
  return comment.length > 0 ? comment : void 0;
}
function extractSymbolsFromNode(node, source, symbols) {
  if (symbols.length >= MAX_SYMBOLS)
    return;
  ts.forEachChild(node, (child) => {
    if (symbols.length >= MAX_SYMBOLS)
      return;
    const kind = getSymbolKind(child);
    const name = getNodeName(child);
    if (kind && name) {
      const { line } = source.getLineAndCharacterOfPosition(child.getStart(source));
      symbols.push({ name, kind, line: line + 1, comment: extractLeadingTsComment(source, child) });
    }
    if (ts.isClassDeclaration(child) || ts.isInterfaceDeclaration(child)) {
      extractSymbolsFromNode(child, source, symbols);
    }
  });
}
function extractImports(source) {
  const imports = [];
  ts.forEachChild(source, (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
  });
  return imports;
}
function extractSymbols(source, language) {
  if (language === "python") {
    return extractPythonSymbols(source);
  }
  if (language === "go") {
    return extractGoSymbols(source);
  }
  if (language === "rust") {
    return extractRustSymbols(source);
  }
  if (language === "java") {
    return extractJavaSymbols(source);
  }
  if (!["typescript", "typescriptreact", "javascript", "javascriptreact"].includes(language)) {
    return [];
  }
  const fileName = language.includes("react") ? "file.tsx" : "file.ts";
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false);
  const symbols = [];
  extractSymbolsFromNode(sourceFile, sourceFile, symbols);
  return symbols;
}
function extractImportsFromSource(source, language) {
  if (language === "python") {
    return extractPythonImports(source);
  }
  if (language === "go") {
    return extractGoImports(source);
  }
  if (language === "rust") {
    return extractRustImports(source);
  }
  if (language === "java") {
    return extractJavaImports(source);
  }
  if (!["typescript", "typescriptreact", "javascript", "javascriptreact"].includes(language)) {
    return [];
  }
  const fileName = language.includes("react") ? "file.tsx" : "file.ts";
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false);
  return extractImports(sourceFile);
}

// packages/context-engine/dist/import-graph.js
import path2 from "node:path";
import fs2 from "node:fs/promises";
async function findPackageJsonFiles(rootDir) {
  const packageJsons = [];
  async function walk(dir, depth) {
    if (depth > 3)
      return;
    try {
      const entries = await fs2.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name.startsWith("."))
          continue;
        const absolutePath = path2.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(absolutePath, depth + 1);
        } else if (entry.name === "package.json") {
          packageJsons.push(absolutePath);
        }
      }
    } catch {
    }
  }
  await walk(rootDir, 0);
  return packageJsons;
}
async function parsePackageJson(filePath) {
  try {
    const content = await fs2.readFile(filePath, "utf8");
    const pkg = JSON.parse(content);
    const location = path2.dirname(filePath);
    const deps = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {})
    ];
    return {
      name: pkg.name ?? path2.basename(location),
      location,
      dependencies: deps
    };
  } catch {
    return null;
  }
}
async function discoverPackages(rootDir) {
  const packages = /* @__PURE__ */ new Map();
  const packageJsons = await findPackageJsonFiles(rootDir);
  for (const pkgJson of packageJsons) {
    const info = await parsePackageJson(pkgJson);
    if (info) {
      packages.set(info.name, info);
    }
  }
  return packages;
}
function resolveImportPath(importerDir, importSpecifier, rootDir) {
  if (importSpecifier.startsWith(".") || importSpecifier.startsWith("/")) {
    const resolved = path2.resolve(importerDir, importSpecifier);
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"];
    for (const ext of extensions) {
      const candidate = resolved + ext;
      const relative = path2.relative(rootDir, candidate).split(path2.sep).join("/");
      if (relative.length > 0 && !relative.startsWith("..")) {
        return candidate;
      }
    }
    return null;
  }
  if (!importSpecifier.startsWith(".") && !importSpecifier.startsWith("/")) {
    const relative = importSpecifier.split(path2.sep).join("/");
    return relative;
  }
  return null;
}
async function buildImportGraph(files, rootDir) {
  const nodes = /* @__PURE__ */ new Map();
  const relativeToAbsolute = /* @__PURE__ */ new Map();
  const packages = await discoverPackages(rootDir);
  const externalDeps = /* @__PURE__ */ new Set();
  const packageLocations = /* @__PURE__ */ new Map();
  for (const [name, info] of packages) {
    packageLocations.set(name, info.location);
  }
  for (const file of files) {
    const node = {
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
    const importerDir = path2.dirname(file.absolutePath);
    for (const importSpec of file.imports) {
      let resolved = null;
      if (importSpec.startsWith(".") || importSpec.startsWith("/")) {
        resolved = resolveImportPath(importerDir, importSpec, rootDir);
      } else {
        const pkgName = importSpec.startsWith("@") ? importSpec.split("/").slice(0, 2).join("/") : importSpec.split("/")[0] ?? importSpec;
        const pkgLocation = packageLocations.get(pkgName);
        if (pkgLocation) {
          const pkgRelative = path2.relative(rootDir, pkgLocation).split(path2.sep).join("/");
          resolved = pkgRelative;
        } else {
          externalDeps.add(pkgName);
          continue;
        }
      }
      if (!resolved)
        continue;
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
function getTransitiveImportScore(graph, absolutePath, maxDepth = 2) {
  const visited = /* @__PURE__ */ new Set();
  let score = 0;
  function traverse(currentPath, depth) {
    if (depth > maxDepth || visited.has(currentPath))
      return;
    visited.add(currentPath);
    const node = graph.nodes.get(currentPath);
    if (!node)
      return;
    score += node.importCount;
    for (const importer of node.importedBy) {
      traverse(importer, depth + 1);
    }
  }
  traverse(absolutePath, 0);
  return score;
}

// packages/context-engine/dist/git-recent.js
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path3 from "node:path";
var execFileAsync = promisify(execFile);
var GIT_NOT_AVAILABLE = /* @__PURE__ */ Symbol("GIT_NOT_AVAILABLE");
async function isGitRepo(rootDir) {
  try {
    await execFileAsync("git", ["rev-parse", "--git-dir"], { cwd: rootDir, timeout: 5e3 });
    return true;
  } catch {
    return false;
  }
}
async function getGitLog(rootDir, maxEntries = 50) {
  const { stdout } = await execFileAsync("git", ["log", `--max-count=${maxEntries}`, "--pretty=format:%ct", "--name-only", "--no-merges"], { cwd: rootDir, timeout: 1e4, maxBuffer: 5e5, encoding: "utf8" });
  const entries = [];
  const lines = stdout.split("\n");
  let currentTimestamp = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed)
      continue;
    const ts2 = Number.parseInt(trimmed, 10);
    if (Number.isFinite(ts2) && ts2 > 1e9) {
      currentTimestamp = ts2;
      continue;
    }
    if (currentTimestamp > 0 && trimmed.length > 0 && !trimmed.includes(" ")) {
      entries.push({ path: trimmed, timestamp: currentTimestamp });
    }
  }
  return entries;
}
async function getRecentFiles(rootDir, maxEntries = 50) {
  const isGit = await isGitRepo(rootDir);
  if (!isGit)
    return GIT_NOT_AVAILABLE;
  try {
    const logEntries = await getGitLog(rootDir, maxEntries);
    const byPath = /* @__PURE__ */ new Map();
    for (const entry of logEntries) {
      const existing = byPath.get(entry.path);
      if (existing) {
        existing.commitCount += 1;
        existing.timestamp = Math.max(existing.timestamp, entry.timestamp);
      } else {
        byPath.set(entry.path, { timestamp: entry.timestamp, commitCount: 1 });
      }
    }
    return [...byPath.entries()].map(([path10, data]) => ({ path: path10, timestamp: data.timestamp, commitCount: data.commitCount })).sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return GIT_NOT_AVAILABLE;
  }
}
function getRecencyScore(recentFiles, relativePath) {
  if (recentFiles === GIT_NOT_AVAILABLE)
    return 0;
  const normalizedPath = relativePath.split(path3.sep).join("/");
  const entry = recentFiles.find((e) => e.path === normalizedPath || e.path.endsWith(normalizedPath));
  if (!entry)
    return 0;
  const now = Date.now() / 1e3;
  const ageSeconds = now - entry.timestamp;
  const recencyWeight = Math.max(0, 1 - ageSeconds / (7 * 24 * 60 * 60));
  const frequencyWeight = Math.min(entry.commitCount / 10, 1);
  return recencyWeight * 0.6 + frequencyWeight * 0.4;
}

// packages/context-engine/dist/proximity.js
import path4 from "node:path";
function getDirectoryProximityScore(filePath, targetPath) {
  if (!targetPath)
    return 0;
  const fileParts = filePath.split("/");
  const targetParts = targetPath.split("/");
  let commonDepth = 0;
  for (let i = 0; i < Math.min(fileParts.length, targetParts.length); i++) {
    if (fileParts[i] === targetParts[i]) {
      commonDepth++;
    } else {
      break;
    }
  }
  if (commonDepth === 0)
    return 0;
  const fileDepth = fileParts.length;
  const targetDepth = targetParts.length;
  const maxDepth = Math.max(fileDepth, targetDepth);
  const depthRatio = commonDepth / maxDepth;
  const sameDirectory = path4.dirname(filePath) === path4.dirname(targetPath);
  if (sameDirectory) {
    return 0.8 + depthRatio * 0.2;
  }
  return depthRatio * 0.6;
}
function getSamePackageScore(filePath, targetPath) {
  if (!targetPath)
    return 0;
  const fileParts = filePath.split("/");
  const targetParts = targetPath.split("/");
  const filePkgIndex = fileParts.findIndex((p) => p === "packages" || p === "apps" || p === "src");
  const targetPkgIndex = targetParts.findIndex((p) => p === "packages" || p === "apps" || p === "src");
  if (filePkgIndex === -1 || targetPkgIndex === -1)
    return 0;
  const filePkg = fileParts[filePkgIndex + 1];
  const targetPkg = targetParts[targetPkgIndex + 1];
  if (filePkg && targetPkg && filePkg === targetPkg) {
    return 0.5;
  }
  return 0;
}

// packages/context-engine/dist/test-pairing.js
import path5 from "node:path";
var TEST_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /\/__tests__\//,
  /\/tests?\//,
  /\.test\.(py|rb|go|rs)$/
];
var SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|py|go|rs)$/;
function isTestFile(relativePath) {
  return TEST_PATTERNS.some((pattern) => pattern.test(relativePath));
}
function isSourceFile(relativePath) {
  return SOURCE_EXTENSIONS.test(relativePath) && !isTestFile(relativePath);
}
function findTestPair(relativePath, allFiles) {
  if (isTestFile(relativePath)) {
    const baseName = relativePath.replace(/\.test\.(ts|tsx|js|jsx)$/, "").replace(/\.spec\.(ts|tsx|js|jsx)$/, "").replace(/\/__tests__\//, "/").replace(/\/tests?\//, "/");
    for (const file of allFiles) {
      if (file === relativePath)
        continue;
      if (file === baseName || file.startsWith(baseName + ".")) {
        return file;
      }
    }
    return null;
  }
  if (isSourceFile(relativePath)) {
    const dir = path5.dirname(relativePath);
    const baseName = path5.basename(relativePath, path5.extname(relativePath));
    const ext = path5.extname(relativePath);
    const candidates = [
      `${dir}/${baseName}.test${ext}`,
      `${dir}/${baseName}.spec${ext}`,
      `${dir}/__tests__/${baseName}${ext}`,
      `${dir}/test/${baseName}${ext}`,
      `${dir}/tests/${baseName}${ext}`
    ];
    for (const candidate of candidates) {
      if (allFiles.includes(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}
function getTestPairScore(relativePath, allFiles, targetFile) {
  if (!targetFile)
    return 0;
  const targetDir = path5.dirname(targetFile);
  const fileDir = path5.dirname(relativePath);
  if (isTestFile(relativePath) && isSourceFile(targetFile)) {
    const pair = findTestPair(targetFile, allFiles);
    if (pair === relativePath)
      return 1;
  }
  if (isSourceFile(relativePath) && isTestFile(targetFile)) {
    const pair = findTestPair(targetFile, allFiles);
    if (pair === relativePath)
      return 1;
  }
  if (fileDir === targetDir && isTestFile(relativePath) !== isTestFile(targetFile)) {
    return 0.3;
  }
  return 0;
}

// packages/context-engine/dist/cached-scanner.js
import fs3 from "node:fs/promises";
import path6 from "node:path";

// packages/context-engine/dist/summary.js
function generateHeuristicSummary(filePath, symbols, imports, fileComment) {
  const name = filePath.split("/").pop() ?? filePath;
  const ext = name.split(".").pop()?.toLowerCase();
  const dirParts = filePath.split("/").slice(0, -1);
  const parentDir = dirParts[dirParts.length - 1] ?? "root";
  const functionNames = symbols.filter((s) => s.kind === "function").map((s) => s.name);
  const classNames = symbols.filter((s) => s.kind === "class").map((s) => s.name);
  const interfaceNames = symbols.filter((s) => s.kind === "interface").map((s) => s.name);
  const methodNames = symbols.filter((s) => s.kind === "method").map((s) => s.name);
  const parts = [];
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
  const externalImports = imports.filter((i) => !i.startsWith("."));
  const internalImports = imports.filter((i) => i.startsWith("."));
  if (externalImports.length > 0) {
    parts.push(`Depends on external packages: ${externalImports.slice(0, 3).join(", ")}`);
  }
  if (internalImports.length > 0) {
    parts.push(`Imports from ${internalImports.length} internal module${internalImports.length > 1 ? "s" : ""}`);
  }
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

// packages/context-engine/dist/cached-scanner.js
function extractFileComment(source, language) {
  const lines = source.split("\n");
  const commentLines = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    if (line.startsWith("#!")) {
      i++;
      continue;
    }
    if (language === "python" && (line.startsWith('"""') || line.startsWith("'''"))) {
      const quote = line.slice(0, 3);
      if (line.endsWith(quote) && line.length > 6) {
        return line.slice(3, -3).trim();
      }
      commentLines.push(line.slice(3));
      i++;
      while (i < lines.length && !lines[i].trim().endsWith(quote)) {
        commentLines.push(lines[i].trim());
        i++;
      }
      if (i < lines.length)
        commentLines.push(lines[i].trim().slice(0, -3));
      return commentLines.filter(Boolean).join(" ").trim() || void 0;
    }
    if (line.startsWith("///")) {
      commentLines.push(line.slice(3).trim());
      i++;
      continue;
    }
    if (line.startsWith("/**")) {
      if (line.includes("*/") && line.length > 4) {
        const inner = line.slice(3, line.indexOf("*/")).trim();
        if (inner)
          return inner;
      }
      commentLines.push(line.slice(3).replace(/^\*/, "").trim());
      i++;
      while (i < lines.length) {
        const inner = lines[i].trim();
        if (inner.endsWith("*/")) {
          const cleaned = inner.slice(0, -2).replace(/^\*\s?/, "").trim();
          if (cleaned)
            commentLines.push(cleaned);
          break;
        }
        commentLines.push(inner.replace(/^\*\s?/, "").trim());
        i++;
      }
      return commentLines.filter(Boolean).join(" ").trim() || void 0;
    }
    if (line.startsWith("//")) {
      commentLines.push(line.slice(2).trim());
      i++;
      while (i < lines.length && lines[i].trim().startsWith("//")) {
        commentLines.push(lines[i].trim().slice(2).trim());
        i++;
      }
      return commentLines.filter(Boolean).join(" ").trim() || void 0;
    }
    break;
  }
  const comment = commentLines.filter(Boolean).join(" ").trim();
  return comment.length > 0 ? comment : void 0;
}
function toSafeRelativePath(rootDir, filePath) {
  const relative = path6.relative(rootDir, filePath);
  if (relative.startsWith(".."))
    return void 0;
  return relative;
}
async function walkDirectory(rootDir, currentDir, output, skipped, visited) {
  try {
    const realDir = await fs3.realpath(currentDir);
    if (visited.has(realDir))
      return;
    visited.add(realDir);
    const entries = await fs3.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path6.join(currentDir, entry.name);
      const relativePath = path6.relative(rootDir, absolutePath);
      if (shouldIgnorePath(relativePath))
        continue;
      if (entry.isDirectory()) {
        await walkDirectory(rootDir, absolutePath, output, skipped, visited);
        continue;
      }
      if (entry.isFile())
        output.push(absolutePath);
    }
  } catch {
    skipped.count += 1;
  }
}
function basePriority(filePath) {
  if (/(^|\/)(package\.json|tsconfig\.json|README\.md)$/i.test(filePath))
    return 0;
  if (/\/(src|app|apps|packages)\//.test(`/${filePath}`))
    return 1;
  if (/\.(ts|tsx|js|jsx|py|go|rs)$/.test(filePath))
    return 2;
  return 3;
}
function computeHeuristicPriority(relativePath, absolutePath, importGraph, recentFiles, allRelativePaths, targetFile) {
  const base = basePriority(relativePath);
  const importScore = getTransitiveImportScore(importGraph, absolutePath);
  const recencyScore = getRecencyScore(recentFiles, relativePath);
  const testPairScore = targetFile ? getTestPairScore(relativePath, allRelativePaths, targetFile) : 0;
  const proximityScore = targetFile ? getDirectoryProximityScore(relativePath, targetFile) : 0;
  const samePackageScore = targetFile ? getSamePackageScore(relativePath, targetFile) : 0;
  const weightedScore = base * 10 + importScore * 2 + recencyScore * 3 + testPairScore * 4 + proximityScore * 2 + samePackageScore * 1;
  return weightedScore;
}
async function discoverFiles(rootDir, requestedFiles, skipped) {
  if (requestedFiles?.length) {
    const resolved = requestedFiles.map((file) => path6.resolve(rootDir, file)).filter((file) => toSafeRelativePath(rootDir, file) !== void 0);
    const results = await Promise.all(resolved.map(async (file) => {
      try {
        return (await fs3.stat(file)).isFile() ? file : null;
      } catch {
        if (skipped)
          skipped.count += 1;
        return null;
      }
    }));
    return results.filter((f) => f !== null);
  }
  const output = [];
  const skipCounter = skipped ?? { count: 0 };
  const visited = /* @__PURE__ */ new Set();
  await walkDirectory(rootDir, rootDir, output, skipCounter, visited);
  return output;
}
async function sortAndFilterFiles(rootDir, discoveredFiles, targetFile, ignoreTests) {
  const filesWithRelative = discoveredFiles.map((absolutePath) => ({ absolutePath, relativePath: path6.relative(rootDir, absolutePath).split(path6.sep).join("/") })).filter(({ relativePath }) => {
    if (shouldIgnorePath(relativePath, { ignoreTests }))
      return false;
    if (isGeneratedFile(relativePath))
      return false;
    if (!shouldIncludePath(relativePath))
      return false;
    return isLikelyTextFile(relativePath);
  });
  const allRelativePaths = filesWithRelative.map((f) => f.relativePath);
  const filesWithImports = [];
  const importResults = await Promise.all(filesWithRelative.map(async (f) => {
    try {
      const content = await fs3.readFile(f.absolutePath, "utf8");
      const imports = extractImportsFromSource(content, languageFromPath(f.relativePath));
      return { ...f, imports };
    } catch {
      return { ...f, imports: [] };
    }
  }));
  filesWithImports.push(...importResults);
  const importGraph = await buildImportGraph(filesWithImports, rootDir);
  const recentFiles = await getRecentFiles(rootDir);
  return filesWithRelative.map((f) => ({
    ...f,
    imports: filesWithImports.find((fw) => fw.absolutePath === f.absolutePath)?.imports ?? [],
    score: computeHeuristicPriority(f.relativePath, f.absolutePath, importGraph, recentFiles, allRelativePaths, targetFile)
  })).sort((a, b) => a.score - b.score || a.relativePath.localeCompare(b.relativePath));
}
async function readFilesWithinBudget(sortedFiles, maxFiles, maxBytes, maxFileBytes, cache, onProgress) {
  const files = [];
  let totalBytes = 0;
  let truncated = false;
  let skipped = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  const concurrencyLimit = 10;
  let nextIndex = 0;
  async function processNext() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= sortedFiles.length)
        return;
      if (files.length >= maxFiles || totalBytes >= maxBytes) {
        truncated = true;
        return;
      }
      const file = sortedFiles[currentIndex];
      try {
        const stat = await fs3.stat(file.absolutePath);
        if (stat.size > maxFileBytes) {
          truncated = true;
          continue;
        }
        const cached = cache.get(file.absolutePath, stat.mtimeMs, stat.size);
        if (cached) {
          const contentBytes2 = Buffer.byteLength(cached.content, "utf8");
          if (totalBytes + contentBytes2 > maxBytes || files.length >= maxFiles) {
            truncated = true;
            continue;
          }
          const imports2 = extractImportsFromSource(cached.content, languageFromPath(file.relativePath));
          const summary2 = generateHeuristicSummary(file.relativePath, cached.symbols, imports2, cached.fileComment);
          files.push({
            path: file.relativePath,
            absolutePath: file.absolutePath,
            language: languageFromPath(file.relativePath),
            content: cached.content,
            size: stat.size,
            symbols: cached.symbols,
            imports: imports2,
            summary: summary2,
            fileComment: cached.fileComment
          });
          totalBytes += contentBytes2;
          cacheHits += 1;
          onProgress?.({ phase: "reading", discoveredFiles: sortedFiles.length, processedFiles: files.length, totalFiles: sortedFiles.length, bytesProcessed: totalBytes, totalBytes: maxBytes });
          continue;
        }
        const raw = await fs3.readFile(file.absolutePath, "utf8");
        const rawBuffer = Buffer.from(raw, "utf8");
        const content = rawBuffer.length > Math.max(0, maxBytes - totalBytes) ? rawBuffer.subarray(0, Math.max(0, maxBytes - totalBytes)).toString("utf8") : raw;
        const language = languageFromPath(file.relativePath);
        const symbols = extractSymbols(content, language);
        const imports = extractImportsFromSource(content, language);
        const fileComment = extractFileComment(content, language);
        const summary = generateHeuristicSummary(file.relativePath, symbols, imports, fileComment);
        const contentBytes = Buffer.byteLength(content, "utf8");
        if (contentBytes === 0 || files.length >= maxFiles) {
          truncated = true;
          continue;
        }
        cache.set(file.absolutePath, stat.mtimeMs, stat.size, content, symbols, fileComment);
        files.push({
          path: file.relativePath,
          absolutePath: file.absolutePath,
          language,
          content,
          size: stat.size,
          symbols,
          imports,
          summary,
          fileComment
        });
        totalBytes += contentBytes;
        cacheMisses += 1;
        onProgress?.({ phase: "reading", discoveredFiles: sortedFiles.length, processedFiles: files.length, totalFiles: sortedFiles.length, bytesProcessed: totalBytes, totalBytes: maxBytes });
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
async function scanRepository(options, cache) {
  const rootDir = path6.resolve(options.rootDir);
  const maxFiles = options.maxFiles ?? 80;
  const maxBytes = options.maxBytes ?? 12e4;
  const maxFileBytes = options.maxFileBytes ?? 8e4;
  const maxChunkChars = options.maxChunkChars ?? 6e3;
  const skipped = { count: 0 };
  const onProgress = options.onProgress;
  loadIgnoreFiles(rootDir);
  setIncludeExcludePatterns(options.include ?? [], options.exclude ?? []);
  const discoveredFiles = await discoverFiles(rootDir, options.files, skipped);
  onProgress?.({ phase: "scoring", discoveredFiles: discoveredFiles.length, processedFiles: 0, totalFiles: discoveredFiles.length, bytesProcessed: 0, totalBytes: 0 });
  const sortedFiles = await sortAndFilterFiles(rootDir, discoveredFiles, options.targetFile, options.ignoreTests);
  onProgress?.({ phase: "reading", discoveredFiles: discoveredFiles.length, processedFiles: 0, totalFiles: sortedFiles.length, bytesProcessed: 0, totalBytes: maxBytes });
  const { files, totalBytes, truncated, skipped: readSkipped, cacheHits, cacheMisses } = await readFilesWithinBudget(sortedFiles, maxFiles, maxBytes, maxFileBytes, cache, onProgress);
  onProgress?.({ phase: "complete", discoveredFiles: discoveredFiles.length, processedFiles: files.length, totalFiles: files.length, bytesProcessed: totalBytes, totalBytes: maxBytes });
  if (options.summarize && options.aiSummarizeFn && files.length > 0) {
    onProgress?.({ phase: "ai-summarizing", discoveredFiles: discoveredFiles.length, processedFiles: 0, totalFiles: files.length, bytesProcessed: 0, totalBytes: maxBytes });
    const aiConcurrency = 3;
    let aiIndex = 0;
    const aiWorkers = Array.from({ length: Math.min(aiConcurrency, files.length) }, async () => {
      while (true) {
        const idx = aiIndex++;
        if (idx >= files.length)
          return;
        const file = files[idx];
        const aiSummary = await options.aiSummarizeFn(file.path, file.content, file.symbols ?? [], file.imports ?? []);
        if (aiSummary) {
          file.summary = aiSummary;
        }
        onProgress?.({ phase: "ai-summarizing", discoveredFiles: discoveredFiles.length, processedFiles: idx + 1, totalFiles: files.length, bytesProcessed: 0, totalBytes: maxBytes });
      }
    });
    await Promise.all(aiWorkers);
  }
  const filesWithImports = files.map((f) => ({
    absolutePath: f.absolutePath ?? path6.resolve(rootDir, f.path),
    relativePath: f.path,
    imports: f.imports ?? []
  }));
  const importGraph = await buildImportGraph(filesWithImports, rootDir);
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

// packages/context-engine/dist/report-generator.js
import path7 from "node:path";
function getPackageName(filePath) {
  const scopedMatch = filePath.match(/^@[\w-]+\/([\w-]+)/);
  if (scopedMatch)
    return scopedMatch[1];
  const parts = filePath.split("/");
  const pkgIndex = parts.findIndex((p) => p === "packages" || p === "apps" || p === "src");
  if (pkgIndex === -1 || pkgIndex + 1 >= parts.length)
    return "root";
  return parts[pkgIndex + 1];
}
function getFileExtension(filePath) {
  const ext = path7.extname(filePath);
  return ext || "unknown";
}
function getEntryPoints(files) {
  const entryPatterns = ["index.ts", "index.tsx", "index.js", "main.ts", "main.py", "app.ts", "server.ts", "cli.ts"];
  return files.filter((f) => entryPatterns.some((pattern) => f.path.endsWith(pattern))).map((f) => f.path);
}
function generateMermaidDependencyGraph(files, fileLevel = false) {
  if (fileLevel) {
    const lines2 = ["```mermaid", "graph TD"];
    const seen2 = /* @__PURE__ */ new Set();
    const fileSet = new Set(files.map((f) => f.path));
    for (const file of files) {
      if (!file.imports)
        continue;
      const fromNode = file.path.replace(/[^a-zA-Z0-9]/g, "_");
      for (const imp of file.imports) {
        if (fileSet.has(imp)) {
          const toNode = imp.replace(/[^a-zA-Z0-9]/g, "_");
          const edge = `${fromNode} --> ${toNode}`;
          if (!seen2.has(edge)) {
            seen2.add(edge);
            lines2.push(`  ${fromNode}["${file.path}"] --> ${toNode}["${imp}"]`);
          }
        }
      }
    }
    lines2.push("```");
    return lines2.join("\n");
  }
  const modules = /* @__PURE__ */ new Map();
  for (const file of files) {
    const pkg = getPackageName(file.path);
    if (!modules.has(pkg))
      modules.set(pkg, /* @__PURE__ */ new Set());
    if (file.imports) {
      for (const imp of file.imports) {
        const impPkg = getPackageName(imp);
        if (impPkg !== pkg) {
          modules.get(pkg).add(impPkg);
        }
      }
    }
  }
  const lines = ["```mermaid", "graph TD"];
  const seen = /* @__PURE__ */ new Set();
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
function generateOverview(context) {
  const extensions = /* @__PURE__ */ new Map();
  for (const file of context.files) {
    const ext = getFileExtension(file.path);
    extensions.set(ext, (extensions.get(ext) ?? 0) + 1);
  }
  const langSummary = [...extensions.entries()].sort((a, b) => b[1] - a[1]).map(([ext, count]) => `${ext} (${count} files)`).join(", ");
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
function generateModuleMap(context, importGraph) {
  const modules = /* @__PURE__ */ new Map();
  for (const file of context.files) {
    const pkg = getPackageName(file.path);
    const existing = modules.get(pkg) ?? { files: [], imports: /* @__PURE__ */ new Set(), symbols: 0, absolutePaths: [] };
    existing.files.push(file.path);
    if (file.absolutePath)
      existing.absolutePaths.push(file.absolutePath);
    if (file.imports) {
      for (const imp of file.imports)
        existing.imports.add(imp);
    }
    if (file.symbols)
      existing.symbols += file.symbols.length;
    modules.set(pkg, existing);
  }
  const rows = [...modules.entries()].map(([name, data]) => {
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
  }).join("\n");
  return {
    heading: "Module Map",
    content: [
      "| Module | Files | Symbols | Imported By |",
      "|--------|-------|---------|-------------|",
      rows
    ].join("\n")
  };
}
function generateKeySymbols(context, importGraph) {
  const symbolMap = /* @__PURE__ */ new Map();
  for (const file of context.files) {
    if (!file.symbols)
      continue;
    for (const symbol of file.symbols) {
      const key = `${file.path}:${symbol.kind}:${symbol.name}`;
      const existing = symbolMap.get(key) ?? { kind: symbol.kind, name: symbol.name, file: file.path, line: symbol.line, importedBy: 0 };
      symbolMap.set(key, existing);
    }
  }
  if (importGraph) {
    for (const file of context.files) {
      if (!file.absolutePath)
        continue;
      const node = importGraph.nodes.get(file.absolutePath);
      if (!node || !file.symbols)
        continue;
      for (const symbol of file.symbols) {
        const key = `${file.path}:${symbol.kind}:${symbol.name}`;
        const entry = symbolMap.get(key);
        if (entry) {
          entry.importedBy = node.importCount;
        }
      }
    }
  }
  const topSymbols = [...symbolMap.entries()].sort((a, b) => b[1].importedBy - a[1].importedBy).slice(0, 15);
  if (topSymbols.length === 0) {
    return { heading: "Key Symbols", content: "_No symbols extracted._" };
  }
  const rows = topSymbols.map(([, data]) => `| \`${data.kind}\` \`${data.name}\` | ${data.file}:${data.line} | ${data.importedBy} |`).join("\n");
  return {
    heading: "Key Symbols",
    content: [
      "| Symbol | Location | Imported By |",
      "|--------|----------|-------------|",
      rows
    ].join("\n")
  };
}
function generateDependencyGraph(context, fileLevel = false) {
  return {
    heading: "Dependency Graph",
    content: generateMermaidDependencyGraph(context.files, fileLevel)
  };
}
function generateArchitectureReport(context, options) {
  const includeMermaid = options?.includeMermaid ?? true;
  const fileLevelGraph = options?.fileLevelGraph ?? false;
  const importGraph = options?.importGraph;
  const sections = [
    generateOverview(context),
    generateModuleMap(context, importGraph),
    generateKeySymbols(context, importGraph)
  ];
  if (includeMermaid) {
    sections.push(generateDependencyGraph(context, fileLevelGraph));
  }
  const repoName = path7.basename(context.rootDir);
  const lines = [`# Architecture: ${repoName}`, ""];
  for (const section of sections) {
    lines.push(`## ${section.heading}`, "", section.content, "");
  }
  return lines.join("\n");
}

// packages/context-engine/dist/diff-analyzer.js
import fs4 from "node:fs/promises";
import path8 from "node:path";
function computeUnifiedDiff(oldContent, newContent, oldPath, newPath, contextLines = 3) {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const hunks = [];
  const changes = [];
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
  const changeIndices = [];
  changes.forEach((c, i) => {
    if (c.type !== "equal")
      changeIndices.push(i);
  });
  if (changeIndices.length === 0)
    return [];
  const hunkRanges = [];
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
    const hunkLines = [];
    let oldStart = -1;
    let newStart = -1;
    let oldLineCount = 0;
    let newLineCount = 0;
    for (let i = range.start; i <= range.end; i++) {
      const change = changes[i];
      if (change.type === "equal") {
        hunkLines.push(` ${oldLines[change.oldLine]}`);
        if (oldStart === -1)
          oldStart = change.oldLine + 1;
        if (newStart === -1)
          newStart = change.newLine + 1;
        oldLineCount++;
        newLineCount++;
      } else if (change.type === "delete") {
        hunkLines.push(`-${oldLines[change.oldLine]}`);
        if (oldStart === -1)
          oldStart = change.oldLine + 1;
        if (newStart === -1)
          newStart = change.newLine + 1;
        oldLineCount++;
      } else {
        hunkLines.push(`+${newLines[change.newLine]}`);
        if (oldStart === -1)
          oldStart = change.oldLine + 1;
        if (newStart === -1)
          newStart = change.newLine + 1;
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
function shouldDelete(oldLine, newLines, newIdx) {
  for (let i = newIdx; i < Math.min(newIdx + 5, newLines.length); i++) {
    if (oldLine === newLines[i])
      return true;
  }
  return newIdx >= newLines.length;
}
function computeSymbolDiff(oldSymbols, newSymbols) {
  const oldSet = new Set(oldSymbols.map((s) => `${s.kind}:${s.name}`));
  const newSet = new Set(newSymbols.map((s) => `${s.kind}:${s.name}`));
  const added = newSymbols.filter((s) => !oldSet.has(`${s.kind}:${s.name}`));
  const removed = oldSymbols.filter((s) => !newSet.has(`${s.kind}:${s.name}`));
  return { added, removed };
}
function computeImportDiff(oldImports, newImports) {
  const oldSet = new Set(oldImports);
  const newSet = new Set(newImports);
  const added = [...newSet].filter((i) => !oldSet.has(i));
  const removed = [...oldSet].filter((i) => !newSet.has(i));
  return { added, removed };
}
async function readFileContent(baseDir, relativePath) {
  try {
    return await fs4.readFile(path8.join(baseDir, relativePath), "utf8");
  } catch {
    return null;
  }
}
async function analyzeDiff(baseContext, headContext, baseDir, headDir) {
  const baseFileSet = new Set(baseContext.files.map((f) => f.path));
  const headFileSet = new Set(headContext.files.map((f) => f.path));
  const addedFiles = [...headFileSet].filter((f) => !baseFileSet.has(f));
  const removedFiles = [...baseFileSet].filter((f) => !headFileSet.has(f));
  const commonFiles = [...headFileSet].filter((f) => baseFileSet.has(f));
  const diffs = [];
  let totalSymbolAdditions = 0;
  let totalSymbolRemovals = 0;
  let totalImportAdditions = 0;
  let totalImportRemovals = 0;
  for (const filePath of addedFiles) {
    const content = await readFileContent(headDir, filePath);
    if (!content)
      continue;
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
    if (!content)
      continue;
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
    if (baseContent === null || headContent === null)
      continue;
    if (baseContent === headContent)
      continue;
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
function formatDiffReport(diff, baseRef, headRef) {
  const lines = [
    `# Diff: ${baseRef} \u2192 ${headRef}`,
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

// packages/context-engine/dist/json-output.js
function getPackageName2(filePath) {
  const scopedMatch = filePath.match(/^@[\w-]+\/([\w-]+)/);
  if (scopedMatch)
    return scopedMatch[1];
  const parts = filePath.split("/");
  const pkgIndex = parts.findIndex((p) => p === "packages" || p === "apps" || p === "src");
  if (pkgIndex === -1 || pkgIndex + 1 >= parts.length)
    return "root";
  return parts[pkgIndex + 1];
}
function getEntryPoints2(files) {
  const entryPatterns = ["index.ts", "index.tsx", "index.js", "main.ts", "main.py", "app.ts", "server.ts", "cli.ts"];
  return files.filter((f) => entryPatterns.some((pattern) => f.path.endsWith(pattern))).map((f) => f.path);
}
function generateJsonReport(context, includeContent = false) {
  const files = context.files.map((f) => ({
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
  const graphNodes = [];
  for (const [absPath, node] of importGraph?.nodes ?? /* @__PURE__ */ new Map()) {
    graphNodes.push({
      path: node.relativePath,
      imports: node.imports,
      importedBy: node.importedBy.map((p) => {
        const found = importGraph?.nodes.get(p);
        return found?.relativePath ?? p;
      }),
      importCount: node.importCount
    });
  }
  const packages = [...(importGraph?.packages ?? /* @__PURE__ */ new Map()).values()].map((p) => ({
    name: p.name,
    location: p.location,
    dependencies: p.dependencies
  }));
  const externalDeps = [...importGraph?.externalDeps ?? /* @__PURE__ */ new Set()];
  const modules = /* @__PURE__ */ new Map();
  for (const file of context.files) {
    const pkg = getPackageName2(file.path);
    const existing = modules.get(pkg) ?? { files: [], symbolCount: 0, importedByCount: 0 };
    existing.files.push(file.path);
    existing.symbolCount += (file.symbols ?? []).length;
    modules.set(pkg, existing);
  }
  if (importGraph) {
    for (const file of context.files) {
      if (!file.absolutePath)
        continue;
      const node = importGraph.nodes.get(file.absolutePath);
      if (node) {
        const pkg = getPackageName2(file.path);
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
  const symbolMap = /* @__PURE__ */ new Map();
  for (const file of context.files) {
    if (!file.symbols)
      continue;
    for (const symbol of file.symbols) {
      const key = `${file.path}:${symbol.kind}:${symbol.name}`;
      const existing = symbolMap.get(key) ?? { kind: symbol.kind, name: symbol.name, file: file.path, line: symbol.line, importedBy: 0 };
      symbolMap.set(key, existing);
    }
  }
  if (importGraph) {
    for (const file of context.files) {
      if (!file.absolutePath)
        continue;
      const node = importGraph.nodes.get(file.absolutePath);
      if (!node || !file.symbols)
        continue;
      for (const symbol of file.symbols) {
        const key = `${file.path}:${symbol.kind}:${symbol.name}`;
        const entry = symbolMap.get(key);
        if (entry) {
          entry.importedBy = node.importCount;
        }
      }
    }
  }
  const keySymbols = [...symbolMap.entries()].sort((a, b) => b[1].importedBy - a[1].importedBy).slice(0, 15).map(([, data]) => data);
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
    entryPoints: getEntryPoints2(context.files),
    modules: moduleList,
    keySymbols
  };
}

// packages/context-engine/dist/progress.js
function formatProgress(progress) {
  const pct = progress.totalFiles > 0 ? Math.round(progress.processedFiles / progress.totalFiles * 100) : 0;
  const bytesPct = progress.totalBytes > 0 ? Math.round(progress.bytesProcessed / progress.totalBytes * 100) : 0;
  const phaseLabels = {
    discovering: "Discovering files",
    scoring: "Scoring files",
    reading: "Reading files",
    "ai-summarizing": "AI summarizing",
    complete: "Complete"
  };
  const phase = phaseLabels[progress.phase] ?? progress.phase;
  if (progress.phase === "discovering") {
    return `${phase}: ${progress.discoveredFiles} files found`;
  }
  return `${phase}: ${progress.processedFiles}/${progress.totalFiles} files (${pct}%), ${formatBytes(progress.bytesProcessed)}`;
}
function formatBytes(bytes) {
  if (bytes < 1024)
    return `${bytes} B`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// packages/ai/dist/local-provider.js
async function* simulateStreaming(text, chunkSize = 32) {
  for (let index = 0; index < text.length; index += chunkSize) {
    yield text.slice(index, index + chunkSize);
    await new Promise((resolve2) => setTimeout(resolve2, 8));
  }
}
var MAX_REQUEST_CHARS = 500;
var DEV_RESPONSE = [
  "RepoLens local mode \u2014 no AI provider configured.\n\n",
  "Set `AI_PROVIDER_API_KEY` for AI-generated architecture summaries and trace explanations.\n\n",
  "Request received:\n",
  "{{USER_REQUEST}}"
].join("");
var LocalAIProvider = class {
  name = "local";
  async *streamChat(request) {
    const last = [...request.messages].reverse().find((message) => message.role === "user");
    const userRequest = last ? last.content.length > MAX_REQUEST_CHARS ? `${last.content.slice(0, MAX_REQUEST_CHARS)}...` : last.content : "No user request was supplied.";
    const response = DEV_RESPONSE.replace("{{USER_REQUEST}}", userRequest);
    for await (const chunk of simulateStreaming(response)) {
      yield chunk;
    }
  }
  async chat(request) {
    const last = [...request.messages].reverse().find((m) => m.role === "user");
    return `[LocalAI] ${last?.content?.slice(0, 200) ?? "No content"}`;
  }
};

// packages/ai/dist/remote-provider.js
var ALLOWED_AI_DOMAINS = /* @__PURE__ */ new Set([
  "api.openai.com",
  "openrouter.ai",
  "api.together.xyz",
  "api.groq.com",
  "api.anthropic.com",
  "api.deepseek.com"
]);
var AI_PROVIDER_TIMEOUT_MS = 12e4;
var BLOCKED_PORTS = /* @__PURE__ */ new Set([22, 23, 25, 53, 110, 135, 139, 445, 1433, 3306, 3389, 5432, 6379, 8500, 27017]);
function validateBaseUrl(baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      throw new RepoLensError("AI provider must use HTTPS", "SSRF_PREVENTION", 400);
    }
    const port = parsed.port ? Number.parseInt(parsed.port, 10) : parsed.protocol === "https:" ? 443 : 80;
    if (BLOCKED_PORTS.has(port)) {
      throw new RepoLensError("AI provider port is not allowed", "SSRF_PREVENTION", 400);
    }
    if (!ALLOWED_AI_DOMAINS.has(parsed.hostname) && parsed.hostname !== "localhost") {
      throw new RepoLensError(`Untrusted AI provider host: ${parsed.hostname}`, "SSRF_PREVENTION", 400);
    }
  } catch (error) {
    if (error instanceof RepoLensError)
      throw error;
    throw new RepoLensError("Invalid AI provider base URL", "SSRF_PREVENTION", 400);
  }
}
var RemoteAIProvider = class {
  options;
  name = "remote";
  constructor(options) {
    this.options = options;
    validateBaseUrl(options.baseUrl);
  }
  async *streamChat(request) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_PROVIDER_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.options.apiKey}`
        },
        body: JSON.stringify({
          model: request.model ?? this.options.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.2,
          stream: true
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new RepoLensError(`AI provider request failed (${response.status})`, "AI_PROVIDER_ERROR", 502);
      }
      if (!response.body) {
        throw new RepoLensError("AI provider did not return a stream", "AI_PROVIDER_STREAM_MISSING", 502);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done)
          break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:"))
            continue;
          const payload = trimmed.slice("data:".length).trim();
          if (payload === "[DONE]")
            return;
          const event = safeJsonParse(payload);
          const content = event?.choices?.[0]?.delta?.content;
          if (content)
            yield content;
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  async chat(request) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_PROVIDER_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.options.apiKey}`
        },
        body: JSON.stringify({
          model: request.model ?? this.options.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.1,
          max_tokens: 2e3,
          stream: false
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new RepoLensError(`AI provider request failed (${response.status})`, "AI_PROVIDER_ERROR", 502);
      }
      const data = await response.json();
      return data.choices?.[0]?.message?.content ?? "";
    } finally {
      clearTimeout(timeout);
    }
  }
};

// packages/ai/dist/provider-factory.js
function createAIProvider(config) {
  if (!config.aiProviderApiKey) {
    return new LocalAIProvider();
  }
  return new RemoteAIProvider({
    baseUrl: config.aiProviderBaseUrl,
    apiKey: config.aiProviderApiKey,
    model: config.aiProviderModel
  });
}

// packages/ai/dist/summarize.js
var SUMMARY_PROMPT = "Summarize the following conversation history concisely. Focus on key decisions, context, and user requests. Keep it under 200 words.";
function createSummarizeFn(provider, summaryModel) {
  return async (messages) => {
    const summaryMessages = [
      { role: "system", content: SUMMARY_PROMPT },
      ...messages
    ];
    if (provider.chat) {
      return await provider.chat({ messages: summaryMessages, model: summaryModel, temperature: 0.1 });
    }
    const chunks = [];
    for await (const chunk of provider.streamChat({ messages: summaryMessages, model: summaryModel, temperature: 0.1 })) {
      chunks.push(chunk);
    }
    return chunks.join("");
  };
}

// packages/ai/dist/doc-generator.js
var TRACE_PROMPT = `You are a senior software engineer tracing code flow through a repository. Given a query about how something works in the codebase, trace the flow through the relevant files.

Focus on:
1. Entry point(s) where the flow begins
2. Each file and function involved in the chain
3. Data transformations at each step
4. Return flow and final output

Use concrete file paths, function names, and line references from the context. Be specific about the actual code, not generic descriptions.`;
var DIFF_ANALYSIS_PROMPT = `You are a senior software engineer comparing two versions of a codebase. Analyze the structural differences between the old and new versions.

Focus on:
1. What was added and why it matters
2. What was removed and the impact
3. What was modified and the nature of changes
4. Overall architectural impact

Be specific about files, functions, and patterns. Keep it under 300 words.`;
async function callProvider(provider, messages, model) {
  if (provider.chat) {
    return await provider.chat({ messages, model, temperature: 0.1 });
  }
  const chunks = [];
  for await (const chunk of provider.streamChat({ messages, model, temperature: 0.1 })) {
    chunks.push(chunk);
  }
  return chunks.join("");
}
function formatContext(context) {
  const files = context.files.slice(0, 20).map((f) => {
    const symbols = f.symbols?.map((s) => `  - ${s.kind} ${s.name} (line ${s.line})`).join("\n") || "  (no symbols)";
    const imports = f.imports?.length ? `  Imports: ${f.imports.join(", ")}` : "  Imports: none";
    return `File: ${f.path}
${imports}
${symbols}`;
  }).join("\n\n");
  return `Repository: ${context.rootDir}
Files scanned: ${context.summary.scannedFiles}
Files included: ${context.summary.includedFiles}

${files}`;
}
async function generateTraceExplanation(provider, context, query, model) {
  const messages = [
    { role: "system", content: TRACE_PROMPT },
    { role: "user", content: `Query: ${query}

${formatContext(context)}` }
  ];
  return callProvider(provider, messages, model);
}
async function generateDiffAnalysis(provider, oldContext, newContext, model) {
  const oldFiles = oldContext.files.map((f) => f.path).join("\n");
  const newFiles = newContext.files.map((f) => f.path).join("\n");
  const messages = [
    { role: "system", content: DIFF_ANALYSIS_PROMPT },
    { role: "user", content: `Old version files:
${oldFiles}

New version files:
${newFiles}` }
  ];
  return callProvider(provider, messages, model);
}

// apps/cli/src/index.ts
loadEnv(import.meta.url);
var fs5 = { readFile: fsReadFile };
var log = createLogger("reposight-cli");
var execFileAsync2 = promisify2(execFile2);
var HTML_FILE = "index.html";
function getBundledHtmlPath() {
  const cliDistDir = dirname2(import.meta.url.replace("file://", "").replace("file:/", ""));
  return join(cliDistDir, HTML_FILE);
}
async function findHtmlFile() {
  const bundledPath = getBundledHtmlPath();
  try {
    await fsStat(bundledPath);
    return bundledPath;
  } catch {
    const localPath = join(dirname2(dirname2(dirname2(import.meta.url.replace("file://", "").replace("file:/", "")))), "apps", "web", "public", HTML_FILE);
    try {
      await fsStat(localPath);
      return localPath;
    } catch {
      throw new Error(`Could not find ${HTML_FILE}. Run 'repolens explorer --download' to download it, or copy apps/web/public/index.html from the repo.`);
    }
  }
}
async function runExplorer(outputDir, download) {
  const targetDir = outputDir || ".";
  const outputPath = join(targetDir, HTML_FILE);
  if (download) {
    const url = "https://raw.githubusercontent.com/deepankarthik/reposight/main/apps/web/public/index.html";
    log.info("downloading explorer UI", { url });
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();
    await writeFile(outputPath, html, "utf8");
    log.info("downloaded explorer UI", { path: outputPath });
    process2.stdout.write(`Downloaded ${outputPath}
`);
    return;
  }
  const htmlSource = await findHtmlFile();
  await mkdir(targetDir, { recursive: true });
  await copyFile(htmlSource, outputPath);
  log.info("copied explorer UI", { from: htmlSource, to: outputPath });
  process2.stdout.write(`Copied ${outputPath}
Open this file in your browser to view the architecture graph.
`);
}
async function runServe(dir, port) {
  const htmlSource = await findHtmlFile();
  const targetDir = path9.resolve(dir);
  const jsonPath = join(targetDir, "ARCHITECTURE.json");
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const html = await fsReadFile(htmlSource, "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } else if (url.pathname === "/ARCHITECTURE.json" || url.pathname === "/architecture.json") {
      try {
        const json = await fsReadFile(jsonPath, "utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(json);
      } catch {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Run 'repolens scan . -f json' first to generate ARCHITECTURE.json" }));
      }
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  });
  server.listen(port, () => {
    process2.stdout.write(`RepoLens Explorer running at http://localhost:${port}
`);
    process2.stdout.write(`Serving: ${targetDir}
`);
    process2.stdout.write("Press Ctrl+C to stop\n");
  });
  process2.on("SIGINT", () => {
    server.close();
    process2.stdout.write("\nServer stopped\n");
    process2.exit(0);
  });
}
var FILE_SUMMARIZE_PROMPT = `Summarize this source file in 2-3 sentences. Focus on its purpose, key exports, and role in the codebase. Be specific and concise.`;
function createFileSummarizeFn(provider, model) {
  const summarize = createSummarizeFn(provider, model ?? "gpt-4o-mini");
  return async (filePath, content, symbols, imports) => {
    const symbolList = symbols.map((s) => `${s.kind} ${s.name}`).join(", ");
    const importList = imports.filter((i) => i.startsWith(".")).join(", ");
    const userPrompt = [
      `File: ${filePath}`,
      ``,
      `Content:
\`\`\`${filePath.split(".").pop()}
${content.substring(0, 4e3)}
\`\`\``,
      ``,
      `Symbols: ${symbolList || "none"}`,
      `Imports: ${importList || "none"}`,
      ``,
      `Summarize this file's purpose and role.`
    ].join("\n");
    try {
      return await summarize([{ role: "system", content: FILE_SUMMARIZE_PROMPT }, { role: "user", content: userPrompt }]);
    } catch {
      return "";
    }
  };
}
async function runScan(dir, outputDir, options) {
  const envConfig = readConfigFromEnv();
  const fileConfig = await loadConfigFile(dir);
  const config = mergeConfig(fileConfig, envConfig);
  const cache = new FileCache();
  const includeMermaid = !options.noMermaid && config.includeMermaid;
  const fileLevelGraph = options.fileLevel ?? false;
  log.info("scanning repository", { dir });
  const aiSummarizeFn = options.summarize ? createFileSummarizeFn(createAIProvider(config), config.aiProviderModel) : void 0;
  const context = await scanRepository({
    rootDir: dir,
    files: options.files,
    maxFiles: options.files ? Infinity : config.maxContextFiles,
    maxBytes: options.files ? Infinity : config.maxContextBytes,
    maxFileBytes: config.maxFileBytes,
    maxChunkChars: config.maxChunkChars,
    ignoreTests: options.ignoreTests,
    targetFile: options.targetFile ? path9.resolve(dir, options.targetFile) : void 0,
    include: options.include,
    exclude: options.exclude,
    summarize: options.summarize,
    aiSummarizeFn,
    onProgress: (progress) => {
      process2.stderr.write(`\r${formatProgress(progress)}`);
    }
  }, cache);
  process2.stderr.write("\n");
  log.info("scan complete", {
    files: context.summary.includedFiles,
    bytes: context.summary.totalBytes,
    skipped: context.summary.skippedFiles
  });
  if (outputDir) {
    await mkdir(outputDir, { recursive: true });
  }
  const isMarkdown = options.format === "markdown";
  const jsonPath = outputDir ? join(outputDir, "ARCHITECTURE.json") : join(dir, "ARCHITECTURE.json");
  const jsonReport = generateJsonReport(context, false);
  await writeFile(jsonPath, JSON.stringify(jsonReport, null, 2), "utf8");
  log.info("wrote json report", { path: jsonPath });
  if (isMarkdown) {
    const importGraph = context.importGraph;
    const report = generateArchitectureReport(context, { includeMermaid, fileLevelGraph, importGraph });
    const mdPath = outputDir ? join(outputDir, "ARCHITECTURE.md") : join(dir, "ARCHITECTURE.md");
    await writeFile(mdPath, report, "utf8");
    log.info("wrote architecture report", { path: mdPath });
  }
}
async function runTrace(dir, query) {
  const envConfig = readConfigFromEnv();
  const fileConfig = await loadConfigFile(dir);
  const config = mergeConfig(fileConfig, envConfig);
  const cache = new FileCache();
  log.info("scanning repository for trace", { dir, query });
  const context = await scanRepository({
    rootDir: dir,
    maxFiles: config.maxContextFiles,
    maxBytes: config.maxContextBytes,
    maxFileBytes: config.maxFileBytes,
    maxChunkChars: config.maxChunkChars
  }, cache);
  if (!config.aiProviderApiKey) {
    log.error("AI provider key required for trace command");
    process2.exitCode = 1;
    return;
  }
  const provider = createAIProvider(config);
  const explanation = await generateTraceExplanation(provider, context, query, config.aiProviderModel);
  process2.stdout.write(`# Trace: ${query}

${explanation}
`);
}
async function runDiff(dir, base, head, outputDir) {
  const envConfig = readConfigFromEnv();
  const fileConfig = await loadConfigFile(dir);
  const config = mergeConfig(fileConfig, envConfig);
  const cache = new FileCache();
  log.info("running diff analysis", { dir, base, head });
  const baseDir = join(dir, ".reposight-diff-base");
  const headDir = join(dir, ".reposight-diff-head");
  try {
    await mkdir(baseDir, { recursive: true });
    await mkdir(headDir, { recursive: true });
    await execFileAsync2("sh", ["-c", `git archive ${base} | tar -x -C ${baseDir}`], { cwd: dir });
    await execFileAsync2("sh", ["-c", `git archive ${head} | tar -x -C ${headDir}`], { cwd: dir });
    const baseContext = await scanRepository({
      rootDir: baseDir,
      maxFiles: config.maxContextFiles,
      maxBytes: config.maxContextBytes,
      maxFileBytes: config.maxFileBytes,
      maxChunkChars: config.maxChunkChars
    }, cache);
    const headContext = await scanRepository({
      rootDir: headDir,
      maxFiles: config.maxContextFiles,
      maxBytes: config.maxContextBytes,
      maxFileBytes: config.maxFileBytes,
      maxChunkChars: config.maxChunkChars
    }, cache);
    const outputPath = outputDir ? join(outputDir, "DIFF.md") : join(dir, "DIFF.md");
    if (outputDir) {
      await mkdir(outputDir, { recursive: true });
    }
    const diffResult = await analyzeDiff(baseContext, headContext, baseDir, headDir);
    const report = formatDiffReport(diffResult, base, head);
    if (!config.aiProviderApiKey) {
      await writeFile(outputPath, report, "utf8");
      log.info("wrote diff report", { path: outputPath });
    } else {
      const provider = createAIProvider(config);
      const analysis = await generateDiffAnalysis(provider, baseContext, headContext, config.aiProviderModel);
      await writeFile(outputPath, `${report}

## AI Analysis

${analysis}`, "utf8");
      log.info("wrote diff report with AI analysis", { path: outputPath });
    }
  } finally {
    await rm(baseDir, { recursive: true, force: true });
    await rm(headDir, { recursive: true, force: true });
  }
}
var program = new Command();
program.name("reposight").description("Generate living documentation from codebases").version("0.1.0");
program.command("scan [dir]").description("Scan a repository and generate architecture documentation").option("-o, --output <dir>", "Output directory (defaults to repo root)").option("--no-mermaid", "Skip Mermaid diagram generation").option("--file-level", "Generate file-level dependency graph instead of package-level").option("--ignore-tests", "Exclude test files from scanning").option("--target-file <path>", "Score files relative to this target (proximity, test-pairing, same-package)").option("-f, --format <format>", "Output format: json (default) or markdown").option("--include <patterns...>", "Only include files matching these glob patterns").option("--exclude <patterns...>", "Exclude files matching these glob patterns").option("--files <paths...>", "Scan only these specific files (relative paths)").option("--summarize", "Generate AI-powered file summaries (requires API key)").action(async (dir, options) => {
  try {
    await runScan(dir ?? ".", options.output ?? "", { noMermaid: !options.mermaid, fileLevel: options.fileLevel, ignoreTests: options.ignoreTests, targetFile: options.targetFile, format: options.format, include: options.include, exclude: options.exclude, files: options.files, summarize: options.summarize });
  } catch (error) {
    process2.stderr.write(`reposight: ${errorMessage(error)}
`);
    process2.exitCode = 1;
  }
});
program.command("trace [dir] [query]").description("Trace code flow through a repository").action(async (dir, query) => {
  if (!query) {
    process2.stderr.write("reposight: missing required argument 'query'\n");
    process2.exitCode = 1;
    return;
  }
  try {
    await runTrace(dir ?? ".", query);
  } catch (error) {
    process2.stderr.write(`reposight: ${errorMessage(error)}
`);
    process2.exitCode = 1;
  }
});
program.command("diff [dir]").description("Compare two git refs and analyze changes").requiredOption("--base <ref>", "Base git ref (e.g., main)").option("--head <ref>", "Head git ref (defaults to HEAD)", "HEAD").option("-o, --output <dir>", "Output directory (defaults to repo root)").action(async (dir, options) => {
  try {
    await runDiff(dir ?? ".", options.base, options.head, options.output ?? "");
  } catch (error) {
    process2.stderr.write(`reposight: ${errorMessage(error)}
`);
    process2.exitCode = 1;
  }
});
program.command("init [dir]").description("Generate a .reposightrc.json configuration file").action(async (dir) => {
  try {
    const targetDir = dir ?? ".";
    const configPath = join(targetDir, ".reposightrc.json");
    try {
      await fs5.readFile(configPath, "utf8");
      process2.stderr.write(`reposight: ${configPath} already exists
`);
      process2.exitCode = 1;
      return;
    } catch {
    }
    const defaultConfig = {
      maxContextFiles: 80,
      maxContextBytes: 12e4,
      maxFileBytes: 8e4,
      maxChunkChars: 6e3,
      aiProviderModel: "gpt-4o-mini",
      includeMermaid: true,
      logLevel: "info"
    };
    await writeFile(configPath, JSON.stringify(defaultConfig, null, 2) + "\n", "utf8");
    log.info("created config file", { path: configPath });
    process2.stdout.write(`Created ${configPath}
`);
  } catch (error) {
    process2.stderr.write(`reposight: ${errorMessage(error)}
`);
    process2.exitCode = 1;
  }
});
program.command("explorer [dir]").description("Copy the web UI next to your ARCHITECTURE.json for local viewing").option("-o, --output <dir>", "Output directory (defaults to current directory)").option("--download", "Download the latest UI from GitHub instead of copying locally").action(async (dir, options) => {
  try {
    await runExplorer(options.output ?? dir ?? ".", options.download ?? false);
  } catch (error) {
    process2.stderr.write(`reposight: ${errorMessage(error)}
`);
    process2.exitCode = 1;
  }
});
program.command("serve [dir]").description("Start a local server to view the architecture graph").option("-p, --port <port>", "Port to serve on", "3000").action(async (dir, options) => {
  try {
    await runServe(dir ?? ".", parseInt(options.port, 10));
  } catch (error) {
    process2.stderr.write(`reposight: ${errorMessage(error)}
`);
    process2.exitCode = 1;
  }
});
program.action(() => program.help());
await program.parseAsync();
