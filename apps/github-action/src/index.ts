#!/usr/bin/env node
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as exec from "@actions/exec";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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

function mergeSummaries(newReport: JsonReport, existingReport: JsonReport): JsonReport {
  const existingMap = new Map<string, JsonFileEntry>();
  for (const file of existingReport.files) {
    existingMap.set(file.path, file);
  }

  const mergedFiles = newReport.files.map((newFile) => {
    const existing = existingMap.get(newFile.path);
    if (!existing) return newFile;
    return {
      ...newFile,
      summary: existing.summary || newFile.summary,
      fileComment: existing.fileComment || newFile.fileComment,
      symbols: newFile.symbols.map((s) => {
        const existingSymbol = existing.symbols?.find((es) => es.name === s.name && es.kind === s.kind);
        return {
          ...s,
          comment: existingSymbol?.comment || s.comment
        };
      })
    };
  });

  return { ...newReport, files: mergedFiles };
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
    `## RepoLens: Architecture Changes (${baseRef} → ${headRef})`,
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

  lines.push(`_Generated by [RepoLens](https://github.com/deepankarthik/repolens)_`);

  return lines.join("\n");
}

async function runScan(): Promise<string> {
  const outputDir = core.getInput("output-dir");
  const args = ["scan", ".", "-f", "json", "-o", outputDir];
  if (core.getInput("include-mermaid") !== "true") args.push("--no-mermaid");

  await exec.exec("npx", ["repolens", ...args], { silent: true });
  return join(outputDir, "ARCHITECTURE.json");
}

async function summarizeChangedFiles(report: JsonReport): Promise<void> {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  if (!apiKey) {
    core.info("AI_PROVIDER_API_KEY not set, skipping AI summaries");
    return;
  }

  const changedFiles = getChangedFiles();
  if (changedFiles.length === 0) {
    core.info("No changed files detected, skipping AI summaries");
    return;
  }

  const filesToSummarize = report.files.filter((f) => changedFiles.includes(f.path));
  if (filesToSummarize.length === 0) {
    core.info("No changed files in scan results, skipping AI summaries");
    return;
  }

  core.info(`AI summarizing ${filesToSummarize.length} changed files (out of ${report.files.length} total)`);

  const baseUrl = process.env.AI_PROVIDER_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.AI_PROVIDER_MODEL || "gpt-4o-mini";

  for (const file of filesToSummarize) {
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

function getChangedFiles(): string[] {
  try {
    const result = execSync("git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only $(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD origin/master 2>/dev/null || echo HEAD~1) HEAD 2>/dev/null", { encoding: "utf8" });
    return result.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

async function callAI(baseUrl: string, apiKey: string, model: string, file: JsonFileEntry): Promise<string> {
  const symbolList = (file.symbols || []).map((s) => `${s.kind} ${s.name}${s.comment ? ` (${s.comment})` : ""}`).join(", ");
  const importList = (file.imports || []).filter((i) => i.startsWith(".")).join(", ");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Summarize this source file in 2-3 sentences. Focus on its purpose, key exports, and role in the codebase. Be specific and concise." },
        { role: "user", content: `File: ${file.path}\nSymbols: ${symbolList || "none"}\nImports: ${importList || "none"}\n\nSummarize this file's purpose and role.` }
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

async function run(): Promise<void> {
  try {
    const token = process.env.GITHUB_TOKEN || core.getInput("token");
    const octokit = github.getOctokit(token);
    const context = github.context;
    const eventName = context.eventName;
    const shouldCommit = core.getInput("commit") === "true";
    const shouldComment = core.getInput("comment") === "true";
    const summarize = core.getInput("summarize") === "true";

    core.info(`Running RepoLens for ${eventName} on ${context.ref}`);

    const outputPath = await runScan();
    const newReport = JSON.parse(readFileSync(outputPath, "utf8")) as JsonReport;

    if (summarize) {
      await summarizeChangedFiles(newReport);
      writeFileSync(outputPath, JSON.stringify(newReport, null, 2));
    }

    if (eventName === "pull_request") {
      const pr = context.payload.pull_request;
      if (!pr) {
        core.warning("No pull_request payload found");
        return;
      }

      const baseRef = pr.base.ref;
      const headRef = pr.head.ref;

      core.info(`Scanning base branch (${baseRef}) for comparison...`);
      await exec.exec("git", ["fetch", "origin", baseRef], { silent: true });
      await exec.exec("git", ["stash", "--include-untracked"], { silent: true, ignoreReturnCode: true });
      await exec.exec("git", ["checkout", `origin/${baseRef}`], { silent: true });

      let baseReport: JsonReport | null = null;
      const existingPath = join(core.getInput("output-dir"), "ARCHITECTURE.json");
      if (existsSync(existingPath)) {
        baseReport = JSON.parse(readFileSync(existingPath, "utf8")) as JsonReport;
      } else {
        await exec.exec("npx", ["repolens", "scan", ".", "-f", "json", "-o", core.getInput("output-dir")], { silent: true });
        if (existsSync(existingPath)) {
          baseReport = JSON.parse(readFileSync(existingPath, "utf8")) as JsonReport;
        }
      }

      await exec.exec("git", ["checkout", "-"], { silent: true });
      await exec.exec("git", ["stash", "pop"], { silent: true, ignoreReturnCode: true });

      if (baseReport) {
        if (shouldComment) {
          const comment = formatDiffComment(baseReport, newReport, baseRef, headRef);
          await octokit.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: pr.number,
            body: comment
          });
          core.info("Posted PR comment with architectural changes");
        }
      }
    } else if (eventName === "push" || eventName === "workflow_dispatch") {
      const existingPath = join(core.getInput("output-dir"), "ARCHITECTURE.json");
      if (existsSync(existingPath)) {
        const existingReport = JSON.parse(readFileSync(existingPath, "utf8")) as JsonReport;
        const merged = mergeSummaries(newReport, existingReport);
        writeFileSync(outputPath, JSON.stringify(merged, null, 2));
        core.info("Merged with existing ARCHITECTURE.json (preserved AI summaries)");
      }

      if (shouldCommit) {
        const hasChanges = execSync("git diff --name-only").toString().trim();
        if (hasChanges || !existsSync(outputPath)) {
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
    core.setOutput("files-scanned", newReport.summary.includedFiles);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
