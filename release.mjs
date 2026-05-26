#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline";

const CLI_PKG_PATH = "apps/cli/package.json";
const ACTION_PKG_PATH = "apps/github-action/package.json";
const CHANGELOG_PATH = "CHANGELOG.md";

const rl = createInterface({ input: process.stdin, output: process.stdout });

function prompt(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function log(msg) {
  console.log(`\n  ${msg}`);
}

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function parseVersion(v) {
  const match = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-(\w+)\.(\d+))?$/);
  if (!match) return null;
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
    prerelease: match[4] || null,
    prereleaseNum: match[5] ? parseInt(match[5]) : 0
  };
}

function formatVersion(v) {
  let s = `${v.major}.${v.minor}.${v.patch}`;
  if (v.prerelease) s += `-${v.prerelease}.${v.prereleaseNum}`;
  return s;
}

function bumpVersion(current, type, prereleaseId) {
  const v = parseVersion(current);
  if (!v) throw new Error(`Invalid version: ${current}`);

  switch (type) {
    case "patch":
      if (v.prerelease) {
        v.prerelease = null;
        v.prereleaseNum = 0;
      } else {
        v.patch++;
      }
      break;
    case "minor":
      v.minor++;
      v.patch = 0;
      v.prerelease = null;
      v.prereleaseNum = 0;
      break;
    case "major":
      v.major++;
      v.minor = 0;
      v.patch = 0;
      v.prerelease = null;
      v.prereleaseNum = 0;
      break;
    case "prerelease":
      if (v.prerelease === prereleaseId) {
        v.prereleaseNum++;
      } else {
        v.patch++;
        v.prerelease = prereleaseId;
        v.prereleaseNum = 0;
      }
      break;
  }
  return formatVersion(v);
}

function getCommitsSinceLastTag() {
  const lastTag = run("git describe --tags --abbrev=0 2>/dev/null || echo ''");
  if (!lastTag) {
    return run("git log --oneline --no-merges");
  }
  return run(`git log ${lastTag}..HEAD --oneline --no-merges`);
}

function groupCommits(commits) {
  const groups = {
    feat: [],
    fix: [],
    refactor: [],
    perf: [],
    docs: [],
    test: [],
    chore: [],
    ci: [],
    build: [],
    other: []
  };

  const typeLabels = {
    feat: "Features",
    fix: "Bug Fixes",
    refactor: "Refactoring",
    perf: "Performance",
    docs: "Documentation",
    test: "Tests",
    chore: "Chores",
    ci: "CI/CD",
    build: "Build"
  };

  for (const line of commits.split("\n").filter(Boolean)) {
    const hashEnd = line.indexOf(" ");
    const message = line.slice(hashEnd + 1);
    const typeMatch = message.match(/^(\w+)(?:\([^)]*\))?:/);
    const type = typeMatch ? typeMatch[1] : null;

    if (type && groups[type] !== undefined) {
      groups[type].push(message);
    } else {
      groups.other.push(message);
    }
  }

  return { groups, typeLabels };
}

function formatChangelogSection(version, date, commits) {
  const { groups, typeLabels } = groupCommits(commits);
  const lines = [`## v${version} - ${date}`, ""];

  const order = ["feat", "fix", "refactor", "perf", "docs", "test", "chore", "ci", "build", "other"];

  for (const type of order) {
    if (groups[type].length === 0) continue;
    const label = typeLabels[type] || "Other";
    lines.push(`### ${label}`, "");
    for (const msg of groups[type]) {
      lines.push(`- ${msg}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  log(dryRun ? "DRY RUN — no changes will be made" : "RepoLens Release");
  log("=".repeat(50));

  // Check clean working directory
  const status = run("git status --porcelain");
  if (status && !dryRun) {
    console.error("\n  ✗ Working directory is not clean. Commit or stash changes first.");
    console.error("  Untracked/staged files:");
    for (const line of status.split("\n").filter(Boolean)) {
      console.error(`    ${line}`);
    }
    process.exit(1);
  }

  // Read current version
  const cliPkg = JSON.parse(readFileSync(CLI_PKG_PATH, "utf8"));
  const currentVersion = cliPkg.version;
  log(`Current version: ${currentVersion}`);

  // Prompt for bump type
  console.log("\n  Select bump type:");
  console.log(`  1) patch   (${currentVersion} → ${bumpVersion(currentVersion, "patch")})`);
  console.log(`  2) minor   (${currentVersion} → ${bumpVersion(currentVersion, "minor")})`);
  console.log(`  3) major   (${currentVersion} → ${bumpVersion(currentVersion, "major")})`);
  console.log(`  4) prerelease (${currentVersion} → ${bumpVersion(currentVersion, "prerelease", "alpha")})`);

  const choice = await prompt("\n  Enter choice (1-4): ");
  let bumpType;
  let prereleaseId = "alpha";

  switch (choice.trim()) {
    case "1": bumpType = "patch"; break;
    case "2": bumpType = "minor"; break;
    case "3": bumpType = "major"; break;
    case "4": {
      bumpType = "prerelease";
      const id = await prompt("  Prerelease identifier (alpha/beta/rc): ");
      prereleaseId = id.trim() || "alpha";
      break;
    }
    default:
      console.error("\n  ✗ Invalid choice");
      process.exit(1);
  }

  const newVersion = bumpVersion(currentVersion, bumpType, prereleaseId);
  log(`New version: ${newVersion}`);

  // Get commits since last tag
  const commits = getCommitsSinceLastTag();
  if (!commits) {
    log("No new commits since last tag");
    const proceed = await prompt("  Continue anyway? (y/N): ");
    if (proceed.trim().toLowerCase() !== "y") {
      process.exit(0);
    }
  }

  // Generate changelog section
  const today = new Date().toISOString().split("T")[0];
  const changelogSection = formatChangelogSection(newVersion, today, commits);

  console.log("\n  Changelog entries:");
  console.log("  " + "─".repeat(48));
  for (const line of changelogSection.split("\n")) {
    console.log(`  ${line}`);
  }
  console.log("  " + "─".repeat(48));

  // Confirm
  if (!dryRun) {
    const confirm = await prompt("\n  Proceed with release? (y/N): ");
    if (confirm.trim().toLowerCase() !== "y") {
      log("Release cancelled");
      process.exit(0);
    }
  }

  if (dryRun) {
    log("DRY RUN — would perform these actions:");
    log(`1. Update ${CLI_PKG_PATH} version to ${newVersion}`);
    log(`2. Update ${ACTION_PKG_PATH} version to ${newVersion}`);
    log(`3. Update/create ${CHANGELOG_PATH}`);
    log(`4. Git commit: "chore: release v${newVersion}"`);
    log(`5. Git tag: v${newVersion}`);
    log(`6. git push && git push --tags`);
    log(`7. npm publish (run manually from apps/cli/)`);
    rl.close();
    return;
  }

  // Update CLI package.json
  cliPkg.version = newVersion;
  writeFileSync(CLI_PKG_PATH, JSON.stringify(cliPkg, null, 2) + "\n");
  log(`Updated ${CLI_PKG_PATH}`);

  // Update Action package.json
  if (existsSync(ACTION_PKG_PATH)) {
    const actionPkg = JSON.parse(readFileSync(ACTION_PKG_PATH, "utf8"));
    actionPkg.version = newVersion;
    writeFileSync(ACTION_PKG_PATH, JSON.stringify(actionPkg, null, 2) + "\n");
    log(`Updated ${ACTION_PKG_PATH}`);
  }

  // Update CHANGELOG.md
  let existingChangelog;
  if (existsSync(CHANGELOG_PATH)) {
    existingChangelog = readFileSync(CHANGELOG_PATH, "utf8").trimEnd();
  } else {
    existingChangelog = "# Changelog\n";
  }

  const newChangelog = `${existingChangelog}\n\n${changelogSection}\n`;
  writeFileSync(CHANGELOG_PATH, newChangelog);
  log(`Updated ${CHANGELOG_PATH}`);

  // Git commit
  run("git add .");
  run(`git commit -m "chore: release v${newVersion}"`);
  log("Committed changes");

  // Git tag
  run(`git tag v${newVersion}`);
  log(`Created tag v${newVersion}`);

  // Push
  run("git push");
  run("git push --tags");
  log("Pushed to GitHub");

  console.log("\n  ✓ Release v${newVersion} complete");
  console.log("  Next: cd apps/cli && npm publish");

  rl.close();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
