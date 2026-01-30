import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { setVerbose } from "../utils/logger";
import { fileExists, glob, directoryExists } from "../utils/fs";
import { EXIT_CODES } from "../lib/exit-codes";
import {
  loadProjectConfig,
  validateProjectConfig,
} from "../lib/project-config";
import { loadSkillsMatrixFromSource } from "../lib/source-loader";
import { discoverLocalSkills } from "../lib/local-skill-loader";
import type { ProjectConfig } from "../../types";
import type { MergedSkillsMatrix } from "../types-matrix";

// =============================================================================
// Types
// =============================================================================

interface CheckResult {
  status: "pass" | "fail" | "warn" | "skip";
  message: string;
  details?: string[];
}

interface DoctorOptions {
  source?: string;
  verbose?: boolean;
}

// =============================================================================
// Check Functions
// =============================================================================

/**
 * Check 1: Config Valid
 * Parse .claude/config.yaml without errors
 */
async function checkConfigValid(projectDir: string): Promise<CheckResult> {
  const loaded = await loadProjectConfig(projectDir);

  if (!loaded) {
    return {
      status: "fail",
      message: ".claude/config.yaml not found",
      details: ["Run 'cc init' to create a configuration"],
    };
  }

  const validation = validateProjectConfig(loaded.config);

  if (!validation.valid) {
    return {
      status: "fail",
      message: ".claude/config.yaml has errors",
      details: validation.errors,
    };
  }

  if (validation.warnings.length > 0) {
    return {
      status: "warn",
      message: ".claude/config.yaml has warnings",
      details: validation.warnings,
    };
  }

  return {
    status: "pass",
    message: ".claude/config.yaml is valid",
  };
}

/**
 * Check 2: Skills Resolved
 * All skills in config exist in source or locally
 */
async function checkSkillsResolved(
  config: ProjectConfig,
  matrix: MergedSkillsMatrix,
  projectDir: string,
): Promise<CheckResult> {
  const configSkills: string[] = [];

  // Collect skill IDs from config.skills
  if (config.skills) {
    for (const skill of config.skills) {
      if (typeof skill === "string") {
        configSkills.push(skill);
      } else if (skill.id) {
        configSkills.push(skill.id);
      }
    }
  }

  // Collect skill IDs from config.agent_skills
  if (config.agent_skills) {
    for (const agentSkills of Object.values(config.agent_skills)) {
      if (Array.isArray(agentSkills)) {
        // Simple list format
        for (const skill of agentSkills) {
          if (typeof skill === "string") {
            configSkills.push(skill);
          } else if (skill.id) {
            configSkills.push(skill.id);
          }
        }
      } else if (typeof agentSkills === "object") {
        // Categorized format
        for (const categorySkills of Object.values(agentSkills)) {
          if (Array.isArray(categorySkills)) {
            for (const skill of categorySkills) {
              if (typeof skill === "string") {
                configSkills.push(skill);
              } else if (skill.id) {
                configSkills.push(skill.id);
              }
            }
          }
        }
      }
    }
  }

  // Dedupe skills
  const uniqueSkills = [...new Set(configSkills)];

  if (uniqueSkills.length === 0) {
    return {
      status: "pass",
      message: "No skills configured",
    };
  }

  // Check local skills
  const localResult = await discoverLocalSkills(projectDir);
  const localSkillIds = new Set(localResult?.skills.map((s) => s.id) ?? []);

  // Check which skills are missing
  const missingSkills: string[] = [];
  for (const skillId of uniqueSkills) {
    const inMatrix = skillId in matrix.skills;
    const inLocal = localSkillIds.has(skillId);
    if (!inMatrix && !inLocal) {
      missingSkills.push(skillId);
    }
  }

  if (missingSkills.length > 0) {
    return {
      status: "fail",
      message: `${uniqueSkills.length - missingSkills.length}/${uniqueSkills.length} skills found`,
      details: missingSkills.map((s) => `- ${s} (not found)`),
    };
  }

  return {
    status: "pass",
    message: `${uniqueSkills.length}/${uniqueSkills.length} skills found`,
  };
}

/**
 * Check 3: Agents Compiled
 * All agents in config have .md files in .claude/agents/
 */
async function checkAgentsCompiled(
  config: ProjectConfig,
  projectDir: string,
): Promise<CheckResult> {
  const agents = config.agents ?? [];

  if (agents.length === 0) {
    return {
      status: "pass",
      message: "No agents configured",
    };
  }

  const agentsDir = path.join(projectDir, ".claude", "agents");
  const missingAgents: string[] = [];

  for (const agent of agents) {
    const agentPath = path.join(agentsDir, `${agent}.md`);
    if (!(await fileExists(agentPath))) {
      missingAgents.push(agent);
    }
  }

  if (missingAgents.length > 0) {
    return {
      status: "warn",
      message: `${missingAgents.length} agent${missingAgents.length === 1 ? "" : "s"} need${missingAgents.length === 1 ? "s" : ""} recompilation`,
      details: missingAgents.map((a) => `- ${a} (missing)`),
    };
  }

  return {
    status: "pass",
    message: `${agents.length}/${agents.length} agents compiled`,
  };
}

/**
 * Check 4: No Orphans
 * No extra files in .claude/agents/ not in config
 */
async function checkNoOrphans(
  config: ProjectConfig,
  projectDir: string,
): Promise<CheckResult> {
  const agentsDir = path.join(projectDir, ".claude", "agents");

  if (!(await directoryExists(agentsDir))) {
    return {
      status: "pass",
      message: "No agents directory",
    };
  }

  // Find all .md files in agents directory
  const mdFiles = await glob("*.md", agentsDir);
  const configAgents = new Set(config.agents ?? []);

  const orphanedFiles: string[] = [];
  for (const file of mdFiles) {
    const agentName = file.replace(/\.md$/, "");
    if (!configAgents.has(agentName)) {
      orphanedFiles.push(agentName);
    }
  }

  if (orphanedFiles.length > 0) {
    return {
      status: "warn",
      message: `${orphanedFiles.length} orphaned agent file${orphanedFiles.length === 1 ? "" : "s"}`,
      details: orphanedFiles.map((f) => `- ${f}.md (not in config)`),
    };
  }

  return {
    status: "pass",
    message: "No orphaned agent files",
  };
}

/**
 * Check 5: Source Reachable
 * Can load from configured source
 */
async function checkSourceReachable(
  sourceFlag: string | undefined,
  projectDir: string,
): Promise<CheckResult> {
  try {
    const result = await loadSkillsMatrixFromSource({
      sourceFlag,
      projectDir,
    });

    const skillCount = Object.keys(result.matrix.skills).length;
    const sourceLabel = result.isLocal ? "local" : "remote";

    return {
      status: "pass",
      message: `Connected to ${sourceLabel}: ${result.sourcePath}`,
      details: [`${skillCount} skills available`],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "fail",
      message: "Failed to load source",
      details: [message],
    };
  }
}

// =============================================================================
// Output Formatting
// =============================================================================

const CHECK_WIDTH = 20;

function formatCheckName(name: string): string {
  return name.padEnd(CHECK_WIDTH);
}

function formatStatus(status: CheckResult["status"]): string {
  switch (status) {
    case "pass":
      return pc.green("\u2713");
    case "fail":
      return pc.red("\u2717");
    case "warn":
      return pc.yellow("!");
    case "skip":
      return pc.dim("-");
  }
}

function printCheck(name: string, result: CheckResult, verbose: boolean): void {
  const statusIcon = formatStatus(result.status);
  const nameFormatted = formatCheckName(name);

  console.log(`  ${nameFormatted}${statusIcon}  ${result.message}`);

  // Show details if verbose or if there are errors/warnings
  const shouldShowDetails =
    result.details &&
    result.details.length > 0 &&
    (verbose || result.status === "fail" || result.status === "warn");

  if (shouldShowDetails) {
    for (const detail of result.details!) {
      console.log(`  ${" ".repeat(CHECK_WIDTH)}   ${pc.dim(detail)}`);
    }
  }
}

function printSummary(results: CheckResult[]): void {
  let passed = 0;
  let warnings = 0;
  let errors = 0;

  for (const result of results) {
    switch (result.status) {
      case "pass":
        passed++;
        break;
      case "warn":
        warnings++;
        break;
      case "fail":
        errors++;
        break;
      // skip doesn't count
    }
  }

  const parts: string[] = [];
  parts.push(`${passed} passed`);
  if (warnings > 0) {
    parts.push(pc.yellow(`${warnings} warning${warnings === 1 ? "" : "s"}`));
  } else {
    parts.push(`0 warnings`);
  }
  if (errors > 0) {
    parts.push(pc.red(`${errors} error${errors === 1 ? "" : "s"}`));
  } else {
    parts.push(`0 errors`);
  }

  console.log(`\n  ${pc.bold("Summary:")} ${parts.join(", ")}`);
}

function printTips(results: CheckResult[]): void {
  const hasAgentWarning = results.some(
    (r) => r.status === "warn" && r.message.includes("recompilation"),
  );
  const hasConfigError = results.some(
    (r) => r.status === "fail" && r.message.includes("config"),
  );
  const hasSkillError = results.some(
    (r) => r.status === "fail" && r.message.includes("skills found"),
  );

  const tips: string[] = [];

  if (hasAgentWarning) {
    tips.push("Run 'cc compile' to generate missing agent files");
  }
  if (hasConfigError) {
    tips.push("Run 'cc init' to create or fix configuration");
  }
  if (hasSkillError) {
    tips.push("Check skill IDs in config match available skills");
  }

  if (tips.length > 0) {
    console.log("");
    for (const tip of tips) {
      console.log(`  ${pc.cyan("Tip:")} ${tip}`);
    }
  }
}

// =============================================================================
// Command
// =============================================================================

export const doctorCommand = new Command("doctor")
  .description("Diagnose common configuration issues")
  .option("-s, --source <source>", "Skills source path or URL")
  .option("-v, --verbose", "Show detailed output", false)
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options: DoctorOptions) => {
    const s = p.spinner();

    setVerbose(options.verbose ?? false);

    const projectDir = process.cwd();

    console.log(`\n${pc.bold("Claude Collective Doctor")}\n`);
    console.log("  Checking configuration health...\n");

    const results: CheckResult[] = [];

    // Check 1: Config Valid
    s.start("Checking configuration...");
    const configResult = await checkConfigValid(projectDir);
    s.stop("");
    results.push(configResult);
    printCheck("Config Valid", configResult, options.verbose ?? false);

    // Load config for remaining checks (if valid)
    let config: ProjectConfig | null = null;
    let matrix: MergedSkillsMatrix | null = null;

    if (configResult.status !== "fail") {
      const loaded = await loadProjectConfig(projectDir);
      config = loaded?.config ?? null;
    }

    // Check 5: Source Reachable (do this early to get matrix)
    s.start("Checking source...");
    const sourceResult = await checkSourceReachable(options.source, projectDir);
    s.stop("");

    // Try to get matrix even if source check failed with fallback
    try {
      const result = await loadSkillsMatrixFromSource({
        sourceFlag: options.source,
        projectDir,
      });
      matrix = result.matrix;
    } catch {
      // Matrix unavailable
    }

    // Check 2: Skills Resolved
    if (config && matrix) {
      s.start("Checking skills...");
      const skillsResult = await checkSkillsResolved(
        config,
        matrix,
        projectDir,
      );
      s.stop("");
      results.push(skillsResult);
      printCheck("Skills Resolved", skillsResult, options.verbose ?? false);
    } else {
      const skipResult: CheckResult = {
        status: "skip",
        message: "Skipped (config invalid)",
      };
      results.push(skipResult);
      printCheck("Skills Resolved", skipResult, options.verbose ?? false);
    }

    // Check 3: Agents Compiled
    if (config) {
      s.start("Checking agents...");
      const agentsResult = await checkAgentsCompiled(config, projectDir);
      s.stop("");
      results.push(agentsResult);
      printCheck("Agents Compiled", agentsResult, options.verbose ?? false);
    } else {
      const skipResult: CheckResult = {
        status: "skip",
        message: "Skipped (config invalid)",
      };
      results.push(skipResult);
      printCheck("Agents Compiled", skipResult, options.verbose ?? false);
    }

    // Check 4: No Orphans
    if (config) {
      s.start("Checking for orphans...");
      const orphansResult = await checkNoOrphans(config, projectDir);
      s.stop("");
      results.push(orphansResult);
      printCheck("No Orphans", orphansResult, options.verbose ?? false);
    } else {
      const skipResult: CheckResult = {
        status: "skip",
        message: "Skipped (config invalid)",
      };
      results.push(skipResult);
      printCheck("No Orphans", skipResult, options.verbose ?? false);
    }

    // Check 5: Source Reachable (already ran, just print)
    results.push(sourceResult);
    printCheck("Source Reachable", sourceResult, options.verbose ?? false);

    // Summary
    printSummary(results);

    // Tips
    printTips(results);

    console.log("");

    // Exit code: 0 if all pass (warnings OK), 1 if any fail
    const hasErrors = results.some((r) => r.status === "fail");
    if (hasErrors) {
      process.exit(EXIT_CODES.ERROR);
    }
  });
