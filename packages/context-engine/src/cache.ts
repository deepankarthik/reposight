import type { CodeSymbol } from "@reposight/shared";

interface CacheEntry {
  content: string;
  symbols: CodeSymbol[];
  fileComment?: string;
  mtimeMs: number;
  size: number;
  lastAccess: number;
}

const DEFAULT_MAX_ENTRIES = 500;

export class FileCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(options?: { maxEntries?: number }) {
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  get(absolutePath: string, mtimeMs: number, size: number): CacheEntry | null {
    const entry = this.entries.get(absolutePath);
    if (!entry || entry.mtimeMs !== mtimeMs || entry.size !== size) {
      this.misses += 1;
      return null;
    }
    entry.lastAccess = Date.now();
    this.hits += 1;
    return entry;
  }

  set(absolutePath: string, mtimeMs: number, size: number, content: string, symbols: CodeSymbol[], fileComment?: string): void {
    if (this.entries.size >= this.maxEntries) {
      this.evictOldest();
    }
    this.entries.set(absolutePath, { content, symbols, fileComment, mtimeMs, size, lastAccess: Date.now() + this.entries.size });
  }

  invalidate(absolutePath: string): void {
    this.entries.delete(absolutePath);
  }

  clear(): void {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): { entries: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      entries: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0
    };
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }
    if (oldestKey) this.entries.delete(oldestKey);
  }
}
