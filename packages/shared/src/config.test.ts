import { describe, it, expect } from "vitest";
import { mergeConfig, readConfigFromEnv, validateConfig, type RepoLensRcConfig, type RepoLensConfig } from "./config.js";

function makeEnvConfig(overrides: Partial<RepoLensConfig> = {}): RepoLensConfig {
  return {
    logLevel: "info",
    aiProviderBaseUrl: "https://api.openai.com/v1",
    aiProviderApiKey: undefined,
    aiProviderModel: "gpt-4o-mini",
    maxContextFiles: 80,
    maxContextBytes: 120_000,
    includeMermaid: true,
    maxFileBytes: 80_000,
    maxChunkChars: 6_000,
    ...overrides
  };
}

describe("mergeConfig", () => {
  it("returns env config when file config is null", () => {
    const envConfig = makeEnvConfig();
    const result = mergeConfig(null, envConfig);
    expect(result).toEqual(envConfig);
  });

  it("file config overrides env config for numbers", () => {
    const envConfig = makeEnvConfig();
    const fileConfig: RepoLensRcConfig = { maxContextFiles: 200, maxContextBytes: 500_000 };
    const result = mergeConfig(fileConfig, envConfig);
    expect(result.maxContextFiles).toBe(200);
    expect(result.maxContextBytes).toBe(500_000);
  });

  it("file config overrides env config for strings", () => {
    const envConfig = makeEnvConfig();
    const fileConfig: RepoLensRcConfig = { aiProviderModel: "claude-3-opus", aiProviderBaseUrl: "https://custom.api.com" };
    const result = mergeConfig(fileConfig, envConfig);
    expect(result.aiProviderModel).toBe("claude-3-opus");
    expect(result.aiProviderBaseUrl).toBe("https://custom.api.com");
  });

  it("file config overrides env config for booleans", () => {
    const envConfig = makeEnvConfig();
    const fileConfig: RepoLensRcConfig = { includeMermaid: false };
    const result = mergeConfig(fileConfig, envConfig);
    expect(result.includeMermaid).toBe(false);
  });

  it("file config overrides env config for log level", () => {
    const envConfig = makeEnvConfig();
    const fileConfig: RepoLensRcConfig = { logLevel: "debug" };
    const result = mergeConfig(fileConfig, envConfig);
    expect(result.logLevel).toBe("debug");
  });

  it("file config can set API key", () => {
    const envConfig = makeEnvConfig();
    const fileConfig: RepoLensRcConfig = { aiProviderApiKey: "sk-test-key" };
    const result = mergeConfig(fileConfig, envConfig);
    expect(result.aiProviderApiKey).toBe("sk-test-key");
  });

  it("env config takes precedence when file has undefined", () => {
    const envConfig = makeEnvConfig({ maxContextFiles: 150 });
    const fileConfig: RepoLensRcConfig = {};
    const result = mergeConfig(fileConfig, envConfig);
    expect(result.maxContextFiles).toBe(150);
  });

  it("partial file config merges correctly", () => {
    const envConfig = makeEnvConfig();
    const fileConfig: RepoLensRcConfig = { maxContextFiles: 50 };
    const result = mergeConfig(fileConfig, envConfig);
    expect(result.maxContextFiles).toBe(50);
    expect(result.maxContextBytes).toBe(120_000);
    expect(result.aiProviderModel).toBe("gpt-4o-mini");
  });
});

describe("readConfigFromEnv", () => {
  it("uses defaults when no env vars set", () => {
    const config = readConfigFromEnv({});
    expect(config.maxContextFiles).toBe(80);
    expect(config.maxContextBytes).toBe(120_000);
    expect(config.aiProviderModel).toBe("gpt-4o-mini");
    expect(config.logLevel).toBe("info");
  });

  it("reads env vars correctly", () => {
    const config = readConfigFromEnv({
      REPOLENS_MAX_CONTEXT_FILES: "200",
      REPOLENS_MAX_CONTEXT_BYTES: "500000",
      AI_PROVIDER_MODEL: "claude-3",
      REPOLENS_LOG_LEVEL: "debug"
    });
    expect(config.maxContextFiles).toBe(200);
    expect(config.maxContextBytes).toBe(500_000);
    expect(config.aiProviderModel).toBe("claude-3");
    expect(config.logLevel).toBe("debug");
  });

  it("normalizes server URL", () => {
    const config = readConfigFromEnv({
      AI_PROVIDER_BASE_URL: "https://api.example.com/"
    });
    expect(config.aiProviderBaseUrl).toBe("https://api.example.com");
  });
});

describe("loadConfigFile validation", () => {
  it("ignores invalid field types", () => {
    const config = {
      maxContextFiles: "not a number",
      logLevel: 123,
      includeMermaid: "yes"
    };

    const result = (config as any).__proto__ ? config : { ...config };
    const validated = validateConfig(result);
    expect(validated).toEqual({});
  });

  it("accepts valid config values", () => {
    const config = {
      maxContextFiles: 100,
      maxContextBytes: 200000,
      logLevel: "debug",
      includeMermaid: false
    };

    const validated = validateConfig(config);
    expect(validated?.maxContextFiles).toBe(100);
    expect(validated?.maxContextBytes).toBe(200000);
    expect(validated?.logLevel).toBe("debug");
    expect(validated?.includeMermaid).toBe(false);
  });

  it("ignores unknown fields", () => {
    const config = {
      maxContextFiles: 100,
      unknownField: "should be ignored",
      anotherUnknown: 42
    };

    const validated = validateConfig(config);
    expect(validated).toEqual({ maxContextFiles: 100 });
  });

  it("handles null config gracefully", () => {
    expect(validateConfig(null)).toEqual({});
  });

  it("handles non-object config gracefully", () => {
    expect(validateConfig("string")).toEqual({});
    expect(validateConfig(42)).toEqual({});
    expect(validateConfig(true)).toEqual({});
  });

  it("rejects negative numbers for size fields", () => {
    const config = {
      maxContextFiles: -1,
      maxContextBytes: 0
    };

    const validated = validateConfig(config);
    expect(validated?.maxContextFiles).toBeUndefined();
    expect(validated?.maxContextBytes).toBeUndefined();
  });
});
