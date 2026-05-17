export type Language = "typescript" | "python" | "javascript" | "text";

export interface CodeSymbol {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "variable" | "method" | "unknown";
  line: number;
}

export interface ContextFile {
  path: string;
  absolutePath?: string;
  language: string;
  content: string;
  size: number;
  startLine?: number;
  endLine?: number;
  symbols?: CodeSymbol[];
  imports?: string[];
}

export interface ContextChunk extends ContextFile {
  chunkIndex: number;
  totalChunks: number;
}

export interface RepositoryContext {
  rootDir: string;
  files: ContextFile[];
  chunks: ContextChunk[];
  summary: {
    scannedFiles: number;
    includedFiles: number;
    totalBytes: number;
    truncated: boolean;
    skippedFiles: number;
    cacheHits?: number;
    cacheMisses?: number;
  };
  importGraph?: {
    nodes: Map<string, ImportGraphNode>;
  };
}

export interface ImportGraphNode {
  absolutePath: string;
  relativePath: string;
  imports: string[];
  importedBy: string[];
  importCount: number;
}
