import path from "node:path";

const TEST_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /\/__tests__\//,
  /\/tests?\//,
  /\.test\.(py|rb|go|rs)$/
];

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|py|go|rs)$/;

export function isTestFile(relativePath: string): boolean {
  return TEST_PATTERNS.some((pattern) => pattern.test(relativePath));
}

export function isSourceFile(relativePath: string): boolean {
  return SOURCE_EXTENSIONS.test(relativePath) && !isTestFile(relativePath);
}

export function findTestPair(relativePath: string, allFiles: string[]): string | null {
  if (isTestFile(relativePath)) {
    const baseName = relativePath
      .replace(/\.test\.(ts|tsx|js|jsx)$/, "")
      .replace(/\.spec\.(ts|tsx|js|jsx)$/, "")
      .replace(/\/__tests__\//, "/")
      .replace(/\/tests?\//, "/");

    for (const file of allFiles) {
      if (file === relativePath) continue;
      if (file === baseName || file.startsWith(baseName + ".")) {
        return file;
      }
    }
    return null;
  }

  if (isSourceFile(relativePath)) {
    const dir = path.dirname(relativePath);
    const baseName = path.basename(relativePath, path.extname(relativePath));
    const ext = path.extname(relativePath);

    const candidates = [
      `${dir}/${baseName}.test${ext}`,
      `${dir}/${baseName}.spec${ext}`,
      `${dir}/__tests__/${baseName}${ext}`,
      `${dir}/test/${baseName}${ext}`,
      `${dir}/tests/${baseName}${ext}`
    ];

    for (const candidate of candidates) {
      if (allFiles.includes(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export function getTestPairScore(relativePath: string, allFiles: string[], targetFile?: string): number {
  if (!targetFile) return 0;

  const targetDir = path.dirname(targetFile);
  const fileDir = path.dirname(relativePath);

  if (isTestFile(relativePath) && isSourceFile(targetFile)) {
    const pair = findTestPair(targetFile, allFiles);
    if (pair === relativePath) return 1.0;
  }

  if (isSourceFile(relativePath) && isTestFile(targetFile)) {
    const pair = findTestPair(targetFile, allFiles);
    if (pair === relativePath) return 1.0;
  }

  if (fileDir === targetDir && isTestFile(relativePath) !== isTestFile(targetFile)) {
    return 0.3;
  }

  return 0;
}
