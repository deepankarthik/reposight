import type { ChatMessage } from "@repolens/shared";
import type { AIProvider } from "./types.js";

const SUMMARY_PROMPT = "Summarize the following conversation history concisely. Focus on key decisions, context, and user requests. Keep it under 200 words.";

export function createSummarizeFn(provider: AIProvider, summaryModel: string): (messages: ChatMessage[]) => Promise<string> {
  return async (messages: ChatMessage[]): Promise<string> => {
    const summaryMessages: ChatMessage[] = [
      { role: "system", content: SUMMARY_PROMPT },
      ...messages
    ];
    if (provider.chat) {
      return await provider.chat({ messages: summaryMessages, model: summaryModel, temperature: 0.1 });
    }
    const chunks: string[] = [];
    for await (const chunk of provider.streamChat({ messages: summaryMessages, model: summaryModel, temperature: 0.1 })) {
      chunks.push(chunk);
    }
    return chunks.join("");
  };
}
