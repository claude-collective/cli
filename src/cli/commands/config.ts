import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  resolveSource,
  resolveAgentsSource,
  loadGlobalConfig,
  saveGlobalConfig,
  loadProjectConfig,
  saveProjectConfig,
  getGlobalConfigPath,
  getProjectConfigPath,
  formatSourceOrigin,
  formatAgentsSourceOrigin,
  DEFAULT_SOURCE,
  SOURCE_ENV_VAR,
  type GlobalConfig,
  type ProjectConfig,
} from "../lib/config";
import { EXIT_CODES } from "../lib/exit-codes";

export const configCommand = new Command("config")
  .description("Manage Claude Collective configuration")
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true);

configCommand
  .command("show")
  .description("Show current effective configuration")
  .action(async () => {
    const projectDir = process.cwd();

    console.log(pc.cyan("\nClaude Collective Configuration\n"));

    const resolved = await resolveSource(undefined, projectDir);

    console.log(pc.bold("Source:"));
    console.log(`  ${pc.green(resolved.source)}`);
    console.log(
      `  ${pc.dim(`(from ${formatSourceOrigin(resolved.sourceOrigin)})`)}`,
    );
    console.log("");

    console.log(pc.bold("Marketplace:"));
    if (resolved.marketplace) {
      console.log(`  ${pc.green(resolved.marketplace)}`);
    } else {
      console.log(`  ${pc.dim("(not configured)")}`);
    }
    console.log("");

    const agentsResolved = await resolveAgentsSource(undefined, projectDir);
    console.log(pc.bold("Agents Source:"));
    if (agentsResolved.agentsSource) {
      console.log(`  ${pc.green(agentsResolved.agentsSource)}`);
      console.log(
        `  ${pc.dim(`(from ${formatAgentsSourceOrigin(agentsResolved.agentsSourceOrigin)})`)}`,
      );
    } else {
      console.log(`  ${pc.dim("(not configured - using local CLI)")}`);
    }
    console.log("");

    console.log(pc.bold("Configuration Layers:"));
    console.log("");

    const envValue = process.env[SOURCE_ENV_VAR];
    console.log(`  ${pc.dim("1.")} Environment (${SOURCE_ENV_VAR}):`);
    if (envValue) {
      console.log(`     ${pc.green(envValue)}`);
    } else {
      console.log(`     ${pc.dim("(not set)")}`);
    }

    const projectConfig = await loadProjectConfig(projectDir);
    const projectConfigPath = getProjectConfigPath(projectDir);
    console.log(`  ${pc.dim("2.")} Project config:`);
    console.log(`     ${pc.dim(projectConfigPath)}`);
    if (
      projectConfig?.source ||
      projectConfig?.marketplace ||
      projectConfig?.agents_source
    ) {
      if (projectConfig?.source) {
        console.log(`     source: ${pc.green(projectConfig.source)}`);
      }
      if (projectConfig?.marketplace) {
        console.log(`     marketplace: ${pc.green(projectConfig.marketplace)}`);
      }
      if (projectConfig?.agents_source) {
        console.log(
          `     agents_source: ${pc.green(projectConfig.agents_source)}`,
        );
      }
    } else {
      console.log(`     ${pc.dim("(not configured)")}`);
    }

    const globalConfig = await loadGlobalConfig();
    const globalConfigPath = getGlobalConfigPath();
    console.log(`  ${pc.dim("3.")} Global config:`);
    console.log(`     ${pc.dim(globalConfigPath)}`);
    if (
      globalConfig?.source ||
      globalConfig?.marketplace ||
      globalConfig?.agents_source
    ) {
      if (globalConfig?.source) {
        console.log(`     source: ${pc.green(globalConfig.source)}`);
      }
      if (globalConfig?.marketplace) {
        console.log(`     marketplace: ${pc.green(globalConfig.marketplace)}`);
      }
      if (globalConfig?.agents_source) {
        console.log(
          `     agents_source: ${pc.green(globalConfig.agents_source)}`,
        );
      }
    } else {
      console.log(`     ${pc.dim("(not configured)")}`);
    }

    console.log(`  ${pc.dim("4.")} Default:`);
    console.log(`     ${pc.dim(DEFAULT_SOURCE)}`);

    console.log("");
    console.log(pc.dim("Precedence: flag > env > project > global > default"));
    console.log("");
  });

configCommand
  .command("set")
  .description("Set a global configuration value")
  .argument(
    "<key>",
    "Configuration key (source, author, marketplace, agents_source)",
  )
  .argument("<value>", "Configuration value")
  .action(async (key: string, value: string) => {
    const validKeys = ["source", "author", "marketplace", "agents_source"];

    if (!validKeys.includes(key)) {
      p.log.error(`Unknown configuration key: ${key}`);
      p.log.info(`Valid keys: ${validKeys.join(", ")}`);
      process.exit(EXIT_CODES.INVALID_ARGS);
    }

    const existingConfig = (await loadGlobalConfig()) || {};
    const newConfig: GlobalConfig = {
      ...existingConfig,
      [key]: value,
    };

    await saveGlobalConfig(newConfig);

    p.log.success(`Set ${key} = ${value}`);
    p.log.info(`Saved to ${getGlobalConfigPath()}`);
  });

configCommand
  .command("get")
  .description("Get a configuration value")
  .argument(
    "<key>",
    "Configuration key (source, author, marketplace, agents_source)",
  )
  .action(async (key: string) => {
    const projectDir = process.cwd();

    if (key === "source") {
      const resolved = await resolveSource(undefined, projectDir);
      console.log(resolved.source);
    } else if (key === "author") {
      const globalConfig = await loadGlobalConfig();
      console.log(globalConfig?.author || "");
    } else if (key === "marketplace") {
      const resolved = await resolveSource(undefined, projectDir);
      console.log(resolved.marketplace || "");
    } else if (key === "agents_source") {
      const resolved = await resolveAgentsSource(undefined, projectDir);
      console.log(resolved.agentsSource || "");
    } else {
      p.log.error(`Unknown configuration key: ${key}`);
      p.log.info(`Valid keys: source, author, marketplace, agents_source`);
      process.exit(EXIT_CODES.INVALID_ARGS);
    }
  });

configCommand
  .command("unset")
  .description("Remove a global configuration value")
  .argument("<key>", "Configuration key to remove")
  .action(async (key: string) => {
    const validKeys = ["source", "author", "marketplace", "agents_source"];

    if (!validKeys.includes(key)) {
      p.log.error(`Unknown configuration key: ${key}`);
      p.log.info(`Valid keys: ${validKeys.join(", ")}`);
      process.exit(EXIT_CODES.INVALID_ARGS);
    }

    const existingConfig = await loadGlobalConfig();
    if (!existingConfig) {
      p.log.info("No global configuration exists.");
      return;
    }

    const newConfig: GlobalConfig = { ...existingConfig };
    delete newConfig[key as keyof GlobalConfig];

    await saveGlobalConfig(newConfig);

    p.log.success(`Removed ${key} from global configuration`);
  });

configCommand
  .command("set-project")
  .description("Set a project-level configuration value")
  .argument("<key>", "Configuration key (source, marketplace, agents_source)")
  .argument("<value>", "Configuration value")
  .action(async (key: string, value: string) => {
    const projectDir = process.cwd();
    const validKeys = ["source", "marketplace", "agents_source"];

    if (!validKeys.includes(key)) {
      p.log.error(`Unknown configuration key: ${key}`);
      p.log.info(`Valid keys: ${validKeys.join(", ")}`);
      process.exit(EXIT_CODES.INVALID_ARGS);
    }

    const existingConfig = (await loadProjectConfig(projectDir)) || {};

    const newConfig: ProjectConfig = {
      ...existingConfig,
      [key]: value,
    };

    await saveProjectConfig(projectDir, newConfig);

    p.log.success(`Set ${key} = ${value} (project-level)`);
    p.log.info(`Saved to ${getProjectConfigPath(projectDir)}`);
  });

configCommand
  .command("unset-project")
  .description("Remove a project-level configuration value")
  .argument("<key>", "Configuration key to remove")
  .action(async (key: string) => {
    const projectDir = process.cwd();
    const validKeys = ["source", "marketplace", "agents_source"];

    if (!validKeys.includes(key)) {
      p.log.error(`Unknown configuration key: ${key}`);
      p.log.info(`Valid keys: ${validKeys.join(", ")}`);
      process.exit(EXIT_CODES.INVALID_ARGS);
    }

    const existingConfig = await loadProjectConfig(projectDir);

    if (!existingConfig) {
      p.log.info("No project configuration exists.");
      return;
    }

    const newConfig: ProjectConfig = { ...existingConfig };
    delete newConfig[key as keyof ProjectConfig];

    await saveProjectConfig(projectDir, newConfig);

    p.log.success(`Removed ${key} from project configuration`);
  });

configCommand
  .command("path")
  .description("Show configuration file paths")
  .action(async () => {
    const projectDir = process.cwd();

    console.log(pc.bold("\nConfiguration File Paths:\n"));
    console.log(`Global:  ${getGlobalConfigPath()}`);
    console.log(`Project: ${getProjectConfigPath(projectDir)}`);
    console.log("");
  });
