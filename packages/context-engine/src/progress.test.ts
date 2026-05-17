import { describe, it, expect } from "vitest";
import { formatProgress, createProgressCallback } from "./progress.js";

describe("formatProgress", () => {
  it("formats discovering phase", () => {
    const progress = {
      phase: "discovering" as const,
      discoveredFiles: 42,
      processedFiles: 0,
      totalFiles: 0,
      bytesProcessed: 0,
      totalBytes: 0
    };

    expect(formatProgress(progress)).toBe("Discovering files: 42 files found");
  });

  it("formats scoring phase", () => {
    const progress = {
      phase: "scoring" as const,
      discoveredFiles: 100,
      processedFiles: 50,
      totalFiles: 100,
      bytesProcessed: 0,
      totalBytes: 0
    };

    expect(formatProgress(progress)).toBe("Scoring files: 50/100 files (50%), 0 B");
  });

  it("formats reading phase with bytes", () => {
    const progress = {
      phase: "reading" as const,
      discoveredFiles: 100,
      processedFiles: 25,
      totalFiles: 100,
      bytesProcessed: 1024,
      totalBytes: 120000
    };

    expect(formatProgress(progress)).toBe("Reading files: 25/100 files (25%), 1.0 KB");
  });

  it("formats complete phase", () => {
    const progress = {
      phase: "complete" as const,
      discoveredFiles: 100,
      processedFiles: 80,
      totalFiles: 80,
      bytesProcessed: 51200,
      totalBytes: 120000
    };

    expect(formatProgress(progress)).toBe("Complete: 80/80 files (100%), 50.0 KB");
  });

  it("handles zero total files gracefully", () => {
    const progress = {
      phase: "reading" as const,
      discoveredFiles: 0,
      processedFiles: 0,
      totalFiles: 0,
      bytesProcessed: 0,
      totalBytes: 0
    };

    expect(formatProgress(progress)).toBe("Reading files: 0/0 files (0%), 0 B");
  });

  it("formats large byte counts", () => {
    const progress = {
      phase: "reading" as const,
      discoveredFiles: 100,
      processedFiles: 100,
      totalFiles: 100,
      bytesProcessed: 1048576,
      totalBytes: 2097152
    };

    expect(formatProgress(progress)).toContain("1.0 MB");
  });
});

describe("createProgressCallback", () => {
  it("returns no-op function when no callback provided", () => {
    const callback = createProgressCallback();
    expect(() => callback({
      phase: "reading",
      discoveredFiles: 0,
      processedFiles: 0,
      totalFiles: 0,
      bytesProcessed: 0,
      totalBytes: 0
    })).not.toThrow();
  });

  it("calls provided callback", () => {
    let called = false;
    const callback = createProgressCallback(() => { called = true; });

    callback({
      phase: "reading",
      discoveredFiles: 0,
      processedFiles: 0,
      totalFiles: 0,
      bytesProcessed: 0,
      totalBytes: 0
    });

    expect(called).toBe(true);
  });
});
