import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import type { SkillId, Subcategory } from "./types-matrix.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// After tsup build, dist/ is flat, so we go up one level from dist/ to get CLI root
// In development (src/cli/consts.ts), we go up two levels
const isInDist = __dirname.includes("/dist");
export const CLI_ROOT = isInDist ? path.resolve(__dirname, "..") : path.resolve(__dirname, "../..");
export const PROJECT_ROOT = CLI_ROOT;

export const OUTPUT_DIR = ".claude";
export const GITHUB_REPO = "claude-collective/skills";
export const DEFAULT_MATRIX_PATH = "src/config/skills-matrix.yaml";

export const PLUGIN_NAME = "claude-collective";

export const CLAUDE_DIR = ".claude";
export const CLAUDE_SRC_DIR = ".claude-src";
export const PLUGINS_SUBDIR = "plugins";
export const PLUGIN_MANIFEST_DIR = ".claude-plugin";
export const PLUGIN_MANIFEST_FILE = "plugin.json";

export const CACHE_DIR = path.join(os.homedir(), ".cache", "claude-collective");

export const SKILLS_MATRIX_PATH = "config/skills-matrix.yaml";
export const SKILLS_DIR_PATH = "src/skills";
export const LOCAL_SKILLS_PATH = ".claude/skills";

export const DIRS = {
  agents: "src/agents",
  skills: "src/skills",
  stacks: "src/stacks",
  templates: "src/agents/_templates",
  commands: "src/commands",
} as const;

export const DEFAULT_VERSION = "1.0.0";

/** Uses "0.0.0" to clearly indicate "no version was explicitly set" */
export const DEFAULT_DISPLAY_VERSION = "0.0.0";

/**
 * Skills that are preselected by default in the wizard.
 * These are foundational methodology skills that apply to all projects.
 *
 * Note: Skill IDs are in normalized kebab-case format (no author suffix, slashes replaced with dashes).
 */
export const DEFAULT_PRESELECTED_SKILLS: readonly SkillId[] = [
  "meta-methodology-anti-over-engineering",
  "meta-methodology-context-management",
  "meta-methodology-improvement-protocol",
  "meta-methodology-investigation-requirements",
  "meta-methodology-success-criteria",
  "meta-methodology-write-verification",
];

/**
 * Subcategories considered "key" skills that should be preloaded.
 * These are primary technology choices that define the stack's core.
 */
export const KEY_SUBCATEGORIES: ReadonlySet<Subcategory> = new Set<Subcategory>([
  "framework",
  "api",
  "database",
  "meta-framework",
  "base-framework",
  "platform",
]);
