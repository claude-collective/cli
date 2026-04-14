import { Flags } from "@oclif/core";
import os from "os";
import path from "path";
import { BaseCommand } from "../base-command";
import { getErrorMessage } from "../utils/errors";
import { EXIT_CODES } from "../lib/exit-codes";
import { validateProjectConfig } from "../lib/configuration";
import { loadSource, detectProject } from "../lib/operations";
import { matrix } from "../lib/matrix/matrix-provider";
import { discoverLocalSkills } from "../lib/skills";
import { getStackSkillIds } from "../lib/stacks";
import { filterExcludedEntries } from "../lib/agents";
import type { MergedSkillsMatrix, ProjectConfig, SkillConfig } from "../types";
import { fileExists, glob, directoryExists } from "../utils/fs";
import {
  CLAUDE_DIR,
  CLAUDE_SRC_DIR,
  CLI_BIN_NAME,
  DEFAULT_BRANDING,
  LOCAL_SKILLS_PATH,
  STANDARD_FILES,
} from "../consts";
import { countBy } from "remeda";
import { setVerbose } from "../utils/logger";

type CheckResult = {
  status: "pass" | "fail" | "warn" | "skip";
  message: string;
  details?: string[];
};

type ConfigCheckOutput = {
  result: CheckResult;
  config: ProjectConfig | null;
};

function checkConfigValid(config: ProjectConfig | null): ConfigCheckOutput {
  if (!config) {
    return {
      result: {
        status: "fail",
        message: `${CLAUDE_SRC_DIR}/${STANDARD_FILES.CONFIG_TS} not found`,
        details: [`Run '${CLI_BIN_NAME} init' to create a configuration`],
      },
      config: null,
    };
  }

  const validation = validateProjectConfig(config);

  if (!validation.valid) {
    return {
      result: {
        status: "fail",
        message: `${CLAUDE_SRC_DIR}/${STANDARD_FILES.CONFIG_TS} has errors`,
        details: validation.errors,
      },
      config: null,
    };
  }

  if (validation.warnings.length > 0) {
    return {
      result: {
        status: "warn",
        message: `${CLAUDE_SRC_DIR}/${STANDARD_FILES.CONFIG_TS} has warnings`,
        details: validation.warnings,
      },
      config,
    };
  }

  return {
    result: {
      status: "pass",
      message: `${CLAUDE_SRC_DIR}/${STANDARD_FILES.CONFIG_TS} is valid`,
    },
    config,
  };
}

async function checkSkillsResolved(
  config: ProjectConfig,
  matrix: MergedSkillsMatrix,
  projectDir: string,
): Promise<CheckResult> {
  // Filter excluded skill IDs from the stack check
  const activeIds = new Set(config.skills.filter((s) => !s.excluded).map((s) => s.id));
  const excludedIds = new Set(
    config.skills.filter((s) => s.excluded && !activeIds.has(s.id)).map((s) => s.id),
  );
  const uniqueSkills = config.stack
    ? getStackSkillIds(config.stack).filter((id) => !excludedIds.has(id))
    : [];

  if (uniqueSkills.length === 0) {
    return {
      status: "pass",
      message: "No skills configured",
    };
  }

  const localResult = await discoverLocalSkills(projectDir);
  const globalResult = projectDir !== os.homedir() ? await discoverLocalSkills(os.homedir()) : null;
  const localSkillIds = new Set([
    ...(localResult?.skills.map((s) => s.id) ?? []),
    ...(globalResult?.skills.map((s) => s.id) ?? []),
  ]);

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

  const projectAgentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  const globalAgentsDir = path.join(os.homedir(), CLAUDE_DIR, "agents");
  const missingAgents: string[] = [];

  for (const agent of agents) {
    // Check scope-appropriate directory for the agent
    const agentsDir = agent.scope === "global" ? globalAgentsDir : projectAgentsDir;
    const agentPath = path.join(agentsDir, `${agent.name}.md`);
    if (!(await fileExists(agentPath))) {
      missingAgents.push(agent.name);
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
  const projectAgentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  const globalAgentsDir = path.join(os.homedir(), CLAUDE_DIR, "agents");

  const projectExists = await directoryExists(projectAgentsDir);
  const globalExists = projectDir !== os.homedir() && (await directoryExists(globalAgentsDir));

  if (!projectExists && !globalExists) {
    return {
      status: "pass",
      message: "No agents directory",
    };
  }

  const projectMdFiles = projectExists ? await glob("*.md", projectAgentsDir) : [];
  const globalMdFiles = globalExists ? await glob("*.md", globalAgentsDir) : [];

  // Project files: only active project-scoped agents should have .md files here
  const activeProjectAgents: Set<string> = new Set(
    (config.agents ?? []).filter((a) => a.scope === "project" && !a.excluded).map((a) => a.name),
  );
  // Global files: all global-scoped agents (including excluded) still serve other projects
  const knownGlobalAgents: Set<string> = new Set(
    (config.agents ?? []).filter((a) => a.scope === "global").map((a) => a.name),
  );

  const orphanedFiles: string[] = [];
  for (const file of projectMdFiles) {
    const agentName = file.replace(/\.md$/, "");
    if (!activeProjectAgents.has(agentName)) {
      orphanedFiles.push(agentName);
    }
  }
  for (const file of globalMdFiles) {
    const agentName = file.replace(/\.md$/, "");
    if (!knownGlobalAgents.has(agentName)) {
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

async function checkSkillsInstalled(
  config: ProjectConfig,
  projectDir: string,
): Promise<CheckResult> {
  const skills: SkillConfig[] = config.skills ?? [];
  const ejectSkills = skills.filter((s) => s.source === "eject");

  if (ejectSkills.length === 0) {
    return {
      status: "pass",
      message: "No eject-mode skills configured",
    };
  }

  const missingSkills: string[] = [];

  for (const skill of ejectSkills) {
    const baseDir = skill.scope === "global" ? os.homedir() : projectDir;
    const skillDir = path.join(baseDir, LOCAL_SKILLS_PATH, skill.id);
    const skillMdPath = path.join(skillDir, STANDARD_FILES.SKILL_MD);

    if (!(await fileExists(skillMdPath))) {
      missingSkills.push(skill.id);
    }
  }

  if (missingSkills.length > 0) {
    return {
      status: "warn",
      message: `${missingSkills.length} skill${missingSkills.length === 1 ? "" : "s"} missing from disk`,
      details: missingSkills.map((s) => `- ${s} (not found in ${LOCAL_SKILLS_PATH}/)`),
    };
  }

  return {
    status: "pass",
    message: `${ejectSkills.length}/${ejectSkills.length} eject-mode skills installed`,
  };
}

async function checkSourceReachable(projectDir: string): Promise<CheckResult> {
  try {
    const { sourceResult: result } = await loadSource({
      projectDir,
    });

    const skillCount = Object.keys(matrix.skills).length;
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

  const { details } = result;
  if (
    details &&
    details.length > 0 &&
    (verbose || result.status === "fail" || result.status === "warn")
  ) {
    for (const detail of details) {
      lines.push(`  ${" ".repeat(CHECK_WIDTH)}   ${detail}`);
    }
  }

  return lines;
}

function formatSummary(results: CheckResult[]): string {
  const counts = countBy(results, (r) => r.status);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  const parts = [
    `${counts.pass ?? 0} passed`,
    plural(counts.warn ?? 0, "warning"),
    plural(counts.fail ?? 0, "error"),
  ];

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
  const hasMissingSkills = results.some(
    (r) => r.status === "warn" && r.message.includes("missing from disk"),
  );
  if (hasMissingSkills) {
    tips.push(`  Tip: Run '${CLI_BIN_NAME} compile' to reinstall missing skill files`);
  }

  return tips;
}

const SKIP_RESULT: CheckResult = { status: "skip", message: "Skipped (config invalid)" };

export default class Doctor extends BaseCommand {
  static summary = "Diagnose common configuration issues";

  static description = `Run diagnostic checks on your ${DEFAULT_BRANDING.NAME} configuration to identify issues with config validity, skill resolution, agent compilation, and source connectivity.`;

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --verbose",
  ];

  static flags = {
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

    this.printHeader();
    const results = await this.runAllChecks(projectDir, flags);
    this.printResults(results);

    if (results.some((r) => r.status === "fail")) {
      this.exit(EXIT_CODES.ERROR);
    }
  }

  private printHeader(): void {
    this.log("");
    this.log(`${DEFAULT_BRANDING.NAME} Doctor`);
    this.log("");
    this.log("  Checking configuration health...");
    this.log("");
  }

  private async runAllChecks(
    projectDir: string,
    flags: { verbose: boolean },
  ): Promise<CheckResult[]> {
    const detected = await detectProject(projectDir);
    const { result: configResult, config } = checkConfigValid(detected?.config ?? null);
    this.logCheck("Config Valid", configResult, flags.verbose);

    // loadSource (called by checkSourceReachable) populates the matrix automatically
    const sourceResult = await checkSourceReachable(projectDir);

    const filteredConfig = config ? filterExcludedEntries(config) : null;

    const skillsResult = config
      ? await checkSkillsResolved(config, matrix, projectDir)
      : SKIP_RESULT;
    this.logCheck("Skills Resolved", skillsResult, flags.verbose);

    const agentsResult = filteredConfig
      ? await checkAgentsCompiled(filteredConfig, projectDir)
      : SKIP_RESULT;
    this.logCheck("Agents Compiled", agentsResult, flags.verbose);

    const orphansResult = config ? await checkNoOrphans(config, projectDir) : SKIP_RESULT;
    this.logCheck("No Orphans", orphansResult, flags.verbose);

    const installedResult = filteredConfig
      ? await checkSkillsInstalled(filteredConfig, projectDir)
      : SKIP_RESULT;
    this.logCheck("Skills Installed", installedResult, flags.verbose);

    this.logCheck("Source Reachable", sourceResult, flags.verbose);

    return [configResult, skillsResult, agentsResult, orphansResult, installedResult, sourceResult];
  }

  private logCheck(name: string, result: CheckResult, verbose: boolean): void {
    for (const line of formatCheckLine(name, result, verbose)) {
      this.log(line);
    }
  }

  private printResults(results: CheckResult[]): void {
    this.log("");
    this.log(formatSummary(results));

    const tips = formatTips(results);
    if (tips.length > 0) {
      this.log("");
      for (const tip of tips) {
        this.log(tip);
      }
    }

    this.log("");
  }
}
