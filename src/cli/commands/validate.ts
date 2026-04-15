import { Flags } from "@oclif/core";
import fs from "fs";
import os from "os";
import path from "path";
import { parse as parseYaml } from "yaml";
import { BaseCommand } from "../base-command.js";
import { getErrorMessage } from "../utils/errors.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { ERROR_MESSAGES } from "../utils/messages.js";
import {
  validateAllPlugins,
  printPluginValidationResult,
  validateSkillFrontmatter,
  validateAgentFrontmatter,
  getUserPluginsDir,
  getProjectPluginsDir,
} from "../lib/plugins/index.js";
import { validateSource } from "../lib/source-validator.js";
import { isLocalSource, resolveAllSources, type SourceEntry } from "../lib/configuration/index.js";
import { resolveInstallPaths } from "../lib/installation/index.js";
import { formatZodErrors } from "../lib/schema-validator.js";
import {
  isCustomMetadata,
  metadataValidationSchema,
  customMetadataValidationSchema,
} from "../lib/schemas.js";
import { PLUGIN_MANIFEST_DIR, STANDARD_FILES } from "../consts.js";
import type { ValidationResult } from "../types/index.js";
import { directoryExists, fileExists, glob, listDirectories, readFile } from "../utils/fs.js";
import { setVerbose } from "../utils/logger.js";

const COL_NAME_WIDTH = 30;
const COL_URL_WIDTH = 40;
const COL_PATH_WIDTH = 50;

const VALIDATE_STATUS = {
  SKIPPED_REMOTE: "— skipped (remote source)",
  NOT_PRESENT: "— not present",
  EMPTY: "— none",
  NO_PLUGINS: "— no plugins",
} as const;

type AggregateCounts = {
  errors: number;
  warnings: number;
};

export default class Validate extends BaseCommand {
  static summary =
    "Validate every registered source, installed plugin, installed skill, and installed agent";
  static description =
    "Validates every registered source (primary + extras), every installed plugin " +
    "directory (global `~/.claude/plugins/` and project `./.claude/plugins/`), every installed " +
    "skill (global `~/.claude/skills/` and project `./.claude/skills/`), and every installed " +
    "agent (global `~/.claude/agents/` and project `./.claude/agents/`).";

  static examples = [
    {
      description: "Validate everything (sources, plugins, installed skills, installed agents)",
      command: "<%= config.bin %> <%= command.id %>",
    },
    {
      description: "Validate with verbose output",
      command: "<%= config.bin %> <%= command.id %> --verbose",
    },
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    verbose: Flags.boolean({
      char: "v",
      description: "Enable verbose logging",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Validate);
    setVerbose(flags.verbose);

    const totals: AggregateCounts = { errors: 0, warnings: 0 };

    try {
      await this.validateAllRegistered(flags.verbose, totals);
    } catch (error) {
      const message = getErrorMessage(error);
      this.error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${message}`, { exit: EXIT_CODES.ERROR });
    }

    this.log("");
    this.log(`Result: ${totals.errors} error(s), ${totals.warnings} warning(s)`);
    this.log("");

    if (totals.errors > 0) {
      this.error(ERROR_MESSAGES.VALIDATION_FAILED, { exit: EXIT_CODES.ERROR });
    }
  }

  private async validateAllRegistered(verbose: boolean, totals: AggregateCounts): Promise<void> {
    const projectDir = process.cwd();
    const globalPaths = resolveInstallPaths(projectDir, "global");
    const projectPaths = resolveInstallPaths(projectDir, "project");

    // Use realpath to compare project vs home — string comparison fails on macOS
    // where $HOME may be a symlink.
    const projectReal = fs.realpathSync(projectDir);
    const homeReal = fs.realpathSync(os.homedir());
    const inHome = projectReal === homeReal;

    this.log("");
    this.log("Validating sources");

    const { primary, extras } = await resolveAllSources(projectDir);
    const sources: SourceEntry[] = [primary, ...extras];

    for (const source of sources) {
      await this.validateRegisteredSource(source, totals);
    }

    this.log("");
    this.log("Validating plugins");

    await this.validatePluginsDirectory(getUserPluginsDir(), verbose, totals);
    if (!inHome) {
      await this.validatePluginsDirectory(getProjectPluginsDir(projectDir), verbose, totals);
    }

    this.log("");
    this.log("Validating skills");

    await this.validateInstalledSkillsDirectory(globalPaths.skillsDir, verbose, totals);
    if (!inHome) {
      await this.validateInstalledSkillsDirectory(projectPaths.skillsDir, verbose, totals);
    }

    this.log("");
    this.log("Validating agents");

    await this.validateInstalledAgentsDirectory(globalPaths.agentsDir, verbose, totals);
    if (!inHome) {
      await this.validateInstalledAgentsDirectory(projectPaths.agentsDir, verbose, totals);
    }
  }

  private async validateRegisteredSource(
    source: SourceEntry,
    totals: AggregateCounts,
  ): Promise<void> {
    if (!isLocalSource(source.url)) {
      this.log(
        `  ${source.name.padEnd(COL_NAME_WIDTH)} ${source.url.padEnd(COL_URL_WIDTH)} ${VALIDATE_STATUS.SKIPPED_REMOTE}`,
      );
      return;
    }

    try {
      const result = await validateSource(source.url);
      this.log(
        `  ${source.name.padEnd(COL_NAME_WIDTH)} ${source.url.padEnd(COL_URL_WIDTH)} ${result.skillCount} skill(s), ${result.errorCount} error(s), ${result.warningCount} warning(s)`,
      );

      for (const issue of result.issues) {
        const prefix = issue.severity === "error" ? "ERROR" : "WARN";
        this.log(`    [${prefix}] ${issue.file}: ${issue.message}`);
      }

      totals.errors += result.errorCount;
      totals.warnings += result.warningCount;
    } catch (error) {
      const message = getErrorMessage(error);
      this.log(
        `  ${source.name.padEnd(COL_NAME_WIDTH)} ${source.url.padEnd(COL_URL_WIDTH)} failed: ${message}`,
      );
      totals.errors += 1;
    }
  }

  private async validatePluginsDirectory(
    pluginsDir: string,
    verbose: boolean,
    totals: AggregateCounts,
  ): Promise<void> {
    const displayPath = displayDir(pluginsDir);

    if (!(await directoryExists(pluginsDir))) {
      this.log(`  ${displayPath.padEnd(COL_PATH_WIDTH)} ${VALIDATE_STATUS.NOT_PRESENT}`);
      return;
    }

    const pluginDirs = await findPluginDirectories(pluginsDir);
    if (pluginDirs.length === 0) {
      this.log(`  ${displayPath.padEnd(COL_PATH_WIDTH)} ${VALIDATE_STATUS.NO_PLUGINS}`);
      return;
    }

    const result = await validateAllPlugins(pluginsDir);

    this.log(
      `  ${displayPath.padEnd(COL_PATH_WIDTH)} ${result.summary.total} plugin(s), ${result.summary.invalid} invalid, ${result.summary.withWarnings} with warnings`,
    );

    for (const { name, result: pluginResult } of result.results) {
      printPluginValidationResult(name, pluginResult, verbose);
      if (!pluginResult.valid) totals.errors += pluginResult.errors.length;
      totals.warnings += pluginResult.warnings.length;
    }
  }

  private async validateInstalledSkillsDirectory(
    skillsDir: string,
    verbose: boolean,
    totals: AggregateCounts,
  ): Promise<void> {
    const displayPath = displayDir(skillsDir);

    if (!(await directoryExists(skillsDir))) {
      this.log(`  ${displayPath.padEnd(COL_PATH_WIDTH)} ${VALIDATE_STATUS.NOT_PRESENT}`);
      return;
    }

    const skillDirs = await listDirectories(skillsDir);
    if (skillDirs.length === 0) {
      this.log(`  ${displayPath.padEnd(COL_PATH_WIDTH)} ${VALIDATE_STATUS.EMPTY}`);
      return;
    }

    const results = await Promise.all(
      skillDirs.map(async (name) => ({
        name,
        result: await validateInstalledSkill(path.join(skillsDir, name)),
      })),
    );

    const invalidCount = results.filter((r) => !r.result.valid).length;
    const warnCount = results.filter((r) => r.result.warnings.length > 0).length;

    this.log(
      `  ${displayPath.padEnd(COL_PATH_WIDTH)} ${skillDirs.length} skill(s), ${invalidCount} invalid, ${warnCount} with warnings`,
    );

    for (const { name, result } of results) {
      printPluginValidationResult(name, result, verbose);
      if (!result.valid) totals.errors += result.errors.length;
      totals.warnings += result.warnings.length;
    }
  }

  private async validateInstalledAgentsDirectory(
    agentsDir: string,
    verbose: boolean,
    totals: AggregateCounts,
  ): Promise<void> {
    const displayPath = displayDir(agentsDir);

    if (!(await directoryExists(agentsDir))) {
      this.log(`  ${displayPath.padEnd(COL_PATH_WIDTH)} ${VALIDATE_STATUS.NOT_PRESENT}`);
      return;
    }

    const agentFiles = await findAgentFiles(agentsDir);
    if (agentFiles.length === 0) {
      this.log(`  ${displayPath.padEnd(COL_PATH_WIDTH)} ${VALIDATE_STATUS.EMPTY}`);
      return;
    }

    const results = await Promise.all(
      agentFiles.map(async (fileName) => ({
        name: fileName,
        result: await validateAgentFrontmatter(path.join(agentsDir, fileName)),
      })),
    );

    const invalidCount = results.filter((r) => !r.result.valid).length;
    const warnCount = results.filter((r) => r.result.warnings.length > 0).length;

    this.log(
      `  ${displayPath.padEnd(COL_PATH_WIDTH)} ${agentFiles.length} agent(s), ${invalidCount} invalid, ${warnCount} with warnings`,
    );

    for (const { name, result } of results) {
      printPluginValidationResult(name, result, verbose);
      if (!result.valid) totals.errors += result.errors.length;
      totals.warnings += result.warnings.length;
    }
  }
}

/** Render an absolute path with a `~/` prefix when it's under the user's home directory. */
function displayDir(absolutePath: string): string {
  const home = os.homedir();
  if (absolutePath === home) return "~";
  if (absolutePath.startsWith(home + path.sep)) {
    return `~${path.sep}${path.relative(home, absolutePath)}`;
  }
  return absolutePath;
}

async function findAgentFiles(agentsDir: string): Promise<string[]> {
  return glob("*.md", agentsDir);
}

async function validateInstalledSkill(skillDir: string): Promise<ValidationResult> {
  const skillMdPath = path.join(skillDir, STANDARD_FILES.SKILL_MD);
  const metadataPath = path.join(skillDir, STANDARD_FILES.METADATA_YAML);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(await fileExists(skillMdPath))) {
    errors.push(`Missing ${STANDARD_FILES.SKILL_MD}`);
  } else {
    const frontmatterResult = await validateSkillFrontmatter(skillMdPath);
    errors.push(...frontmatterResult.errors);
    warnings.push(...frontmatterResult.warnings);
  }

  if (!(await fileExists(metadataPath))) {
    errors.push(`Missing ${STANDARD_FILES.METADATA_YAML}`);
  } else {
    const metadataResult = await validateInstalledSkillMetadata(metadataPath);
    errors.push(...metadataResult.errors);
    warnings.push(...metadataResult.warnings);
  }

  return { valid: errors.length === 0, errors, warnings };
}

async function validateInstalledSkillMetadata(metadataPath: string): Promise<ValidationResult> {
  let rawMetadata: unknown;
  try {
    const content = await readFile(metadataPath);
    rawMetadata = parseYaml(content);
  } catch (err) {
    return {
      valid: false,
      errors: [`${STANDARD_FILES.METADATA_YAML}: ${getErrorMessage(err)}`],
      warnings: [],
    };
  }

  const isCustom = isCustomMetadata(rawMetadata);
  const schema = isCustom ? customMetadataValidationSchema : metadataValidationSchema;

  const result = schema.safeParse(rawMetadata);
  if (result.success) {
    return { valid: true, errors: [], warnings: [] };
  }

  return {
    valid: false,
    errors: formatZodErrors(result.error).map((e) => `${STANDARD_FILES.METADATA_YAML}: ${e}`),
    warnings: [],
  };
}

async function findPluginDirectories(pluginsDir: string): Promise<string[]> {
  const entries = await listDirectories(pluginsDir);
  const pluginDirs: string[] = [];
  for (const name of entries) {
    const manifestDir = path.join(pluginsDir, name, PLUGIN_MANIFEST_DIR);
    if (await directoryExists(manifestDir)) pluginDirs.push(name);
  }
  return pluginDirs;
}
