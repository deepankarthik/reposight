import { describe, it, expect } from "vitest";
import { RemoteAIProvider } from "./remote-provider.js";

describe("RemoteAIProvider SSRF validation", () => {
  it("should allow valid HTTPS domains", () => {
    expect(() => new RemoteAIProvider({ baseUrl: "https://api.openai.com/v1", apiKey: "key", model: "gpt-4" })).not.toThrow();
    expect(() => new RemoteAIProvider({ baseUrl: "https://api.anthropic.com/v1", apiKey: "key", model: "claude" })).not.toThrow();
    expect(() => new RemoteAIProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: "key", model: "model" })).not.toThrow();
  });

  it("should allow localhost", () => {
    expect(() => new RemoteAIProvider({ baseUrl: "https://localhost:8080", apiKey: "key", model: "model" })).not.toThrow();
  });

  it("should reject HTTP URLs", () => {
    expect(() => new RemoteAIProvider({ baseUrl: "http://api.openai.com/v1", apiKey: "key", model: "model" })).toThrow("HTTPS");
  });

  it("should reject untrusted domains", () => {
    expect(() => new RemoteAIProvider({ baseUrl: "https://evil.com/v1", apiKey: "key", model: "model" })).toThrow("Untrusted");
  });

  it("should reject blocked ports", () => {
    expect(() => new RemoteAIProvider({ baseUrl: "https://api.openai.com:22/v1", apiKey: "key", model: "model" })).toThrow("port");
    expect(() => new RemoteAIProvider({ baseUrl: "https://api.openai.com:3306/v1", apiKey: "key", model: "model" })).toThrow("port");
  });

  it("should reject invalid URLs", () => {
    expect(() => new RemoteAIProvider({ baseUrl: "not-a-url", apiKey: "key", model: "model" })).toThrow("Invalid");
  });
});
