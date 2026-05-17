#!/usr/bin/env node
import { loadEnv } from "@repolens/shared";

loadEnv(import.meta.url);

import process from "node:process";
import { writeFile, mkdir, rm, readFile as fsReadFile } from "node:fs/promises";
import path, { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Command } from "commander";
import { scanRepository, FileCache, generateArchitectureReport, generateMermaidDiagram, analyzeDiff, formatDiffReport, generateJsonReport, formatProgress } from "@repolens/context-engine";
import { createAIProvider, generateArchitectureSummary, generateTraceExplanation, generateDiffAnalysis, createSummarizeFn } from "@repolens/ai";
import { errorMessage, readConfigFromEnv, createLogger, loadConfigFile, mergeConfig } from "@repolens/shared";

const fs = { readFile: fsReadFile };

const log = createLogger("repolens-cli");
const execFileAsync = promisify(execFile);

const FILE_SUMMARIZE_PROMPT = `Summarize this source file in 2-3 sentences. Focus on its purpose, key exports, and role in the codebase. Be specific and concise.`;

function createFileSummarizeFn(provider: ReturnType<typeof createAIProvider>, model: string | undefined) {
  const summarize = createSummarizeFn(provider, model ?? "gpt-4o-mini");
  return async (filePath: string, content: string, symbols: Array<{name: string; kind: string; line: number}>, imports: string[]): Promise<string> => {
    const symbolList = symbols.map(s => `${s.kind} ${s.name}`).join(", ");
    const importList = imports.filter(i => i.startsWith(".")).join(", ");
    const userPrompt = [
      `File: ${filePath}`,
      ``,
      `Content:\n\`\`\`${filePath.split(".").pop()}\n${content.substring(0, 4000)}\n\`\`\``,
      ``,
      `Symbols: ${symbolList || "none"}`,
      `Imports: ${importList || "none"}`,
      ``,
      `Summarize this file's purpose and role.`
    ].join("\n");
    try {
      return await summarize([{ role: "system", content: FILE_SUMMARIZE_PROMPT }, { role: "user", content: userPrompt }]);
    } catch {
      return "";
    }
  };
}

async function runScan(dir: string, outputDir: string, options: { noMermaid?: boolean; noAi?: boolean; fileLevel?: boolean; ignoreTests?: boolean; targetFile?: string; format?: string; include?: string[]; exclude?: string[]; summarize?: boolean }): Promise<void> {
  const envConfig = readConfigFromEnv();
  const fileConfig = await loadConfigFile(dir);
  const config = mergeConfig(fileConfig, envConfig);
  const cache = new FileCache();
  const includeMermaid = !options.noMermaid && config.includeMermaid;
  const fileLevelGraph = options.fileLevel ?? false;

  log.info("scanning repository", { dir });

  const aiSummarizeFn = options.summarize
    ? createFileSummarizeFn(createAIProvider(config), config.aiProviderModel)
    : undefined;

  const context = await scanRepository({
    rootDir: dir,
    maxFiles: config.maxContextFiles,
    maxBytes: config.maxContextBytes,
    maxFileBytes: config.maxFileBytes,
    maxChunkChars: config.maxChunkChars,
    ignoreTests: options.ignoreTests,
    targetFile: options.targetFile ? path.resolve(dir, options.targetFile) : undefined,
    include: options.include,
    exclude: options.exclude,
    summarize: options.summarize,
    aiSummarizeFn,
    onProgress: (progress) => {
      process.stderr.write(`\r${formatProgress(progress)}`);
    }
  }, cache);
  process.stderr.write("\n");

  log.info("scan complete", {
    files: context.summary.includedFiles,
    bytes: context.summary.totalBytes,
    skipped: context.summary.skippedFiles
  });

  if (outputDir) {
    await mkdir(outputDir, { recursive: true });
  }

  const isJson = options.format === "json";
  const reportExt = isJson ? "json" : "md";
  const reportName = isJson ? "ARCHITECTURE.json" : "ARCHITECTURE.md";
  const outputPath = outputDir ? join(outputDir, reportName) : join(dir, reportName);

  if (isJson) {
    const jsonReport = generateJsonReport(context, false);
    await writeFile(outputPath, JSON.stringify(jsonReport, null, 2), "utf8");
    log.info("wrote json report", { path: outputPath });
  } else {
    const importGraph = context.importGraph;
    const report = generateArchitectureReport(context, { includeMermaid, fileLevelGraph, importGraph });
    await writeFile(outputPath, report, "utf8");
    log.info("wrote architecture report", { path: outputPath });

    if (includeMermaid) {
      const diagram = generateMermaidDiagram(context, fileLevelGraph);
      const diagramPath = outputDir ? join(outputDir, "DEPENDENCIES.mmd") : join(dir, "DEPENDENCIES.mmd");
      await writeFile(diagramPath, diagram, "utf8");
      log.info("wrote dependency diagram", { path: diagramPath });
    }
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
  const envConfig = readConfigFromEnv();
  const fileConfig = await loadConfigFile(dir);
  const config = mergeConfig(fileConfig, envConfig);
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
  const envConfig = readConfigFromEnv();
  const fileConfig = await loadConfigFile(dir);
  const config = mergeConfig(fileConfig, envConfig);
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

    const diffResult = await analyzeDiff(baseContext, headContext, baseDir, headDir);
    const report = formatDiffReport(diffResult, base, head);

    if (!config.aiProviderApiKey) {
      await writeFile(outputPath, report, "utf8");
      log.info("wrote diff report", { path: outputPath });
    } else {
      const provider = createAIProvider(config);
      const analysis = await generateDiffAnalysis(provider, baseContext, headContext, config.aiProviderModel);
      await writeFile(outputPath, `${report}\n\n## AI Analysis\n\n${analysis}`, "utf8");
      log.info("wrote diff report with AI analysis", { path: outputPath });
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
  .option("--ignore-tests", "Exclude test files from scanning")
  .option("--target-file <path>", "Score files relative to this target (proximity, test-pairing, same-package)")
  .option("-f, --format <format>", "Output format: markdown (default) or json")
  .option("--include <patterns...>", "Only include files matching these glob patterns")
  .option("--exclude <patterns...>", "Exclude files matching these glob patterns")
  .option("--summarize", "Generate AI-powered file summaries (requires API key)")
  .action(async (dir: string | undefined, options: { output?: string; mermaid?: boolean; ai?: boolean; fileLevel?: boolean; ignoreTests?: boolean; targetFile?: string; format?: string; include?: string[]; exclude?: string[]; summarize?: boolean }) => {
    try {
      await runScan(dir ?? ".", options.output ?? "", { noMermaid: !options.mermaid, noAi: !options.ai, fileLevel: options.fileLevel, ignoreTests: options.ignoreTests, targetFile: options.targetFile, format: options.format, include: options.include, exclude: options.exclude, summarize: options.summarize });
    } catch (error) {
      process.stderr.write(`repolens: ${errorMessage(error)}\n`);
      process.exitCode = 1;
    }
  });

program
  .command("trace [dir] [query]")
  .description("Trace code flow through a repository")
  .action(async (dir: string | undefined, query: string | undefined) => {
    if (!query) {
      process.stderr.write("repolens: missing required argument 'query'\n");
      process.exitCode = 1;
      return;
    }
    try {
      await runTrace(dir ?? ".", query);
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
    try {
      await runDiff(dir ?? ".", options.base, options.head, options.output ?? "");
    } catch (error) {
      process.stderr.write(`repolens: ${errorMessage(error)}\n`);
      process.exitCode = 1;
    }
  });

program
  .command("init [dir]")
  .description("Generate a .repolensrc.json configuration file")
  .action(async (dir: string | undefined) => {
    try {
      const targetDir = dir ?? ".";
      const configPath = join(targetDir, ".repolensrc.json");

      try {
        await fs.readFile(configPath, "utf8");
        process.stderr.write(`repolens: ${configPath} already exists\n`);
        process.exitCode = 1;
        return;
      } catch {
        // File doesn't exist, proceed
      }

      const defaultConfig = {
        maxContextFiles: 80,
        maxContextBytes: 120000,
        maxFileBytes: 80000,
        maxChunkChars: 6000,
        aiProviderModel: "gpt-4o-mini",
        includeMermaid: true,
        logLevel: "info"
      };

      await writeFile(configPath, JSON.stringify(defaultConfig, null, 2) + "\n", "utf8");
      log.info("created config file", { path: configPath });
      process.stdout.write(`Created ${configPath}\n`);
    } catch (error) {
      process.stderr.write(`repolens: ${errorMessage(error)}\n`);
      process.exitCode = 1;
    }
  });

program.action(() => program.help());

await program.parseAsync();
