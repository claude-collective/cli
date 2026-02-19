import { Flags } from "@oclif/core";
import path from "path";
import { BaseCommand } from "../base-command";
import { getErrorMessage } from "../utils/errors";
import { EXIT_CODES } from "../lib/exit-codes";
import { loadProjectConfig, validateProjectConfig } from "../lib/configuration";
import { loadSkillsMatrixFromSource } from "../lib/loading";
import { discoverLocalSkills } from "../lib/skills";
import { getStackSkillIds } from "../lib/stacks";
import type { AgentName, MergedSkillsMatrix, ProjectConfig, SkillId } from "../types";
import { fileExists, glob, directoryExists } from "../utils/fs";
import { CLAUDE_DIR, CLI_BIN_NAME, DEFAULT_BRANDING } from "../consts";
import { setVerbose } from "../utils/logger";

type CheckResult = {
  status: "pass" | "fail" | "warn" | "skip";
  message: string;
  details?: string[];
};

async function checkConfigValid(projectDir: string): Promise<CheckResult> {
  const loaded = await loadProjectConfig(projectDir);

  if (!loaded) {
    return {
      status: "fail",
      message: ".claude/config.yaml not found",
      details: [`Run '${CLI_BIN_NAME} init' to create a configuration`],
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

async function checkSkillsResolved(
  config: ProjectConfig,
  matrix: MergedSkillsMatrix,
  projectDir: string,
): Promise<CheckResult> {
  const uniqueSkills = config.stack ? getStackSkillIds(config.stack) : [];

  if (uniqueSkills.length === 0) {
    return {
      status: "pass",
      message: "No skills configured",
    };
  }

  const localResult = await discoverLocalSkills(projectDir);
  const localSkillIds = new Set(localResult?.skills.map((s) => s.id) ?? []);

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

  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
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

async function checkNoOrphans(config: ProjectConfig, projectDir: string): Promise<CheckResult> {
  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");

  if (!(await directoryExists(agentsDir))) {
    return {
      status: "pass",
      message: "No agents directory",
    };
  }

  const mdFiles = await glob("*.md", agentsDir);
  const configAgents = new Set(config.agents ?? []);

  const orphanedFiles: string[] = [];
  for (const file of mdFiles) {
    const agentName = file.replace(/\.md$/, "");
    // Boundary cast: filename from filesystem compared against typed config
    if (!configAgents.has(agentName as AgentName)) {
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
    const message = getErrorMessage(error);
    return {
      status: "fail",
      message: "Failed to load source",
      details: [message],
    };
  }
}

const CHECK_WIDTH = 20;

function formatCheckName(name: string): string {
  return name.padEnd(CHECK_WIDTH);
}

function formatStatus(status: CheckResult["status"]): string {
  switch (status) {
    case "pass":
      return "\u2713"; // ✓
    case "fail":
      return "\u2717"; // ✗
    case "warn":
      return "!";
    case "skip":
      return "-";
    default:
      return "?";
  }
}

function formatCheckLine(name: string, result: CheckResult, verbose: boolean): string[] {
  const statusIcon = formatStatus(result.status);
  const nameFormatted = formatCheckName(name);
  const lines: string[] = [];

  lines.push(`  ${nameFormatted}${statusIcon}  ${result.message}`);

  const shouldShowDetails =
    result.details &&
    result.details.length > 0 &&
    (verbose || result.status === "fail" || result.status === "warn");

  if (shouldShowDetails) {
    for (const detail of result.details!) {
      lines.push(`  ${" ".repeat(CHECK_WIDTH)}   ${detail}`);
    }
  }

  return lines;
}

function formatSummary(results: CheckResult[]): string {
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
      default:
        break;
    }
  }

  const parts: string[] = [];
  parts.push(`${passed} passed`);

  if (warnings > 0) {
    parts.push(`${warnings} warning${warnings === 1 ? "" : "s"}`);
  } else {
    parts.push(`0 warnings`);
  }

  if (errors > 0) {
    parts.push(`${errors} error${errors === 1 ? "" : "s"}`);
  } else {
    parts.push(`0 errors`);
  }

  return `  Summary: ${parts.join(", ")}`;
}

function formatTips(results: CheckResult[]): string[] {
  const hasAgentWarning = results.some(
    (r) => r.status === "warn" && r.message.includes("recompilation"),
  );
  const hasConfigError = results.some((r) => r.status === "fail" && r.message.includes("config"));
  const hasSkillError = results.some(
    (r) => r.status === "fail" && r.message.includes("skills found"),
  );

  const tips: string[] = [];

  if (hasAgentWarning) {
    tips.push(`  Tip: Run '${CLI_BIN_NAME} compile' to generate missing agent files`);
  }
  if (hasConfigError) {
    tips.push(`  Tip: Run '${CLI_BIN_NAME} init' to create or fix configuration`);
  }
  if (hasSkillError) {
    tips.push("  Tip: Check skill IDs in config match available skills");
  }

  return tips;
}

export default class Doctor extends BaseCommand {
  static summary = "Diagnose common configuration issues";

  static description = `Run diagnostic checks on your ${DEFAULT_BRANDING.NAME} configuration to identify issues with config validity, skill resolution, agent compilation, and source connectivity.`;

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --verbose",
    "<%= config.bin %> <%= command.id %> --source /path/to/marketplace",
  ];

  static flags = {
    source: Flags.string({
      char: "s",
      description: "Skills source path or URL",
    }),
    verbose: Flags.boolean({
      char: "v",
      description: "Show detailed output",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Doctor);

    setVerbose(flags.verbose);

    const projectDir = process.cwd();

    this.log("");
    this.log(`${DEFAULT_BRANDING.NAME} Doctor`);
    this.log("");
    this.log("  Checking configuration health...");
    this.log("");

    const results: CheckResult[] = [];

    const configResult = await checkConfigValid(projectDir);
    results.push(configResult);
    formatCheckLine("Config Valid", configResult, flags.verbose).forEach((line) => this.log(line));

    let config: ProjectConfig | null = null;
    let matrix: MergedSkillsMatrix | null = null;

    if (configResult.status !== "fail") {
      const loaded = await loadProjectConfig(projectDir);
      config = loaded?.config ?? null;
    }

    const sourceResult = await checkSourceReachable(flags.source, projectDir);

    try {
      const result = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
        projectDir,
      });
      matrix = result.matrix;
    } catch {
      // Matrix unavailable
    }

    if (config && matrix) {
      const skillsResult = await checkSkillsResolved(config, matrix, projectDir);
      results.push(skillsResult);
      formatCheckLine("Skills Resolved", skillsResult, flags.verbose).forEach((line) =>
        this.log(line),
      );
    } else {
      const skipResult: CheckResult = {
        status: "skip",
        message: "Skipped (config invalid)",
      };
      results.push(skipResult);
      formatCheckLine("Skills Resolved", skipResult, flags.verbose).forEach((line) =>
        this.log(line),
      );
    }

    if (config) {
      const agentsResult = await checkAgentsCompiled(config, projectDir);
      results.push(agentsResult);
      formatCheckLine("Agents Compiled", agentsResult, flags.verbose).forEach((line) =>
        this.log(line),
      );
    } else {
      const skipResult: CheckResult = {
        status: "skip",
        message: "Skipped (config invalid)",
      };
      results.push(skipResult);
      formatCheckLine("Agents Compiled", skipResult, flags.verbose).forEach((line) =>
        this.log(line),
      );
    }

    if (config) {
      const orphansResult = await checkNoOrphans(config, projectDir);
      results.push(orphansResult);
      formatCheckLine("No Orphans", orphansResult, flags.verbose).forEach((line) => this.log(line));
    } else {
      const skipResult: CheckResult = {
        status: "skip",
        message: "Skipped (config invalid)",
      };
      results.push(skipResult);
      formatCheckLine("No Orphans", skipResult, flags.verbose).forEach((line) => this.log(line));
    }

    results.push(sourceResult);
    formatCheckLine("Source Reachable", sourceResult, flags.verbose).forEach((line) =>
      this.log(line),
    );

    this.log("");
    this.log(formatSummary(results));

    const tips = formatTips(results);
    if (tips.length > 0) {
      this.log("");
      tips.forEach((tip) => this.log(tip));
    }

    this.log("");

    const hasErrors = results.some((r) => r.status === "fail");
    if (hasErrors) {
      this.exit(EXIT_CODES.ERROR);
    }
  }
}
