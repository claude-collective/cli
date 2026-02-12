import { z } from "zod";
import path from "path";
import fg from "fast-glob";
import { fileExists, readFile, directoryExists, listDirectories } from "../../utils/fs";
import type { ValidationResult } from "../../types";
import { countBy } from "remeda";
import { extractFrontmatter } from "../../utils/frontmatter";
import {
  pluginAuthorSchema,
  hooksRecordSchema,
  skillFrontmatterValidationSchema,
  agentFrontmatterValidationSchema,
} from "../schemas";

const PLUGIN_DIR = ".claude-plugin";
const PLUGIN_MANIFEST = "plugin.json";
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
    const content = await readFile(manifestPath);
    manifest = JSON.parse(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      errors: [`Invalid JSON in ${PLUGIN_MANIFEST}: ${message}`],
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

export async function validatePlugin(pluginPath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const structureResult = await validatePluginStructure(pluginPath);
  errors.push(...structureResult.errors);
  warnings.push(...structureResult.warnings);

  if (!structureResult.valid) {
    return { valid: false, errors, warnings };
  }

  const manifestPath = path.join(pluginPath, PLUGIN_DIR, PLUGIN_MANIFEST);
  const manifestResult = await validatePluginManifest(manifestPath);
  errors.push(...manifestResult.errors);
  warnings.push(...manifestResult.warnings);

  let manifest: Record<string, unknown> | null = null;
  try {
    const content = await readFile(manifestPath);
    manifest = JSON.parse(content);
  } catch {}

  if (manifest) {
    if (manifest.skills && typeof manifest.skills === "string") {
      const skillsDir = path.join(pluginPath, manifest.skills);
      if (await directoryExists(skillsDir)) {
        const skillFiles = await fg("**/SKILL.md", {
          cwd: skillsDir,
          absolute: true,
        });

        if (skillFiles.length === 0) {
          warnings.push(
            `Skills directory exists but contains no SKILL.md files: ${manifest.skills}`,
          );
        }

        for (const skillFile of skillFiles) {
          const relativePath = path.relative(pluginPath, skillFile);
          const skillResult = await validateSkillFrontmatter(skillFile);

          if (!skillResult.valid) {
            errors.push(...skillResult.errors.map((e) => `${relativePath}: ${e}`));
          }
          warnings.push(...skillResult.warnings.map((w) => `${relativePath}: ${w}`));
        }
      }
    }

    if (manifest.agents && typeof manifest.agents === "string") {
      const agentsDir = path.join(pluginPath, manifest.agents);
      if (await directoryExists(agentsDir)) {
        const agentFiles = await fg("*.md", {
          cwd: agentsDir,
          absolute: true,
        });

        if (agentFiles.length === 0) {
          warnings.push(`Agents directory exists but contains no .md files: ${manifest.agents}`);
        }

        for (const agentFile of agentFiles) {
          const relativePath = path.relative(pluginPath, agentFile);
          const agentResult = await validateAgentFrontmatter(agentFile);

          if (!agentResult.valid) {
            errors.push(...agentResult.errors.map((e) => `${relativePath}: ${e}`));
          }
          warnings.push(...agentResult.warnings.map((w) => `${relativePath}: ${w}`));
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

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

  console.log(`\n  ${status} ${name}`);

  if (result.errors.length > 0) {
    console.log("    Errors:");
    result.errors.forEach((e) => console.log(`      - ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log("    Warnings:");
    result.warnings.forEach((w) => console.log(`      - ${w}`));
  }
}
