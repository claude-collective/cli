// --- e2e/pages/constants.ts ---
// Self-contained E2E constants. NO imports from src/cli/.

export const DIRS = {
  CLAUDE: ".claude",
  CLAUDE_SRC: ".claude-src",
  SKILLS: "skills",
  AGENTS: "agents",
  PLUGINS: "plugins",
  PLUGIN_MANIFEST: "plugin-manifest",
} as const;

export const FILES = {
  CONFIG_TS: "config.ts",
  CONFIG_TYPES_TS: "config-types.ts",
  SKILL_MD: "SKILL.md",
  METADATA_YAML: "metadata.yaml",
  SETTINGS_JSON: "settings.json",
  INSTALLED_PLUGINS_JSON: "installed_plugins.json",
  IDENTITY_MD: "identity.md",
  PLAYBOOK_MD: "playbook.md",
  PLUGIN_JSON: "plugin.json",
} as const;

/** Text that identifies each wizard step. Centralized so UI changes update one place. */
export const STEP_TEXT = {
  // Step identification
  STACK: "Choose a stack",
  DOMAINS: "Select domains",
  DOMAIN_WEB: "Web",
  DOMAIN_API: "API",
  DOMAIN_META: "Methodology",
  DOMAIN_MOBILE: "Mobile",
  BUILD: "Framework", // First category visible in build step
  BUILD_CATEGORY_COUNT: " of ", // Category counter (e.g., "(1 of 1)") — unique to build step
  SOURCES: "Customize skill sources",
  AGENTS: "Select agents",
  CONFIRM: "to install",

  // Completion
  INIT_SUCCESS: "initialized successfully",
  EDIT_SUCCESS: "Plugin updated", // NOT "recompiled"
  EDIT_UNCHANGED: "Plugin unchanged",
  COMPILE_SUCCESS: "Compiled",
  EJECT_SUCCESS: "Eject complete!",
  IMPORT_SUCCESS: "Import complete:",
  UNINSTALL_SUCCESS: "Uninstall complete!",

  // Status / progress
  LOADING_SKILLS: "Loading skills",
  RECOMPILING: "Recompiling agents",
  COMPILING_STACK: "Compiling stack",
  LOADED: "Loaded",
  LOADED_LOCAL: "Loaded from local:",

  // Prompts
  CONFIRM_UPDATE: "Proceed with update?",
  CONFIRM_UNINSTALL: "Are you sure you want to uninstall",
  SEARCH: "Search Skills",

  // Dashboard
  DASHBOARD: "Agents Inc.",

  // UI elements
  FOOTER_SELECT: "select", // Footer text used for stable render detection
  START_FROM_SCRATCH: "Start from scratch",
  TOGGLE_SELECTION: "Toggle selection",
  NO_INSTALLATION: "No installation found",

  // Terminal size warnings
  TOO_NARROW: "too narrow",
  TOO_SHORT: "too short",
} as const;

export const TIMEOUTS = {
  WIZARD_LOAD: 15_000,
  INSTALL: 30_000,
  PLUGIN_INSTALL: 60_000,
  /** Combined timeout for tests that include plugin operations + exit wait */
  PLUGIN_TEST: 60_000 + 30_000, // PLUGIN_INSTALL + EXIT_WAIT
  EXIT: 10_000,
  EXIT_WAIT: 30_000,
  SETUP: 60_000,
  LIFECYCLE: 180_000,
  EXTENDED_LIFECYCLE: 300_000,
  INTERACTIVE: 120_000,
} as const;

// Internal to the framework — NOT exported to tests
export const INTERNAL_DELAYS = {
  STEP_TRANSITION: 500,
  KEYSTROKE: 150,
} as const;

export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  INVALID_ARGS: 2,
  NETWORK_ERROR: 3,
  CANCELLED: 4,
  UNKNOWN_COMMAND: 127,
} as const;

/** Paths within a skills source directory, duplicated from src/cli/consts.ts. */
export const SOURCE_PATHS = {
  SKILLS_DIR: "src/skills",
  SKILL_CATEGORIES: "config/skill-categories.ts",
  SKILL_RULES: "config/skill-rules.ts",
  STACKS_FILE: "config/stacks.ts",
  PLUGIN_MANIFEST_DIR: ".claude-plugin",
} as const;
