import { STANDARD_FILES, STANDARD_DIRS } from "../consts";
import type { CategoryPath } from "../types";

/**
 * YAML field names used in skill metadata.yaml files.
 * Centralized to avoid string duplication across loaders and compilers.
 */
export const METADATA_KEYS = {
  CLI_NAME: "cli_name",
  CLI_DESCRIPTION: "cli_description",
  CATEGORY: "category",
  FORKED_FROM: "forked_from",
  CONTENT_HASH: "content_hash",
  USAGE_GUIDANCE: "usage_guidance",
} as const;

/**
 * Default values used when importing third-party skills (no existing metadata).
 */
export const IMPORT_DEFAULTS = {
  CATEGORY: "imported" as CategoryPath,
  AUTHOR: "@imported",
} as const;

/**
 * Default values used for local skills (created via `agentsinc new skill` or discovered locally).
 */
export const LOCAL_DEFAULTS = {
  CATEGORY: "local" as CategoryPath,
  AUTHOR: "@local",
} as const;

/**
 * Files included when computing a skill's content hash.
 * Shared by versioning.ts (for metadata version bumps) and
 * skill-plugin-compiler.ts (for plugin compilation).
 */
export const SKILL_CONTENT_FILES = [STANDARD_FILES.SKILL_MD, STANDARD_FILES.REFERENCE_MD] as const;

/**
 * Directories included when computing a skill's content hash.
 * Shared by versioning.ts and skill-plugin-compiler.ts.
 */
export const SKILL_CONTENT_DIRS = [STANDARD_DIRS.EXAMPLES, STANDARD_DIRS.SCRIPTS] as const;
