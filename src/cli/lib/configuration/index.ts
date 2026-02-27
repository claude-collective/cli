export {
  DEFAULT_SOURCE,
  SOURCE_ENV_VAR,
  PROJECT_CONFIG_FILE,
  type BrandingConfig,
  type SourceEntry,
  type ProjectSourceConfig,
  type ResolvedConfig,
  type ResolvedBranding,
  type AgentsSourceOrigin,
  type ResolvedAgentsSource,
  getProjectConfigPath,
  loadProjectSourceConfig,
  saveProjectConfig,
  resolveSource,
  resolveAgentsSource,
  formatOrigin,
  resolveAuthor,
  resolveBranding,
  resolveAllSources,
  isLocalSource,
  validateSourceFormat,
} from "./config";

export {
  type ProjectConfigOptions,
  generateProjectConfigFromSkills,
  buildStackProperty,
  compactStackForYaml,
  compactSkillsForYaml,
  compactDomainsForYaml,
  normalizeSkillsList,
  normalizeDomainsList,
} from "./config-generator";

export { type MergeContext, type MergeResult, mergeWithExistingConfig } from "./config-merger";

export { saveSourceToProjectConfig } from "./config-saver";

export {
  type LoadedProjectConfig,
  loadProjectConfig,
  validateProjectConfig,
} from "./project-config";

export { type SourceSummary, addSource, removeSource, getSourceSummary } from "./source-manager";
