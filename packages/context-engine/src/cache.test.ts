import { describe, it, expect } from "vitest";
import { FileCache } from "./cache.js";

describe("FileCache", () => {
  it("should store and retrieve cached entries", () => {
    const cache = new FileCache();
    cache.set("/test/file.ts", 1000, 100, "content", [{ name: "foo", kind: "function", line: 1 }]);

    const result = cache.get("/test/file.ts", 1000, 100);
    expect(result).not.toBeNull();
    expect(result?.content).toBe("content");
    expect(result?.symbols).toHaveLength(1);
  });

  it("should return null on cache miss", () => {
    const cache = new FileCache();
    const result = cache.get("/test/file.ts", 1000, 100);
    expect(result).toBeNull();
  });

  it("should invalidate on mtime change", () => {
    const cache = new FileCache();
    cache.set("/test/file.ts", 1000, 100, "content", []);

    const result = cache.get("/test/file.ts", 2000, 100);
    expect(result).toBeNull();
  });

  it("should invalidate on size change", () => {
    const cache = new FileCache();
    cache.set("/test/file.ts", 1000, 100, "content", []);

    const result = cache.get("/test/file.ts", 1000, 200);
    expect(result).toBeNull();
  });

  it("should evict oldest entries when max size reached", async () => {
    const cache = new FileCache({ maxEntries: 3 });

    cache.set("/a.ts", 1, 10, "a", []);
    await new Promise((r) => setTimeout(r, 10));
    cache.set("/b.ts", 2, 10, "b", []);
    await new Promise((r) => setTimeout(r, 10));
    cache.set("/c.ts", 3, 10, "c", []);
    await new Promise((r) => setTimeout(r, 10));
    cache.set("/d.ts", 4, 10, "d", []);

    const statsAfter = cache.getStats();
    expect(statsAfter.entries).toBe(3);
    expect(cache.get("/d.ts", 4, 10)).not.toBeNull();
  });

  it("should track hit/miss stats", () => {
    const cache = new FileCache();
    cache.set("/test.ts", 1, 10, "content", []);

    cache.get("/test.ts", 1, 10);
    cache.get("/test.ts", 1, 10);
    cache.get("/missing.ts", 1, 10);

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
  });

  it("should invalidate specific entries", () => {
    const cache = new FileCache();
    cache.set("/a.ts", 1, 10, "a", []);
    cache.set("/b.ts", 1, 10, "b", []);

    cache.invalidate("/a.ts");

    expect(cache.get("/a.ts", 1, 10)).toBeNull();
    expect(cache.get("/b.ts", 1, 10)).not.toBeNull();
  });

  it("should clear all entries and reset stats", () => {
    const cache = new FileCache();
    cache.set("/a.ts", 1, 10, "a", []);
    cache.get("/a.ts", 1, 10);
    cache.get("/missing.ts", 1, 10);

    cache.clear();

    expect(cache.getStats().entries).toBe(0);
    expect(cache.getStats().hits).toBe(0);
    expect(cache.getStats().misses).toBe(0);
  });
});
