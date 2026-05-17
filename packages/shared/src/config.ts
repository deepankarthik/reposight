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
