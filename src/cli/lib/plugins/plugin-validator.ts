import { z } from "zod";
import path from "path";
import fg from "fast-glob";
import { getErrorMessage } from "../../utils/errors";
import {
  fileExists,
  readFile,
  readFileSafe,
  directoryExists,
  listDirectories,
} from "../../utils/fs";
import type { ValidationResult } from "../../types";
import { countBy } from "remeda";
import { extractFrontmatter } from "../../utils/frontmatter";
import { log } from "../../utils/logger";
import {
  pluginAuthorSchema,
  hooksRecordSchema,
  skillFrontmatterValidationSchema,
  agentFrontmatterValidationSchema,
} from "../schemas";
import { MAX_PLUGIN_FILE_SIZE, PLUGIN_MANIFEST_DIR, STANDARD_FILES } from "../../consts";

const PLUGIN_DIR = PLUGIN_MANIFEST_DIR;
const PLUGIN_MANIFEST = STANDARD_FILES.PLUGIN_JSON;
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

// Strict schema that rejects unrecognized keys (loader schema in schemas.ts uses .passthrough())
const pluginManifestValidationSchema = z
  .object({
    name: z.string(),
    version: z.string().optional(),
    description: z.string().optional(),
    author: pluginAuthorSchema.optional(),
    keywords: z.array(z.string()).optional(),
    commands: z.union([z.string(), z.array(z.string())]).optional(),
    agents: z.union([z.string(), z.array(z.string())]).optional(),
    skills: z.union([z.string(), z.array(z.string())]).optional(),
    hooks: z.union([z.string(), hooksRecordSchema]).optional(),
  })
  .strict();

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    if (issue.code === "unrecognized_keys") {
      return `Unrecognized key: "${issue.keys.join('", "')}"`;
    }
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function isKebabCase(str: string): boolean {
  return KEBAB_CASE_REGEX.test(str);
}

function isValidSemver(str: string): boolean {
  return SEMVER_REGEX.test(str);
}

/**
 * Validates the directory structure of a plugin.
 *
 * Checks for the required `.claude-plugin/` directory and `plugin.json` manifest file.
 * Warns if README.md is missing (recommended but not required).
 *
 * @param pluginPath - Absolute path to the plugin root directory
 * @returns Validation result with errors for missing required structure
 */
export async function validatePluginStructure(pluginPath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(await directoryExists(pluginPath))) {
    return {
      valid: false,
      errors: [`Plugin directory does not exist: ${pluginPath}`],
      warnings: [],
    };
  }

  const pluginDir = path.join(pluginPath, PLUGIN_DIR);
  if (!(await directoryExists(pluginDir))) {
    errors.push(`Missing ${PLUGIN_DIR}/ directory`);
  }

  const manifestPath = path.join(pluginDir, PLUGIN_MANIFEST);
  if (!(await fileExists(manifestPath))) {
    errors.push(`Missing ${PLUGIN_DIR}/${PLUGIN_MANIFEST}`);
  }

  const readmePath = path.join(pluginPath, "README.md");
  if (!(await fileExists(readmePath))) {
    warnings.push("Missing README.md (recommended for documentation)");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a plugin manifest file (plugin.json) for correctness and completeness.
 *
 * Performs the following validation checks:
 * 1. File existence and readability
 * 2. Valid JSON syntax (with file size limit via readFileSafe)
 * 3. Zod schema validation (strict mode rejects unrecognized keys)
 * 4. Plugin name is kebab-case
 * 5. Version string is valid semver
 * 6. Description field is present (warning if missing)
 * 7. Skills directory path exists on disk (if specified as string)
 * 8. Agents directory path exists on disk (if specified as string)
 *
 * @param manifestPath - Absolute path to the plugin.json file
 * @returns Validation result with errors for invalid/missing data and warnings for recommendations
 */
export async function validatePluginManifest(manifestPath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(await fileExists(manifestPath))) {
    return {
      valid: false,
      errors: [`Manifest file not found: ${manifestPath}`],
      warnings: [],
    };
  }

  let manifest: Record<string, unknown>;
  try {
    const content = await readFileSafe(manifestPath, MAX_PLUGIN_FILE_SIZE);
    manifest = JSON.parse(content);
  } catch (err) {
    return {
      valid: false,
      errors: [`Invalid JSON in ${PLUGIN_MANIFEST}: ${getErrorMessage(err)}`],
      warnings: [],
    };
  }

  const result = pluginManifestValidationSchema.safeParse(manifest);

  if (!result.success) {
    errors.push(...formatZodErrors(result.error));
  }

  if (manifest.name && typeof manifest.name === "string") {
    if (!isKebabCase(manifest.name)) {
      errors.push(`name must be kebab-case: "${manifest.name}"`);
    }
  }

  if (manifest.version && typeof manifest.version === "string") {
    if (!isValidSemver(manifest.version)) {
      errors.push(
        `version "${manifest.version}" is not valid semver (expected: major.minor.patch)`,
      );
    }
  }

  if (!manifest.description) {
    warnings.push("Missing description field (recommended for discoverability)");
  }

  const pluginDir = path.dirname(path.dirname(manifestPath));

  if (manifest.skills && typeof manifest.skills === "string") {
    const skillsPath = path.join(pluginDir, manifest.skills);
    if (!(await directoryExists(skillsPath))) {
      errors.push(`Skills path does not exist: ${manifest.skills}`);
    }
  }

  if (manifest.agents && typeof manifest.agents === "string") {
    const agentsPath = path.join(pluginDir, manifest.agents);
    if (!(await directoryExists(agentsPath))) {
      errors.push(`Agents path does not exist: ${manifest.agents}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function validateSkillFrontmatter(skillPath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(await fileExists(skillPath))) {
    return {
      valid: false,
      errors: [`Skill file not found: ${skillPath}`],
      warnings: [],
    };
  }

  const content = await readFile(skillPath);
  const frontmatter = extractFrontmatter(content);

  if (frontmatter === null) {
    return {
      valid: false,
      errors: ["Missing or invalid YAML frontmatter"],
      warnings: [],
    };
  }

  const result = skillFrontmatterValidationSchema.safeParse(frontmatter);

  if (!result.success) {
    errors.push(...formatZodErrors(result.error));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function validateAgentFrontmatter(agentPath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(await fileExists(agentPath))) {
    return {
      valid: false,
      errors: [`Agent file not found: ${agentPath}`],
      warnings: [],
    };
  }

  const content = await readFile(agentPath);
  const frontmatter = extractFrontmatter(content);

  if (frontmatter === null) {
    return {
      valid: false,
      errors: ["Missing or invalid YAML frontmatter"],
      warnings: [],
    };
  }

  const result = agentFrontmatterValidationSchema.safeParse(frontmatter);

  if (!result.success) {
    errors.push(...formatZodErrors(result.error));
  }

  // Boundary cast: YAML frontmatter parsed as unknown, narrow to record for field access
  const fm = frontmatter as Record<string, unknown>;

  if (fm.name && typeof fm.name === "string") {
    if (!isKebabCase(fm.name)) {
      errors.push(`name must be kebab-case: "${fm.name}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function mergeResults(results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  const warnings = results.flatMap((r) => r.warnings);
  return { valid: errors.length === 0, errors, warnings };
}

const EMPTY_RESULT: ValidationResult = { valid: true, errors: [], warnings: [] };

function prefixResult(result: ValidationResult, prefix: string): ValidationResult {
  return {
    valid: result.valid,
    errors: result.valid ? [] : result.errors.map((e) => `${prefix}: ${e}`),
    warnings: result.warnings.map((w) => `${prefix}: ${w}`),
  };
}

async function validatePluginSkillFiles(
  pluginPath: string,
  skillsRelPath: string,
): Promise<ValidationResult> {
  const skillsDir = path.join(pluginPath, skillsRelPath);
  if (!(await directoryExists(skillsDir))) return EMPTY_RESULT;

  const files = await fg("**/SKILL.md", { cwd: skillsDir, absolute: true });
  if (files.length === 0) {
    return {
      valid: true,
      errors: [],
      warnings: [`Skills directory exists but contains no SKILL.md files: ${skillsRelPath}`],
    };
  }

  const results = await Promise.all(
    files.map(async (f) =>
      prefixResult(await validateSkillFrontmatter(f), path.relative(pluginPath, f)),
    ),
  );
  return mergeResults(results);
}

async function validatePluginAgentFiles(
  pluginPath: string,
  agentsRelPath: string,
): Promise<ValidationResult> {
  const agentsDir = path.join(pluginPath, agentsRelPath);
  if (!(await directoryExists(agentsDir))) return EMPTY_RESULT;

  const files = await fg("*.md", { cwd: agentsDir, absolute: true });
  if (files.length === 0) {
    return {
      valid: true,
      errors: [],
      warnings: [`Agents directory exists but contains no .md files: ${agentsRelPath}`],
    };
  }

  const results = await Promise.all(
    files.map(async (f) =>
      prefixResult(await validateAgentFrontmatter(f), path.relative(pluginPath, f)),
    ),
  );
  return mergeResults(results);
}

async function loadManifestForValidation(
  manifestPath: string,
): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFileSafe(manifestPath, MAX_PLUGIN_FILE_SIZE);
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Runs comprehensive validation on a plugin: structure, manifest, skill files, and agent files.
 *
 * Short-circuits on structure validation failure (no point checking manifest if
 * the directory structure is wrong). For valid structures, validates the manifest
 * and then checks all SKILL.md and agent .md files for valid frontmatter.
 *
 * @param pluginPath - Absolute path to the plugin root directory
 * @returns Merged validation result from all validation passes
 */
export async function validatePlugin(pluginPath: string): Promise<ValidationResult> {
  const structureResult = await validatePluginStructure(pluginPath);
  if (!structureResult.valid) return structureResult;

  const manifestPath = path.join(pluginPath, PLUGIN_DIR, PLUGIN_MANIFEST);
  const manifestResult = await validatePluginManifest(manifestPath);
  const manifest = await loadManifestForValidation(manifestPath);

  const skillsResult =
    manifest?.skills && typeof manifest.skills === "string"
      ? await validatePluginSkillFiles(pluginPath, manifest.skills)
      : EMPTY_RESULT;

  const agentsResult =
    manifest?.agents && typeof manifest.agents === "string"
      ? await validatePluginAgentFiles(pluginPath, manifest.agents)
      : EMPTY_RESULT;

  return mergeResults([structureResult, manifestResult, skillsResult, agentsResult]);
}

/**
 * Validates all plugins found in a directory, returning individual results and an aggregate summary.
 *
 * Scans subdirectories for `.claude-plugin/` markers to identify plugins, then validates
 * each one. Returns early with an error if the directory doesn't exist or contains no plugins.
 *
 * @param pluginsDir - Absolute path to the directory containing plugin subdirectories
 * @returns Object with overall validity, per-plugin results, and counts summary
 */
export async function validateAllPlugins(pluginsDir: string): Promise<{
  valid: boolean;
  results: Array<{ name: string; result: ValidationResult }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    withWarnings: number;
  };
}> {
  const results: Array<{ name: string; result: ValidationResult }> = [];

  if (!(await directoryExists(pluginsDir))) {
    return {
      valid: false,
      results: [
        {
          name: pluginsDir,
          result: {
            valid: false,
            errors: [`Directory does not exist: ${pluginsDir}`],
            warnings: [],
          },
        },
      ],
      summary: { total: 0, valid: 0, invalid: 1, withWarnings: 0 },
    };
  }

  const allDirs = await listDirectories(pluginsDir);
  const pluginDirs: string[] = [];

  for (const dirName of allDirs) {
    const potentialPluginDir = path.join(pluginsDir, dirName, PLUGIN_DIR);
    if (await directoryExists(potentialPluginDir)) {
      pluginDirs.push(dirName);
    }
  }

  if (pluginDirs.length === 0) {
    return {
      valid: false,
      results: [
        {
          name: pluginsDir,
          result: {
            valid: false,
            errors: [
              `No plugins found in directory: ${pluginsDir}. Plugins must contain a ${PLUGIN_DIR}/ directory.`,
            ],
            warnings: [],
          },
        },
      ],
      summary: { total: 0, valid: 0, invalid: 1, withWarnings: 0 },
    };
  }

  for (const pluginName of pluginDirs) {
    const pluginPath = path.join(pluginsDir, pluginName);
    const result = await validatePlugin(pluginPath);
    results.push({ name: pluginName, result });
  }

  const summary = {
    total: results.length,
    valid: countBy(results, (r) => String(r.result.valid))["true"] ?? 0,
    invalid: countBy(results, (r) => String(r.result.valid))["false"] ?? 0,
    withWarnings: countBy(results, (r) => String(r.result.warnings.length > 0))["true"] ?? 0,
  };

  return {
    valid: summary.invalid === 0,
    results,
    summary,
  };
}

export function printPluginValidationResult(
  name: string,
  result: ValidationResult,
  verbose = false,
): void {
  const status = result.valid ? "\u2713" : "\u2717";

  if (result.valid && result.warnings.length === 0 && !verbose) {
    return;
  }

  log(`\n  ${status} ${name}`);

  if (result.errors.length > 0) {
    log("    Errors:");
    result.errors.forEach((e) => log(`      - ${e}`));
  }

  if (result.warnings.length > 0) {
    log("    Warnings:");
    result.warnings.forEach((w) => log(`      - ${w}`));
  }
}
