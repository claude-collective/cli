import { BaseCommand } from "../../base-command.js";
import {
  resolveSource,
  resolveAgentsSource,
  loadProjectSourceConfig,
  getProjectConfigPath,
  formatOrigin,
  DEFAULT_SOURCE,
  SOURCE_ENV_VAR,
} from "../../lib/configuration/index.js";

export default class ConfigShow extends BaseCommand {
  static summary = "Show current effective configuration";
  static description =
    "Display the current effective configuration with all layers (env, project, default)";

  static flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    await this.parse(ConfigShow);

    const projectDir = process.cwd();

    this.log("\nClaude Collective Configuration\n");

    const resolved = await resolveSource(undefined, projectDir);

    this.log("Source:");
    this.log(`  ${resolved.source}`);
    this.log(`  (from ${formatOrigin("source", resolved.sourceOrigin)})`);
    this.log("");

    this.log("Marketplace:");
    if (resolved.marketplace) {
      this.log(`  ${resolved.marketplace}`);
    } else {
      this.log(`  (not configured)`);
    }
    this.log("");

    const agentsResolved = await resolveAgentsSource(undefined, projectDir);
    this.log("Agents Source:");
    if (agentsResolved.agentsSource) {
      this.log(`  ${agentsResolved.agentsSource}`);
      this.log(`  (from ${formatOrigin("agents", agentsResolved.agentsSourceOrigin)})`);
    } else {
      this.log(`  (not configured - using local CLI)`);
    }
    this.log("");

    this.log("Configuration Layers:");
    this.log("");

    const envValue = process.env[SOURCE_ENV_VAR];
    this.log(`  1. Environment (${SOURCE_ENV_VAR}):`);
    if (envValue) {
      this.log(`     ${envValue}`);
    } else {
      this.log(`     (not set)`);
    }

    const projectConfig = await loadProjectSourceConfig(projectDir);
    const projectConfigPath = getProjectConfigPath(projectDir);
    this.log(`  2. Project config:`);
    this.log(`     ${projectConfigPath}`);
    if (projectConfig?.source || projectConfig?.marketplace || projectConfig?.agents_source) {
      if (projectConfig?.source) {
        this.log(`     source: ${projectConfig.source}`);
      }
      if (projectConfig?.marketplace) {
        this.log(`     marketplace: ${projectConfig.marketplace}`);
      }
      if (projectConfig?.agents_source) {
        this.log(`     agents_source: ${projectConfig.agents_source}`);
      }
    } else {
      this.log(`     (not configured)`);
    }

    this.log(`  3. Default:`);
    this.log(`     ${DEFAULT_SOURCE}`);

    this.log("");
    this.log("Precedence: flag > env > project > default");
    this.log("");
  }
}
