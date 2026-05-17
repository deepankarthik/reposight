export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  name?: string;
}

const KEEP_LAST_MESSAGES = 4;
const COMPRESS_FIRST_SENTENCES = 1;

export function estimateMessageBytes(msg: ChatMessage): number {
  return Buffer.byteLength(msg.content, "utf8") + (msg.name ? Buffer.byteLength(msg.name, "utf8") : 0) + 20;
}

export function estimateTotalBytes(messages: ChatMessage[]): number {
  return messages.reduce((total, msg) => total + estimateMessageBytes(msg), 0);
}

function compressMessage(msg: ChatMessage): ChatMessage {
  const sentences = msg.content.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 2) {
    return { ...msg, content: `[compressed] ${msg.content}` };
  }
  return {
    ...msg,
    content: `[compressed] ${sentences[0]} ... ${sentences[sentences.length - 1]}`
  };
}

function compactMessages(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      const sentences = m.content.split(/(?<=[.!?])\s+/);
      if (sentences.length <= 2) return `${m.role}: ${m.content}`;
      const first = sentences.slice(0, COMPRESS_FIRST_SENTENCES).join(" ");
      const last = sentences[sentences.length - 1];
      return `${m.role}: ${first} ... ${last}`;
    })
    .join("\n");
}

export interface TrimOptions {
  budget: number;
  keepLast?: number;
  summarizeFn?: (messages: ChatMessage[]) => Promise<string>;
}

export async function trimToBudget(messages: ChatMessage[], options: TrimOptions): Promise<ChatMessage[]> {
  const { budget, summarizeFn } = options;
  const keepLastCount = options.keepLast ?? KEEP_LAST_MESSAGES;

  if (estimateTotalBytes(messages) <= budget) {
    return messages;
  }

  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  if (nonSystem.length <= keepLastCount) {
    return systemMsg ? [systemMsg, ...nonSystem] : nonSystem;
  }

  const lastMessages = nonSystem.slice(-keepLastCount);
  const middleMessages = nonSystem.slice(0, -keepLastCount);

  let summarized: ChatMessage[];

  if (summarizeFn) {
    try {
      const summary = await summarizeFn(middleMessages);
      summarized = [{ role: "user" as const, content: `[Previous conversation summary]\n${summary}` }];
    } catch {
      summarized = [{ role: "user" as const, content: `[Previous conversation summary]\n${compactMessages(middleMessages)}` }];
    }
  } else {
    summarized = middleMessages.map(compressMessage);
  }

  const result = systemMsg ? [systemMsg, ...summarized, ...lastMessages] : [...summarized, ...lastMessages];

  if (estimateTotalBytes(result) > budget && summarized.length > 1) {
    const singleSummary = [{ role: "user" as const, content: summarized.map((m) => m.content).join("\n") }];
    return systemMsg ? [systemMsg, ...singleSummary, ...lastMessages] : [...singleSummary, ...lastMessages];
  }

  return result;
}
