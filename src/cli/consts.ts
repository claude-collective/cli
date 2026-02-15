import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import type { SkillId } from "./types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// After tsup build, dist/ is flat, so we go up one level from dist/ to get CLI root
// In development (src/cli/consts.ts), we go up two levels
const isInDist = __dirname.includes("/dist");
const CLI_ROOT = isInDist ? path.resolve(__dirname, "..") : path.resolve(__dirname, "../..");
export const PROJECT_ROOT = CLI_ROOT;

export const CLAUDE_DIR = ".claude";
export const CLAUDE_SRC_DIR = ".claude-src";
export const PLUGINS_SUBDIR = "plugins";
export const PLUGIN_MANIFEST_DIR = ".claude-plugin";
export const PLUGIN_MANIFEST_FILE = "plugin.json";
export const DEFAULT_PLUGIN_NAME = "claude-collective";

export const CACHE_DIR = path.join(os.homedir(), ".cache", DEFAULT_PLUGIN_NAME);

export const SKILLS_MATRIX_PATH = "config/skills-matrix.yaml";
export const SKILLS_DIR_PATH = "src/skills";
export const LOCAL_SKILLS_PATH = ".claude/skills";
export const ARCHIVED_SKILLS_DIR_NAME = "_archived";

export const DIRS = {
  agents: "src/agents",
  skills: "src/skills",
  stacks: "src/stacks",
  templates: "src/agents/_templates",
  commands: "src/commands",
} as const;

export const STANDARD_FILES = {
  SKILL_MD: "SKILL.md",
  METADATA_YAML: "metadata.yaml",
  METADATA_JSON: "metadata.json",
  CONFIG_YAML: "config.yaml",
  SKILLS_MATRIX_YAML: "skills-matrix.yaml",
  AGENT_YAML: "agent.yaml",
  PLUGIN_JSON: "plugin.json",
  CLAUDE_MD: "CLAUDE.md",
  REFERENCE_MD: "reference.md",
  INTRO_MD: "intro.md",
  WORKFLOW_MD: "workflow.md",
  EXAMPLES_MD: "examples.md",
  OUTPUT_FORMAT_MD: "output-format.md",
  CRITICAL_REQUIREMENTS_MD: "critical-requirements.md",
  CRITICAL_REMINDERS_MD: "critical-reminders.md",
} as const;

export const STANDARD_DIRS = {
  EXAMPLES: "examples",
  SCRIPTS: "scripts",
  SKILLS: "skills",
} as const;

export const DEFAULT_VERSION = "1.0.0";

// "0.0.0" indicates no version was explicitly set
export const DEFAULT_DISPLAY_VERSION = "0.0.0";

// JSON Schema paths relative to package root (used in yaml-language-server $schema comments)
const SCHEMA_PKG_PREFIX = "node_modules/@claude-collective/cli/src/schemas";

export const SCHEMA_PATHS = {
  projectSourceConfig: `${SCHEMA_PKG_PREFIX}/project-source-config.schema.json`,
  metadata: `${SCHEMA_PKG_PREFIX}/metadata.schema.json`,
  marketplace: `${SCHEMA_PKG_PREFIX}/marketplace.schema.json`,
} as const;

/**
 * Generates a yaml-language-server schema comment for the top of YAML files.
 * The path should be relative from the YAML file's location to the schema file.
 */
export function yamlSchemaComment(schemaPath: string): string {
  return `# yaml-language-server: $schema=${schemaPath}`;
}

export const YAML_FORMATTING = {
  INDENT: 2,
  LINE_WIDTH: 120,
  /** lineWidth: 0 disables wrapping — used for metadata files */
  LINE_WIDTH_NONE: 0,
} as const;

export const UI_SYMBOLS = {
  CHECKBOX_CHECKED: "[x]",
  CHECKBOX_UNCHECKED: "[ ]",
  CHEVRON: "\u276F",
  CHEVRON_SPACER: " ",
  SELECTED: "\u2713",
  UNSELECTED: "\u25CB",
  CURRENT: "\u25CF",
  SKIPPED: "\u2013",
  DISCOURAGED: "!",
  DISABLED: "\u2013",
} as const;

export const UI_LAYOUT = {
  MAX_VISIBLE_RESULTS: 10,
  DESCRIPTION_WIDTH: 30,
  COPIED_MESSAGE_TIMEOUT_MS: 2000,
  FALLBACK_MESSAGE_TIMEOUT_MS: 3000,
} as const;

export const GITHUB_SOURCE = {
  HTTPS_PREFIX: "https://github.com/",
  GITHUB_PREFIX: "github:",
  GH_PREFIX: "gh:",
} as const;

export const DEFAULT_SKILLS_SUBDIR = "skills";

export const HASH_PREFIX_LENGTH = 7;

/** Hex chars from SHA-256 hash used in cache directory names (64 bits of collision resistance) */
export const CACHE_HASH_LENGTH = 16;

/** Max chars of human-readable prefix in cache directory names (for debugging) */
export const CACHE_READABLE_PREFIX_LENGTH = 32;

// File size limits for parsing boundaries (DoS prevention)
const ONE_MB = 1024 * 1024;
export const MAX_MARKETPLACE_FILE_SIZE = 10 * ONE_MB;
export const MAX_PLUGIN_FILE_SIZE = ONE_MB;
export const MAX_CONFIG_FILE_SIZE = ONE_MB;

// JSON/YAML structural complexity limits
export const MAX_JSON_NESTING_DEPTH = 10;
export const MAX_MARKETPLACE_PLUGINS = 10_000;

export const CLI_COLORS = {
  PRIMARY: "cyan",
  SUCCESS: "green",
  ERROR: "red",
  WARNING: "yellow",
  INFO: "blue",
  NEUTRAL: "gray",
  FOCUS: "cyan",
  UNFOCUSED: "white",
} as const;

// Foundational methodology skills preselected by default in the wizard
export const DEFAULT_PRESELECTED_SKILLS: readonly SkillId[] = [
  "meta-methodology-anti-over-engineering",
  "meta-methodology-context-management",
  "meta-methodology-improvement-protocol",
  "meta-methodology-investigation-requirements",
  "meta-methodology-success-criteria",
  "meta-methodology-write-verification",
];
