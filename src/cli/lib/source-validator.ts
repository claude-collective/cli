import path from "path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { glob, readFile, fileExists, directoryExists } from "../utils/fs";
import {
  DIRS,
  SKILL_CATEGORIES_PATH,
  SKILL_RULES_PATH,
  SKILLS_DIR_PATH,
  STACKS_FILE_PATH,
  STANDARD_FILES,
} from "../consts";
import {
  agentYamlGenerationSchema,
  customMetadataValidationSchema,
  metadataValidationSchema,
  skillCategoriesFileSchema,
  skillRulesFileSchema,
  stackConfigValidationSchema,
  stacksConfigSchema,
} from "./schemas";
import { loadConfig, loadProjectSourceConfig } from "./configuration";
import { checkMatrixHealth } from "./matrix";
import { loadSkillsMatrixFromSource } from "./loading/source-loader";
import { matrix } from "./matrix/matrix-provider";
import { getErrorMessage } from "../utils/errors";

export type SourceValidationIssue = {
  severity: "error" | "warning";
  file: string;
  message: string;
};

export type SourceValidationResult = {
  issues: SourceValidationIssue[];
  skillCount: number;
  errorCount: number;
  warningCount: number;
};

/** Checks if a key uses snake_case (has underscore between lowercase letters) */
export function isSnakeCase(key: string): boolean {
  return /[a-z]_[a-z]/.test(key);
}

/**
 * Validates metadata conventions (pure function, no I/O).
 *
 * Checks:
 * - snake_case keys (should be camelCase)
 * - displayName/directory name mismatch
 */
export function validateMetadataConventions(
  rawMetadata: unknown,
  validatedMetadata: { displayName: string; category: string },
  relPath: string,
  dirName: string,
): SourceValidationIssue[] {
  const issues: SourceValidationIssue[] = [];

  // Check for snake_case keys
  if (rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata)) {
    for (const key of Object.keys(rawMetadata as Record<string, unknown>)) {
      if (isSnakeCase(key)) {
        issues.push({
          severity: "error",
          file: relPath,
          message: `Key '${key}' uses snake_case — use camelCase instead`,
        });
      }
    }
  }

  // Check displayName matches directory name
  if (validatedMetadata.displayName !== dirName) {
    issues.push({
      severity: "warning",
      file: relPath,
      message: `displayName '${validatedMetadata.displayName}' does not match directory name '${dirName}'`,
    });
  }

  return issues;
}

/**
 * Finds missing SKILL.md / metadata.yaml pairs (pure function, no I/O).
 *
 * Returns issues for:
 * - Directories with SKILL.md but no metadata.yaml
 * - Directories with metadata.yaml but no SKILL.md
 */
export function validateSkillFilePairs(
  skillMdDirs: Set<string>,
  metadataDirs: Set<string>,
  skillsDir: string,
): SourceValidationIssue[] {
  const issues: SourceValidationIssue[] = [];

  // Dirs with SKILL.md but no metadata.yaml
  for (const dir of skillMdDirs) {
    if (!metadataDirs.has(dir)) {
      issues.push({
        severity: "error",
        file: path.join(skillsDir, dir),
        message: `Missing ${STANDARD_FILES.METADATA_YAML} — skill directory has ${STANDARD_FILES.SKILL_MD} but no metadata`,
      });
    }
  }

  // Dirs with metadata.yaml but no SKILL.md
  for (const dir of metadataDirs) {
    if (!skillMdDirs.has(dir)) {
      issues.push({
        severity: "error",
        file: path.join(skillsDir, dir),
        message: `Missing ${STANDARD_FILES.SKILL_MD} — skill directory has ${STANDARD_FILES.METADATA_YAML} but no SKILL.md`,
      });
    }
  }

  return issues;
}

/**
 * Validates a skills source repository for metadata correctness.
 *
 * Checks:
 * 1. Every metadata.yaml against the strict validation schema
 * 2. displayName format and directory name consistency
 * 3. Cross-references resolve to existing skill IDs (via checkMatrixHealth)
 * 4. camelCase key convention (no snake_case)
 * 5. Every skill directory has both SKILL.md and metadata.yaml
 */
export async function validateSource(sourcePath: string): Promise<SourceValidationResult> {
  const issues: SourceValidationIssue[] = [];

  const resolvedPath = path.isAbsolute(sourcePath) ? sourcePath : path.resolve(sourcePath);

  if (!(await directoryExists(resolvedPath))) {
    issues.push({
      severity: "error",
      file: resolvedPath,
      message: "Source directory does not exist",
    });
    return buildResult(issues, 0);
  }

  const sourceProjectConfig = await loadProjectSourceConfig(resolvedPath);
  const skillsDirRelPath = sourceProjectConfig?.skillsDir ?? SKILLS_DIR_PATH;
  const skillsDir = path.join(resolvedPath, skillsDirRelPath);

  if (!(await directoryExists(skillsDir))) {
    issues.push({
      severity: "error",
      file: skillsDir,
      message: "Skills directory does not exist",
    });
    return buildResult(issues, 0);
  }

  // Phase 1: Check every skill directory has both SKILL.md and metadata.yaml
  const skillMdFiles = await glob(`**/${STANDARD_FILES.SKILL_MD}`, skillsDir);
  const metadataFiles = await glob(`**/${STANDARD_FILES.METADATA_YAML}`, skillsDir);

  const skillMdDirs = new Set(skillMdFiles.map((f) => path.dirname(f)));
  const metadataDirs = new Set(metadataFiles.map((f) => path.dirname(f)));

  issues.push(...validateSkillFilePairs(skillMdDirs, metadataDirs, skillsDir));

  // Phase 2: Validate each metadata.yaml against strict schema and conventions
  let skillCount = 0;
  for (const metadataFile of metadataFiles) {
    const metadataPath = path.join(skillsDir, metadataFile);
    const skillDir = path.dirname(metadataFile);
    const skillMdPath = path.join(skillsDir, skillDir, STANDARD_FILES.SKILL_MD);

    if (!(await fileExists(skillMdPath))) {
      // Already reported above
      continue;
    }

    skillCount++;
    const relPath = path.join(skillsDirRelPath, metadataFile);

    // Read and parse metadata.yaml
    let rawMetadata: unknown;
    try {
      const metadataContent = await readFile(metadataPath);
      rawMetadata = parseYaml(metadataContent);
    } catch (error) {
      issues.push({
        severity: "error",
        file: relPath,
        message: "Failed to parse YAML",
      });
      continue;
    }

    // Use relaxed schema for custom skills (any category/slug), strict schema for built-in skills
    const isCustom =
      rawMetadata != null &&
      typeof rawMetadata === "object" &&
      "custom" in rawMetadata &&
      (rawMetadata as Record<string, unknown>).custom === true;
    const schema = isCustom ? customMetadataValidationSchema : metadataValidationSchema;
    const result = schema.safeParse(rawMetadata);
    if (!result.success) {
      // Check for snake_case keys even on schema failure (useful diagnostics)
      issues.push(
        ...validateMetadataConventions(
          rawMetadata,
          { displayName: "", category: "" },
          relPath,
          path.basename(skillDir),
        ).filter((i) => i.message.includes("snake_case")),
      );

      for (const issue of result.error.issues) {
        const fieldPath = issue.path.join(".");
        issues.push({
          severity: "error",
          file: relPath,
          message: `${fieldPath}: ${issue.message}`,
        });
      }
      continue;
    }

    const metadata = result.data;
    const dirName = path.basename(skillDir);

    issues.push(...validateMetadataConventions(rawMetadata, metadata, relPath, dirName));
  }

  // Phase 3: Cross-reference validation via matrix health check
  try {
    await loadSkillsMatrixFromSource({ sourceFlag: resolvedPath, skipExtraSources: true });
    const healthIssues = checkMatrixHealth(matrix);

    for (const healthIssue of healthIssues) {
      issues.push({
        severity: healthIssue.severity,
        file: SKILL_CATEGORIES_PATH,
        message: healthIssue.details,
      });
    }
  } catch (error) {
    issues.push({
      severity: "warning",
      file: SKILL_CATEGORIES_PATH,
      message: `Cross-reference validation skipped: failed to load categories/rules`,
    });
  }

  // Phases 4–6: optional source-repo targets — run in parallel
  // Phase 4: stack skill metadata + stack configs
  // Phase 5: agent metadata
  // Phase 6: config/*.ts runtime exports
  const extraIssues = await Promise.all([
    validateStacks(resolvedPath),
    validateAgents(resolvedPath),
    validateConfigFiles(resolvedPath),
  ]);
  issues.push(...extraIssues.flat());

  return buildResult(issues, skillCount);
}

/**
 * Validates stack-embedded skill metadata.yaml files and stack config.yaml files.
 * Skips silently when src/stacks/ does not exist.
 */
async function validateStacks(resolvedPath: string): Promise<SourceValidationIssue[]> {
  const stacksDir = path.join(resolvedPath, DIRS.stacks);
  if (!(await directoryExists(stacksDir))) return [];

  const [skillMetaIssues, configIssues] = await Promise.all([
    validateYamlFiles({
      baseDir: stacksDir,
      relBaseDir: DIRS.stacks,
      pattern: `**/skills/**/${STANDARD_FILES.METADATA_YAML}`,
      schema: metadataValidationSchema,
    }),
    validateYamlFiles({
      baseDir: stacksDir,
      relBaseDir: DIRS.stacks,
      pattern: `*/${STANDARD_FILES.CONFIG_YAML}`,
      schema: stackConfigValidationSchema,
    }),
  ]);
  return [...skillMetaIssues, ...configIssues];
}

/**
 * Validates agent metadata.yaml files against the compiled agent output schema.
 * Skips silently when src/agents/ does not exist.
 */
async function validateAgents(resolvedPath: string): Promise<SourceValidationIssue[]> {
  const agentsDir = path.join(resolvedPath, DIRS.agents);
  if (!(await directoryExists(agentsDir))) return [];

  return validateYamlFiles({
    baseDir: agentsDir,
    relBaseDir: DIRS.agents,
    pattern: `**/${STANDARD_FILES.AGENT_METADATA_YAML}`,
    schema: agentYamlGenerationSchema,
  });
}

/**
 * Validates TypeScript config files (skill-categories.ts, skill-rules.ts, stacks.ts)
 * by runtime-loading them via loadConfig and validating the default export.
 * Skips silently when a file does not exist.
 */
async function validateConfigFiles(resolvedPath: string): Promise<SourceValidationIssue[]> {
  const results = await Promise.all([
    validateTsConfig(resolvedPath, SKILL_CATEGORIES_PATH, skillCategoriesFileSchema),
    validateTsConfig(resolvedPath, SKILL_RULES_PATH, skillRulesFileSchema),
    validateTsConfig(resolvedPath, STACKS_FILE_PATH, stacksConfigSchema),
  ]);
  return results.flat();
}

/**
 * Globs YAML files under baseDir and validates each against the given schema.
 * Reports parse errors, schema errors (as field-path messages), and uses relBaseDir
 * for display paths so issue locations match the project-relative form used elsewhere.
 */
async function validateYamlFiles(opts: {
  baseDir: string;
  relBaseDir: string;
  pattern: string;
  schema: z.ZodType<unknown>;
}): Promise<SourceValidationIssue[]> {
  const issues: SourceValidationIssue[] = [];
  const files = await glob(opts.pattern, opts.baseDir);

  for (const relFile of files) {
    const absPath = path.join(opts.baseDir, relFile);
    const displayPath = path.join(opts.relBaseDir, relFile);

    let parsed: unknown;
    try {
      parsed = parseYaml(await readFile(absPath));
    } catch {
      issues.push({ severity: "error", file: displayPath, message: "Failed to parse YAML" });
      continue;
    }

    const result = opts.schema.safeParse(parsed);
    if (result.success) continue;

    for (const issue of result.error.issues) {
      const fieldPath = issue.path.join(".");
      issues.push({
        severity: "error",
        file: displayPath,
        message: fieldPath ? `${fieldPath}: ${issue.message}` : issue.message,
      });
    }
  }
  return issues;
}

/**
 * Runtime-loads a TypeScript config file via loadConfig and reports validation failures.
 * Absent files are not errors — only report when the file exists but fails to load or validate.
 */
async function validateTsConfig(
  resolvedPath: string,
  relConfigPath: string,
  schema: z.ZodType<unknown>,
): Promise<SourceValidationIssue[]> {
  const absPath = path.join(resolvedPath, relConfigPath);
  if (!(await fileExists(absPath))) return [];

  try {
    const loaded = await loadConfig(absPath, schema);
    if (loaded === null) {
      return [{ severity: "error", file: relConfigPath, message: "Config has no default export" }];
    }
    return [];
  } catch (error) {
    return [{ severity: "error", file: relConfigPath, message: getErrorMessage(error) }];
  }
}

function buildResult(issues: SourceValidationIssue[], skillCount: number): SourceValidationResult {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  return { issues, skillCount, errorCount, warningCount };
}
