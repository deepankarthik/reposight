import type { AIProviderConfig } from "@reposight/shared";
import { LocalAIProvider } from "./local-provider.js";
import { RemoteAIProvider } from "./remote-provider.js";
import type { AIProvider } from "./types.js";

export function createAIProvider(config: AIProviderConfig): AIProvider {
  if (!config.aiProviderApiKey) {
    return new LocalAIProvider();
  }

  return new RemoteAIProvider({
    baseUrl: config.aiProviderBaseUrl,
    apiKey: config.aiProviderApiKey,
    model: config.aiProviderModel
  });
}
