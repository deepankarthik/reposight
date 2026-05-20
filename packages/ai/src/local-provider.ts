import type { AIProvider, AIStreamRequest } from "./types.js";

const FALLBACK = "No AI provider configured. Set AI_PROVIDER_API_KEY for AI-generated summaries.";

export class LocalAIProvider implements AIProvider {
  readonly name = "local";

  async *streamChat(): AsyncIterable<string> {
    yield FALLBACK;
  }

  async chat(): Promise<string> {
    return FALLBACK;
  }
}
