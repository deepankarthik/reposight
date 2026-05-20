import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { shouldIgnorePath, loadIgnoreFiles, isGeneratedFile, isTestFilePath, setIncludeExcludePatterns, shouldIncludePath } from "./ignore.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("shouldIgnorePath", () => {
  beforeEach(() => {
    loadIgnoreFiles(process.cwd());
  });

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

  it("should ignore test files when ignoreTests is true", () => {
    expect(shouldIgnorePath("src/utils.test.ts", { ignoreTests: true })).toBe(true);
    expect(shouldIgnorePath("src/utils.spec.ts", { ignoreTests: true })).toBe(true);
    expect(shouldIgnorePath("src/utils_test.go", { ignoreTests: true })).toBe(true);
    expect(shouldIgnorePath("test_utils.py", { ignoreTests: true })).toBe(true);
    expect(shouldIgnorePath("tests/test_main.py", { ignoreTests: true })).toBe(true);
  });

  it("should allow test files when ignoreTests is false", () => {
    expect(shouldIgnorePath("src/utils.test.ts", { ignoreTests: false })).toBe(false);
    expect(shouldIgnorePath("src/utils.spec.ts", { ignoreTests: false })).toBe(false);
  });

  it("should allow test files by default", () => {
    expect(shouldIgnorePath("src/utils.test.ts")).toBe(false);
  });
});

describe("isGeneratedFile", () => {
  it("should detect protobuf generated files", () => {
    expect(isGeneratedFile("proto/user.pb.go")).toBe(true);
    expect(isGeneratedFile("proto/user.pb.py")).toBe(true);
    expect(isGeneratedFile("proto/user.pb.grpc.go")).toBe(true);
  });

  it("should detect .gen. files", () => {
    expect(isGeneratedFile("src/types.gen.ts")).toBe(true);
    expect(isGeneratedFile("src/models.gen.go")).toBe(true);
  });

  it("should detect _generated files", () => {
    expect(isGeneratedFile("src/schema_generated.go")).toBe(true);
    expect(isGeneratedFile("src/models_generated.py")).toBe(true);
  });

  it("should detect TypeScript declaration files", () => {
    expect(isGeneratedFile("dist/index.d.ts")).toBe(true);
  });

  it("should detect GraphQL generated files", () => {
    expect(isGeneratedFile("src/graphql.types.ts")).toBe(false);
    expect(isGeneratedFile("src/types.graphql.gen.ts")).toBe(true);
  });

  it("should allow non-generated files", () => {
    expect(isGeneratedFile("src/utils.ts")).toBe(false);
    expect(isGeneratedFile("src/main.go")).toBe(false);
    expect(isGeneratedFile("src/app.py")).toBe(false);
  });
});

describe("isTestFilePath", () => {
  it("should detect TypeScript test files", () => {
    expect(isTestFilePath("src/utils.test.ts")).toBe(true);
    expect(isTestFilePath("src/utils.spec.tsx")).toBe(true);
  });

  it("should detect Go test files", () => {
    expect(isTestFilePath("src/utils_test.go")).toBe(true);
  });

  it("should detect Python test files", () => {
    expect(isTestFilePath("test_utils.py")).toBe(true);
    expect(isTestFilePath("tests/test_main.py")).toBe(true);
  });

  it("should detect Java test files", () => {
    expect(isTestFilePath("src/UserTest.java")).toBe(true);
    expect(isTestFilePath("src/UserTests.java")).toBe(true);
  });

  it("should allow non-test files", () => {
    expect(isTestFilePath("src/utils.ts")).toBe(false);
    expect(isTestFilePath("src/main.go")).toBe(false);
    expect(isTestFilePath("src/app.py")).toBe(false);
  });
});

describe("loadIgnoreFiles", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reposight-ignore-"));
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should load .gitignore patterns", () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "*.log\ntemp/\n");
    loadIgnoreFiles(tmpDir);
    expect(shouldIgnorePath("debug.log")).toBe(true);
    expect(shouldIgnorePath("temp/file.txt")).toBe(true);
  });

  it("should load .reposightignore patterns", () => {
    fs.writeFileSync(path.join(tmpDir, ".reposightignore"), "*.generated.ts\nmocks/\n");
    loadIgnoreFiles(tmpDir);
    expect(shouldIgnorePath("src/types.generated.ts")).toBe(true);
    expect(shouldIgnorePath("mocks/data.ts")).toBe(true);
  });

  it("should handle missing ignore files", () => {
    loadIgnoreFiles(tmpDir);
    expect(shouldIgnorePath("src/index.ts")).toBe(false);
  });

  it("should handle empty ignore files", () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "");
    loadIgnoreFiles(tmpDir);
    expect(shouldIgnorePath("src/index.ts")).toBe(false);
  });

  it("should ignore comments in ignore files", () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "# comment\n*.log\n");
    loadIgnoreFiles(tmpDir);
    expect(shouldIgnorePath("debug.log")).toBe(true);
  });

  it("should handle negation patterns", () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "*.tmp\n!important.tmp\n");
    loadIgnoreFiles(tmpDir);
    expect(shouldIgnorePath("debug.tmp")).toBe(true);
    expect(shouldIgnorePath("error.tmp")).toBe(true);
    expect(shouldIgnorePath("important.tmp")).toBe(false);
  });

  it("should handle anchored patterns", () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "/output\n");
    loadIgnoreFiles(tmpDir);
    expect(shouldIgnorePath("output/file.txt")).toBe(true);
    expect(shouldIgnorePath("src/output/file.txt")).toBe(false);
  });

  it("should handle double-asterisk patterns", () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "**/temp\n");
    loadIgnoreFiles(tmpDir);
    expect(shouldIgnorePath("temp/file.txt")).toBe(true);
    expect(shouldIgnorePath("src/temp/file.txt")).toBe(true);
    expect(shouldIgnorePath("a/b/c/temp/file.txt")).toBe(true);
  });
});

describe("include/exclude patterns", () => {
  beforeEach(() => {
    setIncludeExcludePatterns([], []);
  });

  it("includes all files when no patterns set", () => {
    expect(shouldIncludePath("src/index.ts")).toBe(true);
    expect(shouldIncludePath("test/foo.test.ts")).toBe(true);
  });

  it("excludes files matching exclude patterns", () => {
    setIncludeExcludePatterns([], ["*.test.ts", "*.spec.ts"]);
    expect(shouldIncludePath("src/index.ts")).toBe(true);
    expect(shouldIncludePath("test/foo.test.ts")).toBe(false);
    expect(shouldIncludePath("test/bar.spec.ts")).toBe(false);
  });

  it("only includes files matching include patterns", () => {
    setIncludeExcludePatterns(["src/**/*.ts"], []);
    expect(shouldIncludePath("src/index.ts")).toBe(true);
    expect(shouldIncludePath("src/utils/helper.ts")).toBe(true);
    expect(shouldIncludePath("test/foo.test.ts")).toBe(false);
    expect(shouldIncludePath("docs/readme.md")).toBe(false);
  });

  it("exclude takes precedence over include", () => {
    setIncludeExcludePatterns(["src/**/*.ts"], ["src/generated/*.ts"]);
    expect(shouldIncludePath("src/index.ts")).toBe(true);
    expect(shouldIncludePath("src/generated/api.ts")).toBe(false);
  });

  it("handles directory patterns", () => {
    setIncludeExcludePatterns([], ["node_modules/**", "dist/**"]);
    expect(shouldIncludePath("node_modules/foo/index.js")).toBe(false);
    expect(shouldIncludePath("dist/bundle.js")).toBe(false);
    expect(shouldIncludePath("src/index.ts")).toBe(true);
  });
});
