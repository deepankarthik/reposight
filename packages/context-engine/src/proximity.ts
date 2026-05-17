import path from "node:path";

export function getDirectoryProximityScore(filePath: string, targetPath: string): number {
  if (!targetPath) return 0;

  const fileParts = filePath.split("/");
  const targetParts = targetPath.split("/");

  let commonDepth = 0;
  for (let i = 0; i < Math.min(fileParts.length, targetParts.length); i++) {
    if (fileParts[i] === targetParts[i]) {
      commonDepth++;
    } else {
      break;
    }
  }

  if (commonDepth === 0) return 0;

  const fileDepth = fileParts.length;
  const targetDepth = targetParts.length;
  const maxDepth = Math.max(fileDepth, targetDepth);

  const depthRatio = commonDepth / maxDepth;
  const sameDirectory = path.dirname(filePath) === path.dirname(targetPath);

  if (sameDirectory) {
    return 0.8 + depthRatio * 0.2;
  }

  return depthRatio * 0.6;
}

export function getSamePackageScore(filePath: string, targetPath: string): number {
  if (!targetPath) return 0;

  const fileParts = filePath.split("/");
  const targetParts = targetPath.split("/");

  const filePkgIndex = fileParts.findIndex((p) => p === "packages" || p === "apps" || p === "src");
  const targetPkgIndex = targetParts.findIndex((p) => p === "packages" || p === "apps" || p === "src");

  if (filePkgIndex === -1 || targetPkgIndex === -1) return 0;

  const filePkg = fileParts[filePkgIndex + 1];
  const targetPkg = targetParts[targetPkgIndex + 1];

  if (filePkg && targetPkg && filePkg === targetPkg) {
    return 0.5;
  }

  return 0;
}
