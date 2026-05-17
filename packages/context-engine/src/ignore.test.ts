import { describe, it, expect } from "vitest";
import { shouldIgnorePath } from "./ignore.js";

describe("shouldIgnorePath", () => {
  it("should ignore node_modules", () => {
    expect(shouldIgnorePath("node_modules/foo")).toBe(true);
    expect(shouldIgnorePath("packages/foo/node_modules/bar")).toBe(true);
  });

  it("should ignore dist and build directories", () => {
    expect(shouldIgnorePath("dist/index.js")).toBe(true);
    expect(shouldIgnorePath("build/output.js")).toBe(true);
    expect(shouldIgnorePath(".next/page.js")).toBe(true);
  });

  it("should ignore .git directory", () => {
    expect(shouldIgnorePath(".git/config")).toBe(true);
    expect(shouldIgnorePath(".git/HEAD")).toBe(true);
  });

  it("should ignore lock files", () => {
    expect(shouldIgnorePath("package-lock.json")).toBe(true);
    expect(shouldIgnorePath("pnpm-lock.yaml")).toBe(true);
    expect(shouldIgnorePath("yarn.lock")).toBe(true);
  });

  it("should ignore binary files", () => {
    expect(shouldIgnorePath("image.png")).toBe(true);
    expect(shouldIgnorePath("photo.jpg")).toBe(true);
    expect(shouldIgnorePath("archive.zip")).toBe(true);
    expect(shouldIgnorePath("data.tar.gz")).toBe(true);
  });

  it("should ignore minified files", () => {
    expect(shouldIgnorePath("bundle.min.js")).toBe(true);
    expect(shouldIgnorePath("styles.min.css")).toBe(true);
  });

  it("should allow source files", () => {
    expect(shouldIgnorePath("src/index.ts")).toBe(false);
    expect(shouldIgnorePath("lib/utils.js")).toBe(false);
    expect(shouldIgnorePath("README.md")).toBe(false);
  });

  it("should allow config files", () => {
    expect(shouldIgnorePath("package.json")).toBe(false);
    expect(shouldIgnorePath("tsconfig.json")).toBe(false);
  });

  it("should handle nested source files", () => {
    expect(shouldIgnorePath("packages/shared/src/types.ts")).toBe(false);
    expect(shouldIgnorePath("apps/cli/src/index.ts")).toBe(false);
  });
});
