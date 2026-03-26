import path from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { fetchFromSource } from "../loading/index.js";
import { importedSkillMetadataSchema } from "../schemas.js";
import { getCurrentDate, computeFileHash } from "../versioning.js";
import {
  copy,
  fileExists,
  listDirectories,
  readFile,
  writeFile,
  ensureDir,
} from "../../utils/fs.js";
import { warn } from "../../utils/logger.js";
import {
  GITHUB_SOURCE,
  STANDARD_FILES,
  YAML_FORMATTING,
} from "../../consts.js";
import { IMPORT_DEFAULTS } from "../metadata-keys.js";

/**
 * Metadata for tracking third-party imports. Different from ForkedFromMetadata
 * in skill-metadata.ts which tracks internal fork lineage (uses skillId
 * instead of source/skillName).
 */
export type ImportedForkedFromMetadata = {
  source: string;
  skillName: string;
  contentHash: string;
  date: string;
};

type SkillMetadata = {
  forkedFrom?: ImportedForkedFromMetadata;
  [key: string]: unknown;
};

export type ParsedGitHubSource = {
  gigetSource: string;
  displaySource: string;
};

export type FetchSourceOptions = {
  gigetSource: string;
  forceRefresh?: boolean;
};

export type FetchedSource = {
  path: string;
  fromCache: boolean;
};

export type ImportSkillOptions = {
  sourcePath: string;
  destPath: string;
  skillName: string;
  displaySource: string;
};

export type ImportSkillResult = {
  imported: string[];
  skipped: string[];
  errors: Array<{ skillName: string; error: string }>;
};

/**
 * Parses various GitHub URL formats into a normalized giget source string
 * and a human-readable display URL.
 *
 * Supports: `https://github.com/owner/repo`, `github:owner/repo`,
 * `gh:owner/repo`, and bare `owner/repo` formats.
 */
export function parseGitHubSource(source: string): ParsedGitHubSource {
  if (source.startsWith(GITHUB_SOURCE.HTTPS_PREFIX)) {
    const path = source.replace(GITHUB_SOURCE.HTTPS_PREFIX, "");
    return {
      gigetSource: `${GITHUB_SOURCE.GITHUB_PREFIX}${path}`,
      displaySource: source,
    };
  }

  if (
    source.startsWith(GITHUB_SOURCE.GITHUB_PREFIX) ||
    source.startsWith(GITHUB_SOURCE.GH_PREFIX)
  ) {
    const normalized = source.startsWith(GITHUB_SOURCE.GH_PREFIX)
      ? GITHUB_SOURCE.GITHUB_PREFIX + source.slice(GITHUB_SOURCE.GH_PREFIX.length)
      : source;
    return {
      gigetSource: normalized,
      displaySource: `${GITHUB_SOURCE.HTTPS_PREFIX}${normalized.replace(GITHUB_SOURCE.GITHUB_PREFIX, "")}`,
    };
  }

  if (source.includes("/") && !source.includes(":")) {
    return {
      gigetSource: `${GITHUB_SOURCE.GITHUB_PREFIX}${source}`,
      displaySource: `${GITHUB_SOURCE.HTTPS_PREFIX}${source}`,
    };
  }

  return {
    gigetSource: source,
    displaySource: source,
  };
}

/**
 * Fetches a source repository using giget. Wraps `fetchFromSource` from the
 * loading layer.
 */
export async function fetchSkillSource(options: FetchSourceOptions): Promise<FetchedSource> {
  const result = await fetchFromSource(options.gigetSource, {
    forceRefresh: options.forceRefresh,
  });
  return { path: result.path, fromCache: result.fromCache };
}

/**
 * Discovers valid skill directories within a source path by checking
 * for the presence of SKILL.md files.
 *
 * @returns Sorted list of directory names that contain a SKILL.md file.
 */
export async function discoverValidSkills(skillsDir: string): Promise<string[]> {
  const skillDirs = await listDirectories(skillsDir);
  const validSkills: string[] = [];

  for (const skillDir of skillDirs) {
    const skillMdPath = path.join(skillsDir, skillDir, STANDARD_FILES.SKILL_MD);
    if (await fileExists(skillMdPath)) {
      validSkills.push(skillDir);
    }
  }

  return validSkills.sort();
}

/**
 * Imports a single skill from a source directory into the destination.
 *
 * Validates that the source skill has a SKILL.md file, copies the directory,
 * and injects `forkedFrom` metadata into the destination's metadata.yaml.
 *
 * @throws {Error} If the source skill is missing a SKILL.md file.
 */
export async function importSkillFromSource(options: ImportSkillOptions): Promise<void> {
  const { sourcePath, destPath, skillName, displaySource } = options;
  const skillMdPath = path.join(sourcePath, STANDARD_FILES.SKILL_MD);

  if (!(await fileExists(skillMdPath))) {
    throw new Error(
      `Missing required SKILL.md file at ${skillMdPath}\n` +
        `Every skill must have a SKILL.md file containing the skill's prompt content.\n` +
        `Create one with:\n` +
        `  echo "# ${skillName}" > ${path.join(sourcePath, STANDARD_FILES.SKILL_MD)}`,
    );
  }

  const contentHash = await computeFileHash(skillMdPath);

  await ensureDir(path.dirname(destPath));
  await copy(sourcePath, destPath);

  await injectImportedForkedFromMetadata(destPath, skillName, displaySource, contentHash);
}

/**
 * Injects `forkedFrom` metadata into a third-party imported skill's metadata.yaml.
 *
 * Handles three cases:
 * 1. Existing metadata.yaml — preserves fields, adds/overwrites forkedFrom
 * 2. Existing metadata.json — converts to YAML, adds forkedFrom
 * 3. No metadata file — creates minimal metadata.yaml with forkedFrom
 *
 * @remarks
 * Different from `injectForkedFromMetadata` in `skill-metadata.ts` which tracks
 * internal marketplace fork lineage using `skillId`. This function tracks
 * third-party imports using `source` + `skillName`.
 */
async function injectImportedForkedFromMetadata(
  destPath: string,
  skillName: string,
  source: string,
  contentHash: string,
): Promise<void> {
  const metadataYamlPath = path.join(destPath, STANDARD_FILES.METADATA_YAML);
  const metadataJsonPath = path.join(destPath, STANDARD_FILES.METADATA_JSON);

  const forkedFrom: ImportedForkedFromMetadata = {
    source,
    skillName,
    contentHash,
    date: getCurrentDate(),
  };

  if (await fileExists(metadataYamlPath)) {
    const rawContent = await readFile(metadataYamlPath);
    const lines = rawContent.split("\n");
    let yamlContent = rawContent;
    let schemaComment = "";

    if (lines[0]?.startsWith("# yaml-language-server:")) {
      schemaComment = `${lines[0]}\n`;
      yamlContent = lines.slice(1).join("\n");
    }

    const raw = parseYaml(yamlContent);
    const parseResult = importedSkillMetadataSchema.safeParse(raw);
    if (!parseResult.success) {
      warn(
        `Malformed metadata.yaml at ${metadataYamlPath} — existing fields may be lost\n` +
          `  Validation errors: ${parseResult.error.issues.map((i) => i.message).join(", ")}\n` +
          `  Expected fields: displayName (string), cliDescription (string), category (string)\n` +
          `  Validate your YAML syntax at https://yamllint.com`,
      );
    }
    const metadata = parseResult.success
      ? (parseResult.data as SkillMetadata)
      : { forkedFrom: undefined };
    metadata.forkedFrom = forkedFrom;

    const newYamlContent = stringifyYaml(metadata, {
      lineWidth: YAML_FORMATTING.LINE_WIDTH_NONE,
    });
    await writeFile(metadataYamlPath, schemaComment + newYamlContent);
    return;
  }

  if (await fileExists(metadataJsonPath)) {
    const rawContent = await readFile(metadataJsonPath);
    let jsonParsed: unknown;
    try {
      jsonParsed = JSON.parse(rawContent);
    } catch {
      warn(
        `Malformed JSON in ${metadataJsonPath} — skipping metadata injection\n` +
          `  Common issues: trailing commas, unquoted keys, single quotes instead of double quotes\n` +
          `  Validate your JSON at https://jsonlint.com`,
      );
      return;
    }
    const jsonResult = importedSkillMetadataSchema.safeParse(jsonParsed);
    const metadata = jsonResult.success
      ? (jsonResult.data as SkillMetadata)
      : { forkedFrom: undefined };
    metadata.forkedFrom = forkedFrom;

    const yamlContent = stringifyYaml(metadata, { lineWidth: YAML_FORMATTING.LINE_WIDTH_NONE });
    await writeFile(metadataYamlPath, yamlContent);
    return;
  }

  const minimalMetadata: SkillMetadata = {
    displayName: skillName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
    cliDescription: "Imported from third-party repository",
    category: IMPORT_DEFAULTS.CATEGORY,
    author: IMPORT_DEFAULTS.AUTHOR,
    forkedFrom,
  };

  const yamlContent = stringifyYaml(minimalMetadata, {
    lineWidth: YAML_FORMATTING.LINE_WIDTH_NONE,
  });
  await writeFile(metadataYamlPath, yamlContent);
}
