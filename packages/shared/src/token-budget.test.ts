import { describe, it, expect } from "vitest";
import { estimateMessageBytes, estimateTotalBytes, trimToBudget, type ChatMessage } from "./token-budget.js";

describe("estimateMessageBytes", () => {
  it("should estimate bytes for a message", () => {
    const msg: ChatMessage = { role: "user", content: "Hello" };
    const bytes = estimateMessageBytes(msg);
    expect(bytes).toBeGreaterThan(0);
  });

  it("should include name bytes if present", () => {
    const msgWithName: ChatMessage = { role: "user", content: "Hello", name: "test" };
    const msgWithoutName: ChatMessage = { role: "user", content: "Hello" };
    expect(estimateMessageBytes(msgWithName)).toBeGreaterThan(estimateMessageBytes(msgWithoutName));
  });
});

describe("estimateTotalBytes", () => {
  it("should sum bytes for all messages", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "System prompt" },
      { role: "user", content: "Hello" }
    ];
    const total = estimateTotalBytes(messages);
    expect(total).toBeGreaterThan(estimateMessageBytes(messages[0]));
  });

  it("should return 0 for empty array", () => {
    expect(estimateTotalBytes([])).toBe(0);
  });
});

describe("trimToBudget", () => {
  it("should return all messages if under budget", async () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Hello" }
    ];
    const result = await trimToBudget(messages, { budget: 10000 });
    expect(result).toEqual(messages);
  });

  it("should trim messages when over budget", async () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "System" },
      { role: "user", content: "A".repeat(500) },
      { role: "assistant", content: "B".repeat(500) },
      { role: "user", content: "C".repeat(500) },
      { role: "assistant", content: "D".repeat(500) },
      { role: "user", content: "E".repeat(500) },
      { role: "assistant", content: "F".repeat(500) }
    ];
    const result = await trimToBudget(messages, { budget: 500 });
    expect(result.length).toBeLessThan(messages.length);
  });

  it("should always keep system message", async () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "Important system prompt" },
      { role: "user", content: "A".repeat(5000) },
      { role: "assistant", content: "B".repeat(5000) }
    ];
    const result = await trimToBudget(messages, { budget: 1000 });
    expect(result[0]?.role).toBe("system");
  });

  it("should keep last messages", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "A".repeat(500) },
      { role: "assistant", content: "B".repeat(500) },
      { role: "user", content: "C".repeat(500) },
      { role: "assistant", content: "Last" }
    ];
    const result = await trimToBudget(messages, { budget: 200, keepLast: 1 });
    expect(result[result.length - 1]?.content).toBe("Last");
  });

  it("should use summarizeFn when provided", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "First. Second. Third. Fourth. Fifth." },
      { role: "assistant", content: "Reply. More text. And more. Even more. Final." },
      { role: "user", content: "Another. Message. Here. With. Text." },
      { role: "assistant", content: "Response. Data. Info. Stuff. End." },
      { role: "user", content: "Last message." }
    ];
    const summarizeFn = async () => "Summarized content";
    const result = await trimToBudget(messages, { budget: 50, summarizeFn });
    const summaryMsg = result.find((m) => m.content.includes("[Previous conversation summary]"));
    expect(summaryMsg).toBeDefined();
    expect(summaryMsg?.content).toContain("Summarized content");
  });

  it("should fallback to compression if summarizeFn fails", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "First. Second. Third." },
      { role: "assistant", content: "Reply. More text. End." },
      { role: "user", content: "Another. Message. Here." },
      { role: "assistant", content: "Response. Data. End." },
      { role: "user", content: "Last" }
    ];
    const summarizeFn = async () => { throw new Error("fail"); };
    const result = await trimToBudget(messages, { budget: 50, summarizeFn });
    const summaryMsg = result.find((m) => m.content.includes("[Previous conversation summary]"));
    expect(summaryMsg).toBeDefined();
  });
});
