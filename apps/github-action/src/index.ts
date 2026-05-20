#!/usr/bin/env node
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as exec from "@actions/exec";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface JsonFileEntry {
  path: string;
  language: string;
  symbols: Array<{ name: string; kind: string; line: number; comment?: string }>;
  imports: string[];
  summary: string;
  fileComment?: string;
}

interface JsonReport {
  version: string;
  files: JsonFileEntry[];
  summary: { includedFiles: number };
}

function surgicalMerge(existingReport: JsonReport, newFiles: JsonFileEntry[], deletedPaths: string[]): JsonReport {
  const existingMap = new Map<string, JsonFileEntry>();
  for (const file of existingReport.files) {
    existingMap.set(file.path, file);
  }

  for (const file of newFiles) {
    existingMap.set(file.path, file);
  }

  const deletedSet = new Set(deletedPaths);
  const mergedFiles = [...existingMap.values()].filter((f) => !deletedSet.has(f.path));
  mergedFiles.sort((a, b) => a.path.localeCompare(b.path));

  return {
    ...existingReport,
    files: mergedFiles,
    summary: { ...existingReport.summary, includedFiles: mergedFiles.length }
  };
}

function formatDiffComment(baseReport: JsonReport, headReport: JsonReport, baseRef: string, headRef: string): string {
  const baseFiles = new Map(baseReport.files.map((f) => [f.path, f]));
  const headFiles = new Map(headReport.files.map((f) => [f.path, f]));

  const added: JsonFileEntry[] = [];
  const removed: JsonFileEntry[] = [];
  const modified: Array<{ path: string; symbolDiff: { added: string[]; removed: string[] }; importDiff: { added: string[]; removed: string[] } }> = [];

  for (const [path, file] of headFiles) {
    if (!baseFiles.has(path)) {
      added.push(file);
    } else {
      const baseFile = baseFiles.get(path)!;
      const baseSymbols = new Set((baseFile.symbols || []).map((s) => `${s.kind}:${s.name}`));
      const headSymbols = new Set((file.symbols || []).map((s) => `${s.kind}:${s.name}`));
      const baseImports = new Set(baseFile.imports || []);
      const headImports = new Set(file.imports || []);

      const symbolAdded = [...headSymbols].filter((s) => !baseSymbols.has(s));
      const symbolRemoved = [...baseSymbols].filter((s) => !headSymbols.has(s));
      const importAdded = [...headImports].filter((i) => !baseImports.has(i));
      const importRemoved = [...baseImports].filter((i) => !baseImports.has(i));

      if (symbolAdded.length > 0 || symbolRemoved.length > 0 || importAdded.length > 0 || importRemoved.length > 0) {
        modified.push({
          path,
          symbolDiff: { added: symbolAdded, removed: symbolRemoved },
          importDiff: { added: importAdded, removed: importRemoved }
        });
      }
    }
  }

  for (const [path] of baseFiles) {
    if (!headFiles.has(path)) {
      removed.push(baseFiles.get(path)!);
    }
  }

  const lines: string[] = [
    `## RepoSight: Architecture Changes (${baseRef} → ${headRef})`,
    ``,
    `| Change | Count |`,
    `|--------|-------|`,
    `| Files added | ${added.length} |`,
    `| Files removed | ${removed.length} |`,
    `| Files modified | ${modified.length} |`,
    ``
  ];

  if (added.length > 0) {
    lines.push(`### New Files`);
    lines.push(``);
    for (const file of added.slice(0, 15)) {
      const symbols = (file.symbols || []).map((s) => s.name).join(", ");
      lines.push(`- \`${file.path}\` — ${symbols ? symbols : file.summary || "no symbols"}`);
    }
    if (added.length > 15) lines.push(`- ... and ${added.length - 15} more`);
    lines.push(``);
  }

  if (removed.length > 0) {
    lines.push(`### Removed Files`);
    lines.push(``);
    for (const file of removed.slice(0, 10)) {
      lines.push(`- \`${file.path}\``);
    }
    if (removed.length > 10) lines.push(`- ... and ${removed.length - 10} more`);
    lines.push(``);
  }

  if (modified.length > 0) {
    lines.push(`### Modified Files`);
    lines.push(``);
    for (const mod of modified.slice(0, 10)) {
      const changes: string[] = [];
      if (mod.symbolDiff.added.length > 0) changes.push(`+${mod.symbolDiff.added.length} symbols`);
      if (mod.symbolDiff.removed.length > 0) changes.push(`-${mod.symbolDiff.removed.length} symbols`);
      if (mod.importDiff.added.length > 0) changes.push(`+${mod.importDiff.added.length} imports`);
      if (mod.importDiff.removed.length > 0) changes.push(`-${mod.importDiff.removed.length} imports`);
      lines.push(`- \`${mod.path}\` — ${changes.join(", ")}`);
    }
    if (modified.length > 10) lines.push(`- ... and ${modified.length - 10} more`);
    lines.push(``);
  }

  if (added.length === 0 && removed.length === 0 && modified.length === 0) {
    lines.push(`No architectural changes detected.`);
    lines.push(``);
  }

  lines.push(`_Generated by [RepoSight](https://github.com/deepankarthik/reposight)_`);

  return lines.join("\n");
}

async function runScan(files?: string[], summarize?: boolean): Promise<JsonReport> {
  const outputDir = core.getInput("output-dir");
  const jsonPath = join(outputDir, "ARCHITECTURE.json");
  const cliPath = join(__dirname, "reposight-cli.cjs");
  const args = [cliPath, "scan", ".", "-f", "json", "-o", outputDir];
  if (core.getInput("include-mermaid") !== "true") args.push("--no-mermaid");
  if (files?.length) args.push("--files", ...files);
  if (summarize) args.push("--summarize");

  await exec.exec("node", args);

  if (!existsSync(jsonPath)) {
    throw new Error(`Expected output file not found: ${jsonPath}`);
  }

  const report = JSON.parse(readFileSync(jsonPath, "utf8")) as JsonReport;
  return report;
}

async function summarizeFiles(report: JsonReport): Promise<void> {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  if (!apiKey) {
    core.info("AI_PROVIDER_API_KEY not set, skipping AI summaries");
    return;
  }

  const baseUrl = process.env.AI_PROVIDER_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.AI_PROVIDER_MODEL || "gpt-4o-mini";

  for (const file of report.files) {
    try {
      const summary = await callAI(baseUrl, apiKey, model, file);
      if (summary) {
        file.summary = summary;
        core.info(`  Summarized: ${file.path}`);
      }
    } catch (err) {
      core.warning(`  Failed to summarize ${file.path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

async function callAI(baseUrl: string, apiKey: string, model: string, file: JsonFileEntry): Promise<string> {
  const symbolList = (file.symbols || []).map((s) => `${s.kind} ${s.name}${s.comment ? ` (${s.comment})` : ""}`).join(", ");
  const importList = (file.imports || []).filter((i) => i.startsWith(".")).join(", ");

  let fileContent = "";
  try {
    const absPath = resolve(process.cwd(), file.path);
    const raw = readFileSync(absPath, "utf8");
    const maxChars = 4000;
    fileContent = raw.length > maxChars ? raw.slice(0, maxChars) + "\n\n... (truncated)" : raw;
  } catch {
    // File not accessible, skip content
  }

  const contentParts: string[] = [`File: ${file.path}`];
  if (symbolList) contentParts.push(`Symbols: ${symbolList}`);
  if (importList) contentParts.push(`Imports: ${importList}`);
  if (fileContent) contentParts.push(`Content:\n\`\`\`\n${fileContent}\n\`\`\``);
  contentParts.push("\nSummarize this file's purpose and role in 2-3 sentences.");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a code reviewer. Summarize source files concisely. Focus on purpose, key exports, and role in the codebase." },
        { role: "user", content: contentParts.join("\n\n") }
      ],
      temperature: 0.1,
      max_tokens: 200
    })
  });

  if (!response.ok) {
    throw new Error(`AI provider returned ${response.status}`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || "";
}

function getChangedFiles(baseSha?: string): { changed: string[]; deleted: string[] } {
  try {
    let sha: string;
    if (baseSha) {
      sha = execSync(`git merge-base HEAD ${baseSha} 2>/dev/null || echo "${baseSha}"`, { encoding: "utf8" }).trim();
    } else {
      sha = execSync(`git rev-parse HEAD~1 2>/dev/null || echo ""`, { encoding: "utf8" }).trim();
    }

    if (!sha) return { changed: [], deleted: [] };

    const result = execSync(`git diff --name-status ${sha} HEAD`, { encoding: "utf8" });
    const changed: string[] = [];
    const deleted: string[] = [];

    for (const line of result.split("\n").filter(Boolean)) {
      const parts = line.split("\t");
      const status = parts[0];
      const file = parts[1];
      if (status === "D") {
        deleted.push(file);
      } else {
        changed.push(file);
      }
    }

    return { changed, deleted };
  } catch {
    return { changed: [], deleted: [] };
  }
}

async function run(): Promise<void> {
  try {
    const token = core.getInput("github-token") || process.env.GITHUB_TOKEN;
    if (!token) {
      core.setFailed("github-token is required. Pass github-token: ${{ secrets.GITHUB_TOKEN }} in your workflow.");
      return;
    }
    const octokit = github.getOctokit(token);
    const context = github.context;
    const eventName = context.eventName;
    const shouldCommit = core.getInput("commit") === "true";
    const shouldComment = core.getInput("comment") === "true";
    const summarize = core.getInput("summarize") === "true";

    core.info(`Running RepoSight for ${eventName} on ${context.ref}`);

    const outputDir = core.getInput("output-dir");
    const outputPath = join(outputDir, "ARCHITECTURE.json");
    const existingReport: JsonReport | null = existsSync(outputPath) ? JSON.parse(readFileSync(outputPath, "utf8")) as JsonReport : null;

    let finalReport: JsonReport;

    if (!existingReport) {
      core.info("First run — scanning entire repo");
      const report = await runScan(undefined, summarize);
      if (summarize && !process.env.AI_PROVIDER_API_KEY) {
        core.info("AI_PROVIDER_API_KEY not set, using heuristic summaries");
      }
      finalReport = report;
    } else {
      const baseSha = eventName === "pull_request" ? context.payload.pull_request?.base.sha : undefined;
      const { changed, deleted } = getChangedFiles(baseSha);

      if (changed.length === 0 && deleted.length === 0) {
        core.info("No changed files detected, skipping update");
        finalReport = existingReport;
      } else {
        if (changed.length > 0) {
          core.info(`Scanning ${changed.length} changed files: ${changed.slice(0, 5).join(", ")}${changed.length > 5 ? "..." : ""}`);
          const newReport = await runScan(changed, summarize);

          if (summarize && process.env.AI_PROVIDER_API_KEY) {
            core.info(`AI summarizing ${newReport.files.length} files`);
            await summarizeFiles(newReport);
          }

          finalReport = surgicalMerge(existingReport, newReport.files, deleted);
          core.info(`Merged: ${newReport.files.length} files updated, ${deleted.length} files removed, ${finalReport.files.length} total in ARCHITECTURE.json`);
        } else {
          finalReport = surgicalMerge(existingReport, [], deleted);
          core.info(`Removed ${deleted.length} deleted files, ${finalReport.files.length} total in ARCHITECTURE.json`);
        }
      }
    }

    if (eventName === "pull_request") {
      const pr = context.payload.pull_request;
      if (!pr) {
        core.warning("No pull_request payload found");
        return;
      }

      const baseRef = pr.base.ref;
      const headRef = pr.head.ref;

      // Compare against existing ARCHITECTURE.json if available, otherwise skip diff comment
      const baseReport: JsonReport | null = existingReport;

      if (baseReport && shouldComment) {
        const comment = formatDiffComment(baseReport, finalReport, baseRef, headRef);
        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: pr.number,
          body: comment
        });
        core.info("Posted PR comment with architectural changes");
      }
    } else if (eventName === "push" || eventName === "workflow_dispatch") {
      if (shouldCommit) {
        writeFileSync(outputPath, JSON.stringify(finalReport, null, 2));
        const hasChanges = execSync("git diff --name-only").toString().trim();
        if (hasChanges) {
          await exec.exec("git", ["config", "user.name", "github-actions[bot]"]);
          await exec.exec("git", ["config", "user.email", "github-actions[bot]@users.noreply.github.com"]);
          await exec.exec("git", ["add", outputPath]);
          await exec.exec("git", ["commit", "-m", "chore: update architecture documentation [skip ci]"], { ignoreReturnCode: true });
          await exec.exec("git", ["push"], { ignoreReturnCode: true });
          core.info("Committed updated ARCHITECTURE.json");
        } else {
          core.info("No changes to commit");
        }
      }
    }

    core.setOutput("output-path", outputPath);
    core.setOutput("files-scanned", finalReport.summary.includedFiles);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
