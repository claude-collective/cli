import { DEFAULT_BRANDING } from "../consts.js";

export const ERROR_MESSAGES = {
  UNKNOWN_ERROR: "Unknown error occurred",
  UNKNOWN_ERROR_SHORT: "Unknown error",
  NO_INSTALLATION: `No installation found. Run 'cc init' first to set up ${DEFAULT_BRANDING.NAME}`,
  NO_LOCAL_SKILLS: "No local skills found. Run `cc init` or `cc edit` first.",
  NO_SKILLS_FOUND: "No skills found",
  VALIDATION_FAILED: "Validation failed",
  FAILED_RESOLVE_SOURCE: "Failed to resolve source",
  FAILED_LOAD_AGENT_PARTIALS: "Failed to load agent partials",
  FAILED_COMPILE_AGENTS: "Failed to compile agents",
  SKILL_NOT_FOUND: "Skill not found",
} as const;

export const SUCCESS_MESSAGES = {
  IMPORT_COMPLETE: "Import complete!",
  UNINSTALL_COMPLETE: "Uninstall complete!",
  INIT_SUCCESS: `${DEFAULT_BRANDING.NAME} initialized successfully!`,
  PLUGIN_COMPILE_COMPLETE: "Plugin compile complete!",
  CUSTOM_COMPILE_COMPLETE: "Custom output compile complete!",
  ALL_SKILLS_UP_TO_DATE: "All skills are up to date.",
} as const;

export const STATUS_MESSAGES = {
  LOADING_SKILLS: "Loading skills...",
  LOADING_MARKETPLACE_SOURCE: "Loading marketplace source...",
  RECOMPILING_AGENTS: "Recompiling agents...",
  COMPILING_AGENTS: "Compiling agents...",
  DISCOVERING_SKILLS: "Discovering skills...",
  RESOLVING_SOURCE: "Resolving source...",
  RESOLVING_MARKETPLACE_SOURCE: "Resolving marketplace source...",
  FETCHING_AGENT_PARTIALS: "Fetching agent partials...",
  LOADING_AGENT_PARTIALS: "Loading agent partials...",
  FETCHING_REPOSITORY: "Fetching repository...",
  COPYING_SKILLS: "Copying skills...",
  UPDATING_PLUGIN_SKILLS: "Updating plugin skills...",
} as const;

export const INFO_MESSAGES = {
  NO_CHANGES_MADE: "No changes made.",
  RUN_COMPILE: "Run 'cc compile' to include imported skills in your agents.",
  NO_AGENTS_TO_RECOMPILE: "No agents to recompile",
  NO_AGENTS_TO_COMPILE: "No agents to compile",
  NO_PLUGIN_INSTALLATION: "No plugin installation found.",
  NO_LOCAL_INSTALLATION: "No local installation found.",
  NOT_INSTALLED: `${DEFAULT_BRANDING.NAME} is not installed in this project.`,
} as const;

export const DRY_RUN_MESSAGES = {
  PREVIEW_NO_FILES_REMOVED: "[dry-run] Preview mode - no files will be removed",
  PREVIEW_NO_FILES_CREATED: "[dry-run] Preview mode - no files will be created",
  COMPLETE_NO_FILES_REMOVED: "[dry-run] Preview complete - no files were removed",
  COMPLETE_NO_FILES_WRITTEN: "[dry-run] Preview complete - no files were written",
  COMPLETE_NO_FILES_CREATED: "[dry-run] Preview complete - no files were created",
} as const;
