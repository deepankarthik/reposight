import type { ChatMessage, RepositoryContext } from "@repolens/shared";
import type { AIProvider } from "./types.js";

const ARCHITECTURE_SUMMARY_PROMPT = `You are a senior software architect analyzing a codebase. Generate a concise architecture summary based on the repository context provided.

Focus on:
1. The overall structure and organization
2. Key components and their responsibilities
3. Data flow patterns
4. Notable design patterns or architectural decisions
5. Potential areas of concern (tight coupling, missing abstractions)

Be specific, use concrete file and symbol names from the context. Keep it under 500 words.`;

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

async function callProvider(provider: AIProvider, messages: ChatMessage[], model: string): Promise<string> {
  if (provider.chat) {
    return await provider.chat({ messages, model, temperature: 0.1 });
  }
  const chunks: string[] = [];
  for await (const chunk of provider.streamChat({ messages, model, temperature: 0.1 })) {
    chunks.push(chunk);
  }
  return chunks.join("");
}

function formatContext(context: RepositoryContext): string {
  const files = context.files.slice(0, 20).map((f) => {
    const symbols = f.symbols?.map((s) => `  - ${s.kind} ${s.name} (line ${s.line})`).join("\n") || "  (no symbols)";
    const imports = f.imports?.length ? `  Imports: ${f.imports.join(", ")}` : "  Imports: none";
    return `File: ${f.path}\n${imports}\n${symbols}`;
  }).join("\n\n");

  return `Repository: ${context.rootDir}\nFiles scanned: ${context.summary.scannedFiles}\nFiles included: ${context.summary.includedFiles}\n\n${files}`;
}

export async function generateArchitectureSummary(
  provider: AIProvider,
  context: RepositoryContext,
  model: string
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: ARCHITECTURE_SUMMARY_PROMPT },
    { role: "user", content: formatContext(context) }
  ];

  return callProvider(provider, messages, model);
}

export async function generateTraceExplanation(
  provider: AIProvider,
  context: RepositoryContext,
  query: string,
  model: string
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: TRACE_PROMPT },
    { role: "user", content: `Query: ${query}\n\n${formatContext(context)}` }
  ];

  return callProvider(provider, messages, model);
}

export async function generateDiffAnalysis(
  provider: AIProvider,
  oldContext: RepositoryContext,
  newContext: RepositoryContext,
  model: string
): Promise<string> {
  const oldFiles = oldContext.files.map((f) => f.path).join("\n");
  const newFiles = newContext.files.map((f) => f.path).join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: DIFF_ANALYSIS_PROMPT },
    { role: "user", content: `Old version files:\n${oldFiles}\n\nNew version files:\n${newFiles}` }
  ];

  return callProvider(provider, messages, model);
}
