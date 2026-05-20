export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AIProviderConfig {
  aiProviderBaseUrl: string;
  aiProviderApiKey?: string;
  aiProviderModel: string;
}

export interface RepoLensConfig extends AIProviderConfig {
  logLevel: LogLevel;
  maxContextFiles: number;
  maxContextBytes: number;
  maxTokenBudget: number;
  includeMermaid: boolean;
  maxFileBytes: number;
  maxChunkChars: number;
}

export interface RepoLensRcConfig {
  logLevel?: LogLevel;
  aiProviderBaseUrl?: string;
  aiProviderApiKey?: string;
  aiProviderModel?: string;
  maxContextFiles?: number;
  maxContextBytes?: number;
  maxTokenBudget?: number;
  includeMermaid?: boolean;
  maxFileBytes?: number;
  maxChunkChars?: number;
}

function envValue(env: NodeJS.ProcessEnv, key: string, fallback: string): string {
  const value = env[key];
  return value && value.trim().length > 0 ? value : fallback;
}

function envNumber(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function envLogLevel(env: NodeJS.ProcessEnv): LogLevel {
  const value = envValue(env, "REPOLENS_LOG_LEVEL", "info");
  return value === "debug" || value === "warn" || value === "error" ? value : "info";
}

function normalizeServerUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function readConfigFromEnv(env: NodeJS.ProcessEnv = process.env): RepoLensConfig {
  return {
    logLevel: envLogLevel(env),
    aiProviderBaseUrl: normalizeServerUrl(envValue(env, "AI_PROVIDER_BASE_URL", "https://api.openai.com/v1")),
    aiProviderApiKey: env.AI_PROVIDER_API_KEY,
    aiProviderModel: envValue(env, "AI_PROVIDER_MODEL", "gpt-4o-mini"),
    maxContextFiles: envNumber(env, "REPOLENS_MAX_CONTEXT_FILES", 80),
    maxContextBytes: envNumber(env, "REPOLENS_MAX_CONTEXT_BYTES", 120_000),
    maxTokenBudget: envNumber(env, "REPOLENS_MAX_TOKEN_BUDGET", 100_000),
    includeMermaid: env.REPOLENS_INCLUDE_MERMAID !== "false",
    maxFileBytes: envNumber(env, "REPOLENS_MAX_FILE_BYTES", 80_000),
    maxChunkChars: envNumber(env, "REPOLENS_MAX_CHUNK_CHARS", 6_000)
  };
}

export async function loadConfigFile(rootDir: string): Promise<RepoLensRcConfig | null> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  const configPath = path.join(rootDir, ".reposightrc.json");
  try {
    const content = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(content);
    return validateConfig(parsed);
  } catch {
    return null;
  }
}

export function validateConfig(config: unknown): RepoLensRcConfig {
  if (typeof config !== "object" || config === null) {
    return {};
  }

  const obj = config as Record<string, unknown>;
  const validated: RepoLensRcConfig = {};

  if ("logLevel" in obj) {
    if (typeof obj.logLevel === "string" && ["debug", "info", "warn", "error"].includes(obj.logLevel)) {
      validated.logLevel = obj.logLevel as LogLevel;
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

export function mergeConfig(fileConfig: RepoLensRcConfig | null, envConfig: RepoLensConfig): RepoLensConfig {
  if (!fileConfig) return envConfig;

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
