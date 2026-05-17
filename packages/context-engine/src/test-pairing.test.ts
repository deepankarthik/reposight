import { describe, it, expect } from "vitest";
import { isTestFile, isSourceFile, findTestPair, getTestPairScore } from "./test-pairing.js";

describe("isTestFile", () => {
  it("should identify .test. files", () => {
    expect(isTestFile("foo.test.ts")).toBe(true);
    expect(isTestFile("bar.test.js")).toBe(true);
  });

  it("should identify .spec. files", () => {
    expect(isTestFile("foo.spec.ts")).toBe(true);
    expect(isTestFile("bar.spec.js")).toBe(true);
  });

  it("should identify __tests__ directory files", () => {
    expect(isTestFile("src/__tests__/foo.ts")).toBe(true);
    expect(isTestFile("lib/__tests__/bar.ts")).toBe(true);
  });

  it("should not identify source files as tests", () => {
    expect(isTestFile("foo.ts")).toBe(false);
    expect(isTestFile("src/index.ts")).toBe(false);
  });
});

describe("isSourceFile", () => {
  it("should identify source files", () => {
    expect(isSourceFile("foo.ts")).toBe(true);
    expect(isSourceFile("src/index.ts")).toBe(true);
  });

  it("should not identify test files as source", () => {
    expect(isSourceFile("foo.test.ts")).toBe(false);
    expect(isSourceFile("bar.spec.ts")).toBe(false);
  });
});

describe("findTestPair", () => {
  it("should find matching source file from test", () => {
    const files = ["src/foo.ts", "src/foo.test.ts", "src/bar.ts"];
    const result = findTestPair("src/foo.test.ts", files);
    expect(result).toBe("src/foo.ts");
  });

  it("should return null if no match", () => {
    const files = ["src/foo.ts", "src/bar.ts"];
    const result = findTestPair("src/foo.ts", files);
    expect(result).toBeNull();
  });
});

describe("getTestPairScore", () => {
  it("should return 1.0 for test/source pair match", () => {
    const files = ["src/foo.ts", "src/foo.test.ts"];
    const score = getTestPairScore("src/foo.test.ts", files, "src/foo.ts");
    expect(score).toBe(1.0);
  });

  it("should return 0.3 for same directory test/source pair", () => {
    const files = ["src/foo.ts", "src/foo.test.ts"];
    const score = getTestPairScore("src/foo.test.ts", files, "src/bar.ts");
    expect(score).toBe(0.3);
  });

  it("should return 0 for no relationship", () => {
    const files = ["src/foo.ts", "lib/bar.ts"];
    const score = getTestPairScore("src/foo.ts", files, "lib/bar.ts");
    expect(score).toBe(0);
  });
});
