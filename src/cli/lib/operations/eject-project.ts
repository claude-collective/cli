import path from "path";
import {
  copy,
  ensureDir,
  directoryExists,
  fileExists,
  listDirectories,
  writeFile,
} from "../../utils/fs.js";
import {
  CLAUDE_SRC_DIR,
  DIRS,
  LOCAL_SKILLS_PATH,
  PROJECT_ROOT,
  STANDARD_FILES,
} from "../../consts.js";
import { copySkillsToLocalFlattened, type CopiedSkill } from "../skills/index.js";
import { resolveSource, loadProjectSourceConfig } from "../configuration/index.js";
import type { SourceLoadResult } from "../loading/index.js";
import type { MergedSkillsMatrix, SkillId } from "../../types/index.js";
import { typedKeys } from "../../utils/typed-object.js";

// ---------------------------------------------------------------------------
// ejectAgentPartials
// ---------------------------------------------------------------------------

export type EjectAgentPartialsOptions = {
  outputBase: string;
  force: boolean;
  /** When true, outputBase is used directly as the destination (no subdirectory nesting). */
  directOutput?: boolean;
  /** When true, ejects only the _templates directory instead of the full agents directory. */
  templatesOnly?: boolean;
};

export type EjectAgentPartialsResult = {
  /** Whether the operation was skipped (e.g. destination already exists without --force). */
  skipped: boolean;
  /** Human-readable reason when skipped. */
  skipReason?: string;
  /** Destination directory that was written to (undefined when skipped). */
  destDir?: string;
  /** Whether templates were skipped during a full agent-partials eject (existing templates preserved). */
  templatesSkipped: boolean;
};

/**
 * Copies agent partials or templates from the CLI source to a target directory.
 *
 * When `templatesOnly` is true, copies only the _templates subdirectory.
 * When false, copies the full agents directory (optionally skipping existing templates).
 *
 * Returns structured data — the command decides what to log.
 */
export async function ejectAgentPartials(
  options: EjectAgentPartialsOptions,
): Promise<EjectAgentPartialsResult> {
  const { outputBase, force, directOutput = false, templatesOnly = false } = options;

  const sourceDir = templatesOnly
    ? path.join(PROJECT_ROOT, DIRS.templates)
    : path.join(PROJECT_ROOT, DIRS.agents);

  if (!(await directoryExists(sourceDir))) {
    return {
      skipped: true,
      skipReason: templatesOnly
        ? "No agent templates found in CLI."
        : "No agent partials found in CLI.",
      templatesSkipped: false,
    };
  }

  const destDir = directOutput
    ? outputBase
    : templatesOnly
      ? path.join(outputBase, path.basename(DIRS.agents), path.basename(DIRS.templates))
      : path.join(outputBase, path.basename(DIRS.agents));

  const templatesBasename = path.basename(DIRS.templates);

  if ((await directoryExists(destDir)) && !force) {
    if (templatesOnly) {
      return {
        skipped: true,
        skipReason: `Agent templates already exist at ${destDir}. Use --force to overwrite.`,
        templatesSkipped: false,
      };
    }

    const hasTemplates = await directoryExists(path.join(destDir, templatesBasename));
    if ((await hasAgentPartialDirs(destDir)) && !hasTemplates) {
      return {
        skipped: true,
        skipReason: `Agent partials already exist at ${destDir}. Use --force to overwrite.`,
        templatesSkipped: false,
      };
    }
  }

  await ensureDir(destDir);

  const skipTemplates =
    !templatesOnly && !force && (await directoryExists(path.join(destDir, templatesBasename)));

  if (skipTemplates) {
    const sourceEntries = await listDirectories(sourceDir);
    const nonTemplateEntries = sourceEntries.filter((entry) => entry !== templatesBasename);
    for (const entry of nonTemplateEntries) {
      await copy(path.join(sourceDir, entry), path.join(destDir, entry));
    }
  } else {
    await copy(sourceDir, destDir);
  }

  return {
    skipped: false,
    destDir,
    templatesSkipped: skipTemplates,
  };
}

// ---------------------------------------------------------------------------
// ejectSkills
// ---------------------------------------------------------------------------

export type EjectSkillsOptions = {
  projectDir: string;
  force: boolean;
  sourceResult: SourceLoadResult;
  matrix: MergedSkillsMatrix;
  /** When true, uses customOutputBase as destination instead of LOCAL_SKILLS_PATH. */
  directOutput?: boolean;
  customOutputBase?: string;
};

export type EjectSkillsResult = {
  /** Whether the operation was skipped. */
  skipped: boolean;
  /** Human-readable reason when skipped. */
  skipReason?: string;
  /** Array of skills that were copied. */
  copiedSkills: CopiedSkill[];
  /** Destination directory that was written to. */
  destDir?: string;
  /** Label describing the source that skills were copied from. */
  sourceLabel?: string;
};

/**
 * Copies non-local skills from source to a target directory.
 *
 * Filters out skills already marked as local, then copies the remaining skills
 * using copySkillsToLocalFlattened.
 *
 * Returns structured data — the command decides what to log.
 */
export async function ejectSkills(options: EjectSkillsOptions): Promise<EjectSkillsResult> {
  const {
    projectDir,
    force,
    sourceResult,
    matrix,
    directOutput = false,
    customOutputBase,
  } = options;

  const destDir =
    directOutput && customOutputBase ? customOutputBase : path.join(projectDir, LOCAL_SKILLS_PATH);

  if ((await directoryExists(destDir)) && !force) {
    return {
      skipped: true,
      skipReason: `Skills already exist at ${destDir}. Use --force to overwrite.`,
      copiedSkills: [],
    };
  }

  const skillIds = typedKeys<SkillId>(matrix.skills).filter(
    (skillId) => !matrix.skills[skillId]?.local,
  );

  if (skillIds.length === 0) {
    return {
      skipped: true,
      skipReason: "No skills found in source to eject.",
      copiedSkills: [],
    };
  }

  await ensureDir(destDir);

  const copiedSkills = await copySkillsToLocalFlattened(skillIds, destDir, matrix, sourceResult);

  const sourceLabel = sourceResult.isLocal
    ? sourceResult.sourcePath
    : sourceResult.marketplace || sourceResult.sourceConfig.source;

  return {
    skipped: false,
    copiedSkills,
    destDir,
    sourceLabel,
  };
}

// ---------------------------------------------------------------------------
// ensureMinimalConfig
// ---------------------------------------------------------------------------

export type EnsureMinimalConfigOptions = {
  projectDir: string;
  sourceFlag?: string;
  sourceResult?: SourceLoadResult;
};

export type EnsureMinimalConfigResult = {
  /** Path to the config file. */
  configPath: string;
  /** Whether a new config was created. */
  created: boolean;
};

/**
 * Ensures a minimal config.ts exists so `agentsinc compile` works after eject.
 *
 * If the config already exists, returns immediately with `created: false`.
 * Otherwise generates a minimal config from the resolved source and project metadata.
 *
 * Returns structured data — the command decides what to log.
 */
export async function ensureMinimalConfig(
  options: EnsureMinimalConfigOptions,
): Promise<EnsureMinimalConfigResult> {
  const { projectDir, sourceFlag, sourceResult } = options;

  const tsConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);

  if (await fileExists(tsConfigPath)) {
    return { configPath: tsConfigPath, created: false };
  }

  const projectName = path.basename(projectDir);

  const config: Record<string, unknown> = {
    name: projectName,
  };

  const resolvedConfig =
    sourceResult?.sourceConfig ?? (await resolveSource(sourceFlag, projectDir));

  if (sourceFlag) {
    config.source = sourceFlag;
  } else if (resolvedConfig.source) {
    config.source = resolvedConfig.source;
  }

  if (resolvedConfig.marketplace) {
    config.marketplace = resolvedConfig.marketplace;
  }

  const existingProjectConfig = await loadProjectSourceConfig(projectDir);
  if (existingProjectConfig?.author) {
    config.author = existingProjectConfig.author;
  }
  if (existingProjectConfig?.agentsSource) {
    config.agentsSource = existingProjectConfig.agentsSource;
  }

  await ensureDir(path.join(projectDir, CLAUDE_SRC_DIR));

  // JSON.parse(JSON.stringify(x)) removes undefined values
  const cleaned = JSON.parse(JSON.stringify(config));
  const body = JSON.stringify(cleaned, null, 2);
  const content = `export default ${body};\n`;

  await writeFile(tsConfigPath, content);

  return { configPath: tsConfigPath, created: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Checks whether the agents directory contains any agent subdirectories (not just _templates). */
async function hasAgentPartialDirs(agentsDir: string): Promise<boolean> {
  const subdirs = await listDirectories(agentsDir);
  const templatesBasename = path.basename(DIRS.templates);
  return subdirs.some((dir) => dir !== templatesBasename);
}
