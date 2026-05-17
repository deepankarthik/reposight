import { RepoLensError, safeJsonParse } from "@repolens/shared";
import type { AIProvider, AIStreamRequest } from "./types.js";

interface RemoteProviderOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const ALLOWED_AI_DOMAINS = new Set([
  "api.openai.com",
  "openrouter.ai",
  "api.together.xyz",
  "api.groq.com",
  "api.anthropic.com",
  "api.deepseek.com"
]);

const AI_PROVIDER_TIMEOUT_MS = 120_000;

const BLOCKED_PORTS = new Set([22, 23, 25, 53, 110, 135, 139, 445, 1433, 3306, 3389, 5432, 6379, 8500, 27017]);

function validateBaseUrl(baseUrl: string): void {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      throw new RepoLensError("AI provider must use HTTPS", "SSRF_PREVENTION", 400);
    }
    const port = parsed.port ? Number.parseInt(parsed.port, 10) : (parsed.protocol === "https:" ? 443 : 80);
    if (BLOCKED_PORTS.has(port)) {
      throw new RepoLensError("AI provider port is not allowed", "SSRF_PREVENTION", 400);
    }
    if (!ALLOWED_AI_DOMAINS.has(parsed.hostname) && parsed.hostname !== "localhost") {
      throw new RepoLensError(`Untrusted AI provider host: ${parsed.hostname}`, "SSRF_PREVENTION", 400);
    }
  } catch (error) {
    if (error instanceof RepoLensError) throw error;
    throw new RepoLensError("Invalid AI provider base URL", "SSRF_PREVENTION", 400);
  }
}

interface StreamDelta {
  content?: string;
}

interface StreamChoice {
  delta?: StreamDelta;
  finish_reason?: string | null;
}

interface StreamEvent {
  choices?: StreamChoice[];
}

export class RemoteAIProvider implements AIProvider {
  readonly name = "remote";

  constructor(private readonly options: RemoteProviderOptions) {
    validateBaseUrl(options.baseUrl);
  }

  async *streamChat(request: AIStreamRequest): AsyncIterable<string> {
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
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice("data:".length).trim();
          if (payload === "[DONE]") return;

          const event = safeJsonParse<StreamEvent>(payload);
          const content = event?.choices?.[0]?.delta?.content;
          if (content) yield content;
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async chat(request: AIStreamRequest): Promise<string> {
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
          max_tokens: 2000,
          stream: false
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new RepoLensError(`AI provider request failed (${response.status})`, "AI_PROVIDER_ERROR", 502);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? "";
    } finally {
      clearTimeout(timeout);
    }
  }
}
