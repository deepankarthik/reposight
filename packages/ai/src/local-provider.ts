import type { AIProvider, AIStreamRequest } from "./types.js";

async function* simulateStreaming(text: string, chunkSize = 32): AsyncIterable<string> {
  for (let index = 0; index < text.length; index += chunkSize) {
    yield text.slice(index, index + chunkSize);
    await new Promise((resolve) => setTimeout(resolve, 8));
  }
}

const MAX_REQUEST_CHARS = 500;

const DEV_RESPONSE = [
  "RepoLens local mode — no AI provider configured.\n\n",
  "Set `AI_PROVIDER_API_KEY` for AI-generated architecture summaries and trace explanations.\n\n",
  "Request received:\n",
  "{{USER_REQUEST}}"
].join("");

const PROD_FALLBACK_RESPONSE = "No AI model available. Set AI_PROVIDER_API_KEY for AI-generated documentation.";

export class LocalAIProvider implements AIProvider {
  readonly name = "local";

  async *streamChat(request: AIStreamRequest): AsyncIterable<string> {
    const last = [...request.messages].reverse().find((message) => message.role === "user");
    const userRequest = last
      ? last.content.length > MAX_REQUEST_CHARS
        ? `${last.content.slice(0, MAX_REQUEST_CHARS)}...`
        : last.content
      : "No user request was supplied.";

    const response = DEV_RESPONSE.replace("{{USER_REQUEST}}", userRequest);

    for await (const chunk of simulateStreaming(response)) {
      yield chunk;
    }
  }

  async chat(request: AIStreamRequest): Promise<string> {
    const last = [...request.messages].reverse().find((m) => m.role === "user");
    return `[LocalAI] ${last?.content?.slice(0, 200) ?? "No content"}`;
  }
}
