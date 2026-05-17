#!/usr/bin/env node
import { loadEnv } from "@repolens/shared";

loadEnv(import.meta.url);

import process from "node:process";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Command } from "commander";
import { scanRepository, FileCache, generateArchitectureReport, generateMermaidDiagram } from "@repolens/context-engine";
import { createAIProvider, generateArchitectureSummary, generateTraceExplanation, generateDiffAnalysis } from "@repolens/ai";
import { errorMessage, readConfigFromEnv, createLogger } from "@repolens/shared";

const log = createLogger("repolens-cli");
const execFileAsync = promisify(execFile);

async function runScan(dir: string, outputDir: string, options: { noMermaid?: boolean; noAi?: boolean; fileLevel?: boolean }): Promise<void> {
  const config = readConfigFromEnv();
  const cache = new FileCache();
  const includeMermaid = !options.noMermaid && config.includeMermaid;
  const fileLevelGraph = options.fileLevel ?? false;

  log.info("scanning repository", { dir });

  const context = await scanRepository({
    rootDir: dir,
    maxFiles: config.maxContextFiles,
    maxBytes: config.maxContextBytes,
    maxFileBytes: config.maxFileBytes,
    maxChunkChars: config.maxChunkChars
  }, cache);

  log.info("scan complete", {
    files: context.summary.includedFiles,
    bytes: context.summary.totalBytes,
    skipped: context.summary.skippedFiles
  });

  if (outputDir) {
    await mkdir(outputDir, { recursive: true });
  }

  const importGraph = context.importGraph ? { nodes: context.importGraph.nodes } : undefined;
  const report = generateArchitectureReport(context, { includeMermaid, fileLevelGraph, importGraph });
  const outputPath = outputDir ? join(outputDir, "ARCHITECTURE.md") : join(dir, "ARCHITECTURE.md");
  await writeFile(outputPath, report, "utf8");
  log.info("wrote architecture report", { path: outputPath });

  if (includeMermaid) {
    const diagram = generateMermaidDiagram(context, fileLevelGraph);
    const diagramPath = outputDir ? join(outputDir, "DEPENDENCIES.mmd") : join(dir, "DEPENDENCIES.mmd");
    await writeFile(diagramPath, diagram, "utf8");
    log.info("wrote dependency diagram", { path: diagramPath });
  }

  if (!options.noAi && config.aiProviderApiKey) {
    log.info("generating AI summary...");
    const provider = createAIProvider(config);
    const summary = await generateArchitectureSummary(provider, context, config.aiProviderModel);
    const summaryPath = outputDir ? join(outputDir, "AI_SUMMARY.md") : join(dir, "AI_SUMMARY.md");
    await writeFile(summaryPath, `# AI Architecture Summary\n\n${summary}`, "utf8");
    log.info("wrote AI summary", { path: summaryPath });
  }
}

async function runTrace(dir: string, query: string): Promise<void> {
  const config = readConfigFromEnv();
  const cache = new FileCache();

  log.info("scanning repository for trace", { dir, query });

  const context = await scanRepository({
    rootDir: dir,
    maxFiles: config.maxContextFiles,
    maxBytes: config.maxContextBytes,
    maxFileBytes: config.maxFileBytes,
    maxChunkChars: config.maxChunkChars
  }, cache);

  if (!config.aiProviderApiKey) {
    log.error("AI provider key required for trace command");
    process.exitCode = 1;
    return;
  }

  const provider = createAIProvider(config);
  const explanation = await generateTraceExplanation(provider, context, query, config.aiProviderModel);

  process.stdout.write(`# Trace: ${query}\n\n${explanation}\n`);
}

async function runDiff(dir: string, base: string, head: string, outputDir: string): Promise<void> {
  const config = readConfigFromEnv();
  const cache = new FileCache();

  log.info("running diff analysis", { dir, base, head });

  const baseDir = join(dir, ".repolens-diff-base");
  const headDir = join(dir, ".repolens-diff-head");

  try {
    await mkdir(baseDir, { recursive: true });
    await mkdir(headDir, { recursive: true });

    await execFileAsync("sh", ["-c", `git archive ${base} | tar -x -C ${baseDir}`], { cwd: dir });
    await execFileAsync("sh", ["-c", `git archive ${head} | tar -x -C ${headDir}`], { cwd: dir });

    const baseContext = await scanRepository({
      rootDir: baseDir,
      maxFiles: config.maxContextFiles,
      maxBytes: config.maxContextBytes,
      maxFileBytes: config.maxFileBytes,
      maxChunkChars: config.maxChunkChars
    }, cache);

    const headContext = await scanRepository({
      rootDir: headDir,
      maxFiles: config.maxContextFiles,
      maxBytes: config.maxContextBytes,
      maxFileBytes: config.maxFileBytes,
      maxChunkChars: config.maxChunkChars
    }, cache);

    const outputPath = outputDir ? join(outputDir, "DIFF.md") : join(dir, "DIFF.md");
    if (outputDir) {
      await mkdir(outputDir, { recursive: true });
    }

    if (!config.aiProviderApiKey) {
      const baseFiles = new Set(baseContext.files.map((f) => f.path));
      const headFiles = new Set(headContext.files.map((f) => f.path));

      const added = [...headFiles].filter((f) => !baseFiles.has(f));
      const removed = [...baseFiles].filter((f) => !headFiles.has(f));
      const modified = [...headFiles].filter((f) => baseFiles.has(f));

      const lines = [
        `# Diff: ${base} → ${head}`,
        "",
        "## Summary",
        "",
        `- Added: ${added.length} files`,
        `- Removed: ${removed.length} files`,
        `- Modified: ${modified.length} files`,
        ""
      ];

      if (added.length > 0) {
        lines.push("## Added Files", "", ...added.map((f) => `- \`${f}\``), "");
      }
      if (removed.length > 0) {
        lines.push("## Removed Files", "", ...removed.map((f) => `- \`${f}\``), "");
      }
      if (modified.length > 0) {
        lines.push("## Modified Files", "", ...modified.map((f) => `- \`${f}\``), "");
      }

      await writeFile(outputPath, lines.join("\n"), "utf8");
      log.info("wrote diff report (no AI)", { path: outputPath });
    } else {
      const provider = createAIProvider(config);
      const analysis = await generateDiffAnalysis(provider, baseContext, headContext, config.aiProviderModel);
      await writeFile(outputPath, `# Diff: ${base} → ${head}\n\n${analysis}`, "utf8");
      log.info("wrote diff report (AI)", { path: outputPath });
    }
  } finally {
    await rm(baseDir, { recursive: true, force: true });
    await rm(headDir, { recursive: true, force: true });
  }
}

const program = new Command();
program
  .name("repolens")
  .description("Generate living documentation from codebases")
  .version("0.1.0");

program
  .command("scan [dir]")
  .description("Scan a repository and generate architecture documentation")
  .option("-o, --output <dir>", "Output directory (defaults to repo root)")
  .option("--no-mermaid", "Skip Mermaid diagram generation")
  .option("--no-ai", "Skip AI-generated summary")
  .option("--file-level", "Generate file-level dependency graph instead of package-level")
  .action(async (dir: string | undefined, options: { output?: string; mermaid?: boolean; ai?: boolean; fileLevel?: boolean }) => {
    if (!dir) {
      process.stderr.write("repolens: missing required argument 'dir'\n");
      process.exitCode = 1;
      return;
    }
    try {
      await runScan(dir, options.output ?? "", { noMermaid: !options.mermaid, noAi: !options.ai, fileLevel: options.fileLevel });
    } catch (error) {
      process.stderr.write(`repolens: ${errorMessage(error)}\n`);
      process.exitCode = 1;
    }
  });

program
  .command("trace [dir] [query]")
  .description("Trace code flow through a repository")
  .action(async (dir: string | undefined, query: string | undefined) => {
    if (!dir || !query) {
      process.stderr.write("repolens: missing required arguments 'dir' and 'query'\n");
      process.exitCode = 1;
      return;
    }
    try {
      await runTrace(dir, query);
    } catch (error) {
      process.stderr.write(`repolens: ${errorMessage(error)}\n`);
      process.exitCode = 1;
    }
  });

program
  .command("diff [dir]")
  .description("Compare two git refs and analyze changes")
  .requiredOption("--base <ref>", "Base git ref (e.g., main)")
  .option("--head <ref>", "Head git ref (defaults to HEAD)", "HEAD")
  .option("-o, --output <dir>", "Output directory (defaults to repo root)")
  .action(async (dir: string | undefined, options: { base: string; head: string; output?: string }) => {
    if (!dir) {
      process.stderr.write("repolens: missing required argument 'dir'\n");
      process.exitCode = 1;
      return;
    }
    try {
      await runDiff(dir, options.base, options.head, options.output ?? "");
    } catch (error) {
      process.stderr.write(`repolens: ${errorMessage(error)}\n`);
      process.exitCode = 1;
    }
  });

program.action(() => program.help());

await program.parseAsync();
