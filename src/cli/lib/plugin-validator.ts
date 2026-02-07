import Ajv, { type ValidateFunction, type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import path from "path";
import { parse as parseYaml } from "yaml";
import fg from "fast-glob";
import { fileExists, readFile, directoryExists, listDirectories } from "../utils/fs";
import { PROJECT_ROOT } from "../consts";
import type { ValidationResult } from "../../types";
import { extractFrontmatter } from "../utils/frontmatter";

const PLUGIN_DIR = ".claude-plugin";
const PLUGIN_MANIFEST = "plugin.json";
const SKILL_FILE = "SKILL.md";
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const schemaCache = new Map<string, object>();
const validatorCache = new Map<string, ValidateFunction>();

// Remote schemas hosted on GitHub (source of truth for skill schemas)
const REMOTE_SCHEMAS: Record<string, string> = {
  "skill-frontmatter.schema.json":
    "https://raw.githubusercontent.com/claude-collective/skills/main/src/schemas/skill-frontmatter.schema.json",
};

async function loadSchema(schemaName: string): Promise<object> {
  if (schemaCache.has(schemaName)) {
    return schemaCache.get(schemaName)!;
  }

  // Try local locations first for CLI-owned schemas
  const locations = [
    path.join(PROJECT_ROOT, "src", "schemas", schemaName),
    path.join(process.cwd(), "src", "schemas", schemaName),
  ];

  for (const schemaPath of locations) {
    if (await fileExists(schemaPath)) {
      const content = await readFile(schemaPath);
      const schema = JSON.parse(content);
      schemaCache.set(schemaName, schema);
      return schema;
    }
  }

  // Fall back to remote schema from GitHub (for skill schemas)
  const remoteUrl = REMOTE_SCHEMAS[schemaName];
  if (remoteUrl) {
    try {
      const response = await fetch(remoteUrl);
      if (response.ok) {
        const schema = await response.json();
        schemaCache.set(schemaName, schema);
        return schema;
      }
    } catch {
      // Fall through to error
    }
  }

  throw new Error(
    `Schema not found: ${schemaName}. Searched: ${locations.join(", ")}${remoteUrl ? ` and ${remoteUrl}` : ""}`,
  );
}

async function getValidator(schemaName: string): Promise<ValidateFunction> {
  if (validatorCache.has(schemaName)) {
    return validatorCache.get(schemaName)!;
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = await loadSchema(schemaName);
  const validate = ajv.compile(schema);
  validatorCache.set(schemaName, validate);
  return validate;
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors) return [];

  return errors.map((err) => {
    const errorPath = err.instancePath
      ? err.instancePath.replace(/^\//, "").replace(/\//g, ".")
      : "";
    const message = err.message || "Unknown error";

    if (err.keyword === "additionalProperties") {
      const prop = (err.params as { additionalProperty?: string }).additionalProperty;
      return `Unrecognized key: "${prop}"`;
    }

    if (err.keyword === "enum") {
      const allowed = (err.params as { allowedValues?: string[] }).allowedValues;
      return errorPath
        ? `${errorPath}: ${message}. Allowed: ${allowed?.join(", ")}`
        : `${message}. Allowed: ${allowed?.join(", ")}`;
    }

    if (err.keyword === "pattern") {
      let hint = "";
      if (errorPath === "name") {
        hint = " (must be kebab-case)";
      } else if (errorPath === "version") {
        hint = " (must be semver: x.y.z)";
      }
      return errorPath ? `${errorPath}: ${message}${hint}` : `${message}${hint}`;
    }

    return errorPath ? `${errorPath}: ${message}` : message;
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

  const validate = await getValidator("plugin.schema.json");
  const isValid = validate(manifest);

  if (!isValid) {
    errors.push(...formatAjvErrors(validate.errors));
  }

  if (manifest.name && typeof manifest.name === "string") {
    if (!isKebabCase(manifest.name)) {
      errors.push(`name must be kebab-case: "${manifest.name}"`);
    }
  }

  if (manifest.version && typeof manifest.version === "string") {
    if (!isValidSemver(manifest.version)) {
      warnings.push(
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

  const validate = await getValidator("skill-frontmatter.schema.json");
  const isValid = validate(frontmatter);

  if (!isValid) {
    errors.push(...formatAjvErrors(validate.errors));
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

  const validate = await getValidator("agent-frontmatter.schema.json");
  const isValid = validate(frontmatter);

  if (!isValid) {
    errors.push(...formatAjvErrors(validate.errors));
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
    valid: results.filter((r) => r.result.valid).length,
    invalid: results.filter((r) => !r.result.valid).length,
    withWarnings: results.filter((r) => r.result.warnings.length > 0).length,
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
