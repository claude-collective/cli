import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CLI_ROOT = path.resolve(__dirname, "..");
export const PROJECT_ROOT = path.resolve(__dirname, "../..");

export const OUTPUT_DIR = ".claude";
export const GITHUB_REPO = "claude-collective/claude-collective";
export const DEFAULT_MATRIX_PATH = "src/config/skills-matrix.yaml";

export const PLUGIN_NAME = "claude-collective";

export const CLAUDE_DIR = ".claude";
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
