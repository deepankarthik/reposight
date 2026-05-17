export interface ScanProgress {
  phase: "discovering" | "scoring" | "reading" | "ai-summarizing" | "complete";
  discoveredFiles: number;
  processedFiles: number;
  totalFiles: number;
  bytesProcessed: number;
  totalBytes: number;
}

export type ProgressCallback = (progress: ScanProgress) => void;

export function createProgressCallback(onProgress?: ProgressCallback): ProgressCallback {
  if (!onProgress) return () => {};
  return onProgress;
}

export function formatProgress(progress: ScanProgress): string {
  const pct = progress.totalFiles > 0
    ? Math.round((progress.processedFiles / progress.totalFiles) * 100)
    : 0;

  const bytesPct = progress.totalBytes > 0
    ? Math.round((progress.bytesProcessed / progress.totalBytes) * 100)
    : 0;

  const phaseLabels: Record<string, string> = {
    discovering: "Discovering files",
    scoring: "Scoring files",
    reading: "Reading files",
    "ai-summarizing": "AI summarizing",
    complete: "Complete"
  };

  const phase = phaseLabels[progress.phase] ?? progress.phase;

  if (progress.phase === "discovering") {
    return `${phase}: ${progress.discoveredFiles} files found`;
  }

  return `${phase}: ${progress.processedFiles}/${progress.totalFiles} files (${pct}%), ${formatBytes(progress.bytesProcessed)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
