import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

export interface RecentFileEntry {
  path: string;
  timestamp: number;
  commitCount: number;
}

export const GIT_NOT_AVAILABLE = Symbol("GIT_NOT_AVAILABLE");

async function isGitRepo(rootDir: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["rev-parse", "--git-dir"], { cwd: rootDir, timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

async function getGitLog(rootDir: string, maxEntries = 50): Promise<{ path: string; timestamp: number }[]> {
  const { stdout } = await execFileAsync(
    "git",
    ["log", `--max-count=${maxEntries}`, "--pretty=format:%ct", "--name-only", "--no-merges"],
    { cwd: rootDir, timeout: 10_000, maxBuffer: 500_000, encoding: "utf8" }
  );

  const entries: { path: string; timestamp: number }[] = [];
  const lines = stdout.split("\n");
  let currentTimestamp = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const ts = Number.parseInt(trimmed, 10);
    if (Number.isFinite(ts) && ts > 1_000_000_000) {
      currentTimestamp = ts;
      continue;
    }

    if (currentTimestamp > 0 && trimmed.length > 0 && !trimmed.includes(" ")) {
      entries.push({ path: trimmed, timestamp: currentTimestamp });
    }
  }

  return entries;
}

export async function getRecentFiles(rootDir: string, maxEntries = 50): Promise<RecentFileEntry[] | typeof GIT_NOT_AVAILABLE> {
  const isGit = await isGitRepo(rootDir);
  if (!isGit) return GIT_NOT_AVAILABLE;

  try {
    const logEntries = await getGitLog(rootDir, maxEntries);
    const byPath = new Map<string, { timestamp: number; commitCount: number }>();

    for (const entry of logEntries) {
      const existing = byPath.get(entry.path);
      if (existing) {
      existing.commitCount += 1;
      existing.timestamp = Math.max(existing.timestamp, entry.timestamp);
      } else {
        byPath.set(entry.path, { timestamp: entry.timestamp, commitCount: 1 });
      }
    }

    return [...byPath.entries()]
      .map(([path, data]) => ({ path, timestamp: data.timestamp, commitCount: data.commitCount }))
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return GIT_NOT_AVAILABLE;
  }
}

export function getRecencyScore(recentFiles: RecentFileEntry[] | typeof GIT_NOT_AVAILABLE, relativePath: string): number {
  if (recentFiles === GIT_NOT_AVAILABLE) return 0;

  const normalizedPath = relativePath.split(path.sep).join("/");
  const entry = recentFiles.find((e) => e.path === normalizedPath || e.path.endsWith(normalizedPath));
  if (!entry) return 0;

  const now = Date.now() / 1000;
  const ageSeconds = now - entry.timestamp;
  const recencyWeight = Math.max(0, 1 - ageSeconds / (7 * 24 * 60 * 60));
  const frequencyWeight = Math.min(entry.commitCount / 10, 1);

  return recencyWeight * 0.6 + frequencyWeight * 0.4;
}
