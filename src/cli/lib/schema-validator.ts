import { sumBy } from "remeda";
import { z } from "zod";
import path from "path";
import { getErrorMessage } from "../utils/errors";
import { readFile, fileExists } from "../utils/fs";
import { parse as parseYaml } from "yaml";
import fg from "fast-glob";
import { extractFrontmatter } from "../utils/frontmatter";
import { log } from "../utils/logger";
import {
  skillsMatrixConfigSchema,
  metadataValidationSchema,
  stackConfigValidationSchema,
  skillFrontmatterValidationSchema,
  agentFrontmatterValidationSchema,
  agentYamlGenerationSchema,
  stacksConfigSchema,
  projectSourceConfigSchema,
  pluginManifestSchema,
} from "./schemas";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../consts";

type FileValidationError = {
  file: string;
  errors: string[];
};

type SchemaValidationResult = {
  schemaName: string;
  valid: boolean;
  totalFiles: number;
  validFiles: number;
  invalidFiles: FileValidationError[];
};

export type FullValidationResult = {
  valid: boolean;
  results: SchemaValidationResult[];
  summary: {
    totalSchemas: number;
    totalFiles: number;
    validFiles: number;
    invalidFiles: number;
  };
};

type ContentExtractor = (content: string) => unknown | null;

type ValidationTarget = {
  name: string;
  schema: z.ZodType<unknown>;
  pattern: string;
  baseDir: string;
  extractor?: ContentExtractor;
};

const VALIDATION_TARGETS: ValidationTarget[] = [
  {
    name: "Skills Matrix",
    schema: skillsMatrixConfigSchema,
    pattern: STANDARD_FILES.SKILLS_MATRIX_YAML,
    baseDir: "src/config",
  },
  {
    name: "Skill Metadata",
    schema: metadataValidationSchema,
    pattern: `**/${STANDARD_FILES.METADATA_YAML}`,
    baseDir: "src/skills",
  },
  {
    name: "Stack Skill Metadata",
    schema: metadataValidationSchema,
    pattern: `**/skills/**/${STANDARD_FILES.METADATA_YAML}`,
    baseDir: "src/stacks",
  },
  {
    name: "Stack Config",
    schema: stackConfigValidationSchema,
    pattern: `*/${STANDARD_FILES.CONFIG_YAML}`,
    baseDir: "src/stacks",
  },
  {
    name: "Agent Definition",
    schema: agentYamlGenerationSchema,
    pattern: `**/${STANDARD_FILES.AGENT_YAML}`,
    baseDir: "src/agents",
  },
  {
    name: "Skill Frontmatter",
    schema: skillFrontmatterValidationSchema,
    pattern: `**/${STANDARD_FILES.SKILL_MD}`,
    baseDir: "src/skills",
    extractor: extractFrontmatter,
  },
  {
    name: "Stack Skill Frontmatter",
    schema: skillFrontmatterValidationSchema,
    pattern: `**/skills/**/${STANDARD_FILES.SKILL_MD}`,
    baseDir: "src/stacks",
    extractor: extractFrontmatter,
  },
  {
    name: "Stacks Config",
    schema: stacksConfigSchema,
    pattern: "stacks.yaml",
    baseDir: "config",
  },
  {
    name: "Project Source Config",
    schema: projectSourceConfigSchema,
    pattern: STANDARD_FILES.CONFIG_YAML,
    baseDir: CLAUDE_SRC_DIR,
  },
  {
    name: "Project Skill Metadata",
    schema: metadataValidationSchema,
    pattern: `*/${STANDARD_FILES.METADATA_YAML}`,
    baseDir: `${CLAUDE_DIR}/skills`,
  },
  {
    name: "Project Skill Frontmatter",
    schema: skillFrontmatterValidationSchema,
    pattern: `*/${STANDARD_FILES.SKILL_MD}`,
    baseDir: `${CLAUDE_DIR}/skills`,
    extractor: extractFrontmatter,
  },
  {
    name: "Project Agent Frontmatter",
    schema: agentFrontmatterValidationSchema,
    pattern: "*.md",
    baseDir: `${CLAUDE_DIR}/agents`,
    extractor: extractFrontmatter,
  },
  {
    name: "Plugin Manifest",
    schema: pluginManifestSchema,
    pattern: `*/${STANDARD_FILES.PLUGIN_JSON}`,
    baseDir: `${CLAUDE_DIR}/plugins`,
    extractor: (content: string) => JSON.parse(content) as unknown,
  },
];

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    if (issue.code === "unrecognized_keys") {
      return `Unrecognized key: "${issue.keys.join('", "')}"`;
    }
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

async function validateFile(
  filePath: string,
  schema: z.ZodType<unknown>,
  extractor?: ContentExtractor,
): Promise<{ valid: boolean; errors: string[] }> {
  try {
    if (!(await fileExists(filePath))) {
      return { valid: false, errors: [`File not found: ${filePath}`] };
    }

    const content = await readFile(filePath);

    let parsed: unknown;
    if (extractor) {
      parsed = extractor(content);
      if (parsed === null) {
        return {
          valid: false,
          errors: ["Failed to extract content (no valid frontmatter found)"],
        };
      }
    } else {
      parsed = parseYaml(content);
    }

    const result = schema.safeParse(parsed);

    if (result.success) {
      return { valid: true, errors: [] };
    }

    return { valid: false, errors: formatZodErrors(result.error) };
  } catch (error) {
    const message = getErrorMessage(error);
    return { valid: false, errors: [`Failed to parse content: ${message}`] };
  }
}

async function validateTarget(
  target: ValidationTarget,
  rootDir: string = process.cwd(),
): Promise<SchemaValidationResult> {
  const baseDir = path.join(rootDir, target.baseDir);
  const pattern = path.join(baseDir, target.pattern);
  const files = await fg(pattern, { absolute: true });

  const result: SchemaValidationResult = {
    schemaName: target.name,
    valid: true,
    totalFiles: files.length,
    validFiles: 0,
    invalidFiles: [],
  };

  if (files.length === 0) {
    return result;
  }

  for (const file of files) {
    const validation = await validateFile(file, target.schema, target.extractor);
    const relativePath = path.relative(rootDir, file);

    if (validation.valid) {
      result.validFiles++;
    } else {
      result.valid = false;
      result.invalidFiles.push({
        file: relativePath,
        errors: validation.errors,
      });
    }
  }

  return result;
}

export async function validateAllSchemas(
  rootDir: string = process.cwd(),
): Promise<FullValidationResult> {
  const results: SchemaValidationResult[] = [];

  for (const target of VALIDATION_TARGETS) {
    const result = await validateTarget(target, rootDir);
    results.push(result);
  }

  const summary = {
    totalSchemas: results.length,
    totalFiles: sumBy(results, (r) => r.totalFiles),
    validFiles: sumBy(results, (r) => r.validFiles),
    invalidFiles: sumBy(results, (r) => r.invalidFiles.length),
  };

  return {
    valid: results.every((r) => r.valid),
    results,
    summary,
  };
}

export function printValidationResults(result: FullValidationResult): void {
  log("\n  Schema Validation Summary:");
  log("  ─────────────────────────");
  log(`  Total schemas checked: ${result.summary.totalSchemas}`);
  log(`  Total files: ${result.summary.totalFiles}`);
  log(`  Valid: ${result.summary.validFiles}`);
  log(`  Invalid: ${result.summary.invalidFiles}`);

  for (const schemaResult of result.results) {
    if (schemaResult.totalFiles === 0) continue;

    const status = schemaResult.valid ? "✓" : "✗";
    log(
      `\n  ${status} ${schemaResult.schemaName}: ${schemaResult.validFiles}/${schemaResult.totalFiles} valid`,
    );

    if (schemaResult.invalidFiles.length > 0) {
      for (const file of schemaResult.invalidFiles) {
        log(`\n    ${file.file}:`);
        file.errors.forEach((e) => log(`      - ${e}`));
      }
    }
  }

  if (result.valid) {
    log("\n  ✓ All schemas validated successfully\n");
  } else {
    log("\n  ✗ Validation failed\n");
  }
}
