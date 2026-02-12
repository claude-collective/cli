export { type FetchSkillsOptions, fetchSkills } from "./skill-fetcher";

export {
  type ForkedFromMetadata,
  type LocalSkillMetadata,
  type SkillComparisonResult,
  readForkedFromMetadata,
  getLocalSkillsWithMetadata,
  computeSourceHash,
  compareSkills,
  injectForkedFromMetadata,
} from "./skill-metadata";

export {
  type CopiedSkill,
  copySkill,
  copySkillFromSource,
  copySkillsToPluginFromSource,
  copySkillsToLocalFlattened,
} from "./skill-copier";

export { SKILL_TO_AGENTS, getAgentsForSkill } from "./skill-agent-mappings";

export {
  type SkillPluginOptions,
  type CompiledSkillPlugin,
  compileSkillPlugin,
  compileAllSkillPlugins,
  printCompilationSummary,
} from "./skill-plugin-compiler";

export { type LocalSkillDiscoveryResult, discoverLocalSkills } from "./local-skill-loader";

export { archiveLocalSkill, restoreArchivedSkill, hasArchivedSkill } from "./source-switcher";
