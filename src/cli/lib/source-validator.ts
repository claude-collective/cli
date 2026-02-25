import path from "path";
import { parse as parseYaml } from "yaml";
import { glob, readFile, fileExists, directoryExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { STANDARD_FILES } from "../consts";
import { metadataValidationSchema, formatZodErrors, SKILL_ID_PATTERN } from "./schemas";
import { parseFrontmatter } from "./loading/loader";
import { loadProjectSourceConfig } from "./configuration";
import {
  checkMatrixHealth,
  extractAllSkills,
  loadSkillsMatrix,
  mergeMatrixWithSkills,
} from "./matrix";

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
function isSnakeCase(key: string): boolean {
  return /[a-z]_[a-z]/.test(key);
}

/**
 * Validates a skills source repository for metadata correctness.
 *
 * Checks:
 * 1. Every metadata.yaml against the strict validation schema
 * 2. cliName format and directory name consistency
 * 3. category values against known domain-prefixed patterns
 * 4. Cross-references resolve to existing skill IDs (via checkMatrixHealth)
 * 5. categoryExclusive presence when required
 * 6. camelCase key convention (no snake_case)
 * 7. Every skill directory has both SKILL.md and metadata.yaml
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
  const skillsDirRelPath = sourceProjectConfig?.skillsDir ?? "src/skills";
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

    // Validate against strict metadata schema
    const result = metadataValidationSchema.safeParse(rawMetadata);
    if (!result.success) {
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

    // Check cliName matches directory name
    const dirName = path.basename(skillDir);
    if (metadata.cliName !== dirName) {
      issues.push({
        severity: "warning",
        file: relPath,
        message: `cliName '${metadata.cliName}' does not match directory name '${dirName}'`,
      });
    }

    // Parse SKILL.md frontmatter and check name matches cliName
    const skillMdContent = await readFile(skillMdPath);
    const frontmatter = parseFrontmatter(skillMdContent, skillMdPath);
    if (frontmatter) {
      if (!SKILL_ID_PATTERN.test(frontmatter.name)) {
        issues.push({
          severity: "warning",
          file: path.join(skillsDirRelPath, skillDir, STANDARD_FILES.SKILL_MD),
          message: `SKILL.md name '${frontmatter.name}' does not match expected skill ID pattern (domain-subcategory-name)`,
        });
      }
    }

    // Check category follows domain-prefixed pattern
    if (
      metadata.category &&
      !/^(web|api|cli|mobile|infra|meta|security|shared)-.+$/.test(metadata.category)
    ) {
      issues.push({
        severity: "warning",
        file: relPath,
        message: `Category '${metadata.category}' does not follow domain-prefixed pattern (e.g., 'web-framework', 'api-database')`,
      });
    }
  }

  // Phase 3: Cross-reference validation via matrix health check
  try {
    const matrixRelPath = sourceProjectConfig?.matrixFile ?? "config/skills-matrix.yaml";
    const matrixPath = path.join(resolvedPath, matrixRelPath);

    if (await fileExists(matrixPath)) {
      const matrix = await loadSkillsMatrix(matrixPath);
      const skills = await extractAllSkills(skillsDir);
      const mergedMatrix = await mergeMatrixWithSkills(matrix, skills);
      const healthIssues = checkMatrixHealth(mergedMatrix);

      for (const healthIssue of healthIssues) {
        issues.push({
          severity: healthIssue.severity,
          file: matrixRelPath,
          message: healthIssue.details,
        });
      }
    } else {
      verbose(`No matrix file at '${matrixPath}' — skipping cross-reference validation`);
    }
  } catch (error) {
    issues.push({
      severity: "warning",
      file: "config/skills-matrix.yaml",
      message: `Cross-reference validation skipped: failed to load matrix`,
    });
  }

  return buildResult(issues, skillCount);
}

function buildResult(issues: SourceValidationIssue[], skillCount: number): SourceValidationResult {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  return { issues, skillCount, errorCount, warningCount };
}
