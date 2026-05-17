import type { ChatMessage } from "@repolens/shared";

export interface AIStreamRequest {
  messages: ChatMessage[];
  temperature?: number;
  model?: string;
}

export interface AIProvider {
  readonly name: string;
  streamChat(request: AIStreamRequest): AsyncIterable<string>;
  chat?(request: AIStreamRequest): Promise<string>;
}
