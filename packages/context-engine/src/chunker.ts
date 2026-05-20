import type { ContextChunk, ContextFile } from "@reposight/shared";

export function chunkFile(file: ContextFile, maxChunkChars = 6_000): ContextChunk[] {
  if (file.content.length <= maxChunkChars) {
    return [{ ...file, chunkIndex: 1, totalChunks: 1 }];
  }

  const lines = file.content.split(/\r?\n/);
  const chunks: Omit<ContextChunk, "totalChunks">[] = [];
  let current: string[] = [];
  let currentLength = 0;
  let startLine = 1;

  for (const [index, line] of lines.entries()) {
    const lineLength = line.length + 1;
    if (current.length > 0 && currentLength + lineLength > maxChunkChars) {
      chunks.push({
        ...file,
        content: current.join("\n"),
        startLine,
        endLine: startLine + current.length - 1,
        chunkIndex: chunks.length + 1
      });
      current = [];
      currentLength = 0;
      startLine = index + 1;
    }

    current.push(line);
    currentLength += lineLength;
  }

  if (current.length > 0) {
    chunks.push({
      ...file,
      content: current.join("\n"),
      startLine,
      endLine: lines.length,
      chunkIndex: chunks.length + 1
    });
  }

  const totalChunks = chunks.length;
  return chunks.map((chunk) => ({ ...chunk, totalChunks }));
}
