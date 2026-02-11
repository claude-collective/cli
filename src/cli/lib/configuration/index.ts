export {
  DEFAULT_SOURCE,
  SOURCE_ENV_VAR,
  PROJECT_CONFIG_FILE,
  type SourceEntry,
  type ProjectSourceConfig,
  type ResolvedConfig,
  type AgentsSourceOrigin,
  type ResolvedAgentsSource,
  getProjectConfigPath,
  loadProjectSourceConfig,
  saveProjectConfig,
  resolveSource,
  resolveAgentsSource,
  formatOrigin,
  resolveAuthor,
  resolveAllSources,
  isLocalSource,
} from "./config";

export {
  type ProjectConfigOptions,
  generateProjectConfigFromSkills,
  buildStackProperty,
} from "./config-generator";

export { type MergeContext, type MergeResult, mergeWithExistingConfig } from "./config-merger";

export { saveSourceToProjectConfig } from "./config-saver";

export {
  type LoadedProjectConfig,
  loadProjectConfig,
  validateProjectConfig,
} from "./project-config";
