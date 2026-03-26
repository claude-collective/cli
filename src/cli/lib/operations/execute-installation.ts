import {
  installLocal,
  installPluginConfig,
  deriveInstallMode,
  type InstallMode,
} from "../installation/index.js";
import { copyLocalSkills } from "./copy-local-skills.js";
import { ensureMarketplace } from "./ensure-marketplace.js";
import { installPluginSkills } from "./install-plugin-skills.js";
import type { WizardResultV2 } from "../../components/wizard/wizard.js";
import type { SourceLoadResult } from "../loading/source-loader.js";
import type { ProjectConfig, AgentName } from "../../types/index.js";
import type { CopiedSkill } from "../skills/skill-copier.js";

export type ExecuteInstallationOptions = {
  wizardResult: WizardResultV2;
  sourceResult: SourceLoadResult;
  projectDir: string;
  sourceFlag?: string;
};

export type ExecuteInstallationResult = {
  mode: InstallMode;
  copiedSkills: CopiedSkill[];
  config: ProjectConfig;
  configPath: string;
  compiledAgents: AgentName[];
  wasMerged: boolean;
  mergedConfigPath?: string;
  skillsDir?: string;
  agentsDir: string;
};

/**
 * Executes the full installation pipeline.
 *
 * Derives install mode from wizard selections and branches:
 * - local: installLocal (existing proto-operation)
 * - plugin: ensureMarketplace -> installPluginSkills -> installPluginConfig
 * - mixed: copyLocalSkills -> ensureMarketplace -> installPluginSkills -> installPluginConfig
 *
 * NOTE: This operation is created for programmatic use. The init command
 * uses individual operations with per-step logging instead (see G9).
 */
export async function executeInstallation(
  options: ExecuteInstallationOptions,
): Promise<ExecuteInstallationResult> {
  const { wizardResult, sourceResult, projectDir, sourceFlag } = options;
  const installMode = deriveInstallMode(wizardResult.skills);

  if (installMode === "local") {
    const result = await installLocal({
      wizardResult,
      sourceResult,
      projectDir,
      sourceFlag,
    });
    return {
      mode: "local",
      copiedSkills: result.copiedSkills,
      config: result.config,
      configPath: result.configPath,
      compiledAgents: result.compiledAgents,
      wasMerged: result.wasMerged,
      mergedConfigPath: result.mergedConfigPath,
      skillsDir: result.skillsDir,
      agentsDir: result.agentsDir,
    };
  }

  const localSkills = wizardResult.skills.filter((s) => s.source === "local");
  let copiedSkills: CopiedSkill[] = [];

  if (installMode === "mixed" && localSkills.length > 0) {
    const copyResult = await copyLocalSkills(localSkills, projectDir, sourceResult);
    copiedSkills = [...copyResult.projectCopied, ...copyResult.globalCopied];
  }

  const mpResult = await ensureMarketplace(sourceResult);

  if (!mpResult.marketplace) {
    // Fall back to local mode if no marketplace available
    const result = await installLocal({
      wizardResult,
      sourceResult,
      projectDir,
      sourceFlag,
    });
    return {
      mode: "local",
      copiedSkills: result.copiedSkills,
      config: result.config,
      configPath: result.configPath,
      compiledAgents: result.compiledAgents,
      wasMerged: result.wasMerged,
      mergedConfigPath: result.mergedConfigPath,
      skillsDir: result.skillsDir,
      agentsDir: result.agentsDir,
    };
  }

  const pluginSkills = wizardResult.skills.filter((s) => s.source !== "local");
  await installPluginSkills(pluginSkills, mpResult.marketplace, projectDir);

  const configResult = await installPluginConfig({
    wizardResult,
    sourceResult,
    projectDir,
    sourceFlag,
  });

  return {
    mode: installMode,
    copiedSkills,
    config: configResult.config,
    configPath: configResult.configPath,
    compiledAgents: configResult.compiledAgents,
    wasMerged: configResult.wasMerged,
    mergedConfigPath: configResult.mergedConfigPath,
    agentsDir: configResult.agentsDir,
  };
}
