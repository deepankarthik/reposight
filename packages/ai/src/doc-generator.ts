import type { AIProvider } from "./types.js";

const TRACE_PROMPT = `You are a senior software engineer tracing code flow through a repository. Given a query about how something works in the codebase, trace the flow through the relevant files.

Focus on:
1. Entry point(s) where the flow begins
2. Each file and function involved in the chain
3. Data transformations at each step
4. Return flow and final output

Use concrete file paths, function names, and line references from the context. Be specific about the actual code, not generic descriptions.`;

const DIFF_ANALYSIS_PROMPT = `You are a senior software engineer comparing two versions of a codebase. Analyze the structural differences between the old and new versions.

Focus on:
1. What was added and why it matters
2. What was removed and the impact
3. What was modified and the nature of changes
4. Overall architectural impact

Be specific about files, functions, and patterns. Keep it under 300 words.`;

async function callProvider(provider: AIProvider, messages: Array<{ role: string; content: string }>, model: string): Promise<string> {
  if (provider.chat) {
    return await provider.chat({ messages, model, temperature: 0.1 });
  }
  const chunks: string[] = [];
  for await (const chunk of provider.streamChat({ messages, model, temperature: 0.1 })) {
    chunks.push(chunk);
  }
  return chunks.join("");
}

export async function generateTraceExplanation(
  provider: AIProvider,
  context: { files: Array<{ path: string; symbols?: Array<{ kind: string; name: string; line: number }> }> },
  query: string,
  model: string
): Promise<string> {
  const files = context.files.slice(0, 20).map((f) => {
    const symbols = f.symbols?.map((s) => `  - ${s.kind} ${s.name} (line ${s.line})`).join("\n") || "  (no symbols)";
    return `File: ${f.path}\n${symbols}`;
  }).join("\n\n");

  const messages = [
    { role: "system", content: TRACE_PROMPT },
    { role: "user", content: `Query: ${query}\n\nFiles:\n${files}` }
  ];

  return callProvider(provider, messages, model);
}

export async function generateDiffAnalysis(
  provider: AIProvider,
  oldContext: { files: Array<{ path: string }> },
  newContext: { files: Array<{ path: string }> },
  model: string
): Promise<string> {
  const oldFiles = oldContext.files.map((f) => f.path).join("\n");
  const newFiles = newContext.files.map((f) => f.path).join("\n");

  const messages = [
    { role: "system", content: DIFF_ANALYSIS_PROMPT },
    { role: "user", content: `Old version files:\n${oldFiles}\n\nNew version files:\n${newFiles}` }
  ];

  return callProvider(provider, messages, model);
}
