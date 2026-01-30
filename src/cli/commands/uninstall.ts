import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { directoryExists, fileExists, remove } from "../utils/fs";
import { claudePluginUninstall, isClaudeCLIAvailable } from "../utils/exec";
import { getCollectivePluginDir } from "../lib/plugin-finder";
import { CLAUDE_DIR } from "../consts";
import { EXIT_CODES } from "../lib/exit-codes";

const PLUGIN_NAME = "claude-collective";

interface UninstallOptions {
  yes: boolean;
  keepConfig: boolean;
  plugin: boolean;
  local: boolean;
}

interface UninstallTarget {
  hasPlugin: boolean;
  hasLocalSkills: boolean;
  hasLocalAgents: boolean;
  hasLocalConfig: boolean;
  pluginDir: string;
  skillsDir: string;
  agentsDir: string;
  configPath: string;
}

async function detectInstallation(
  projectDir: string,
): Promise<UninstallTarget> {
  const pluginDir = getCollectivePluginDir(projectDir);
  const skillsDir = path.join(projectDir, CLAUDE_DIR, "skills");
  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  const configPath = path.join(projectDir, CLAUDE_DIR, "config.yaml");

  const [hasPlugin, hasLocalSkills, hasLocalAgents, hasLocalConfig] =
    await Promise.all([
      directoryExists(pluginDir),
      directoryExists(skillsDir),
      directoryExists(agentsDir),
      fileExists(configPath),
    ]);

  return {
    hasPlugin,
    hasLocalSkills,
    hasLocalAgents,
    hasLocalConfig,
    pluginDir,
    skillsDir,
    agentsDir,
    configPath,
  };
}

export const uninstallCommand = new Command("uninstall")
  .description("Remove Claude Collective from this project")
  .option("-y, --yes", "Skip confirmation prompt", false)
  .option("--keep-config", "Keep .claude/config.yaml", false)
  .option("--plugin", "Only uninstall the plugin (not local files)", false)
  .option("--local", "Only remove local files (not the plugin)", false)
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options: UninstallOptions, command) => {
    const dryRun = command.optsWithGlobals().dryRun ?? false;
    const projectDir = process.cwd();

    p.intro(pc.cyan("Claude Collective Uninstall"));

    if (dryRun) {
      p.log.info(
        pc.yellow("[dry-run] Preview mode - no files will be removed"),
      );
    }

    // Detect what's installed
    const target = await detectInstallation(projectDir);

    // Determine what to uninstall based on flags
    const uninstallPlugin = !options.local;
    const uninstallLocal = !options.plugin;

    // Check if there's anything to uninstall
    const hasPluginToRemove = uninstallPlugin && target.hasPlugin;
    const hasLocalToRemove =
      uninstallLocal &&
      (target.hasLocalSkills || target.hasLocalAgents || target.hasLocalConfig);

    if (!hasPluginToRemove && !hasLocalToRemove) {
      p.log.warn("Nothing to uninstall.");

      if (options.plugin && !target.hasPlugin) {
        p.log.info(pc.dim("No plugin installation found."));
      }
      if (options.local && !target.hasLocalSkills && !target.hasLocalAgents) {
        p.log.info(pc.dim("No local installation found."));
      }
      if (!options.plugin && !options.local) {
        p.log.info(
          pc.dim("Claude Collective is not installed in this project."),
        );
      }

      p.outro(pc.dim("No changes made."));
      return;
    }

    // Show what will be removed
    console.log("");
    console.log(pc.bold("The following will be removed:"));
    console.log("");

    if (hasPluginToRemove) {
      console.log(pc.red("  Plugin:"));
      console.log(`    ${pc.dim(target.pluginDir)}`);
    }

    if (hasLocalToRemove) {
      console.log(pc.red("  Local files:"));
      if (target.hasLocalSkills) {
        console.log(`    ${pc.dim(target.skillsDir)}`);
      }
      if (target.hasLocalAgents) {
        console.log(`    ${pc.dim(target.agentsDir)}`);
      }
      if (target.hasLocalConfig && !options.keepConfig) {
        console.log(`    ${pc.dim(target.configPath)}`);
      }
    }

    if (options.keepConfig && target.hasLocalConfig) {
      console.log("");
      console.log(pc.yellow("  Keeping:"));
      console.log(`    ${pc.dim(target.configPath)}`);
    }

    console.log("");

    // Confirm unless --yes flag
    if (!options.yes && !dryRun) {
      const confirmed = await p.confirm({
        message: "Are you sure you want to uninstall?",
        initialValue: false,
      });

      if (p.isCancel(confirmed)) {
        p.cancel("Uninstall cancelled");
        process.exit(EXIT_CODES.CANCELLED);
      }

      if (!confirmed) {
        p.outro(pc.dim("No changes made."));
        return;
      }
    }

    // Dry run - show what would happen
    if (dryRun) {
      if (hasPluginToRemove) {
        p.log.info(
          pc.yellow(`[dry-run] Would uninstall plugin "${PLUGIN_NAME}"`),
        );
        p.log.info(pc.yellow(`[dry-run] Would remove ${target.pluginDir}`));
      }
      if (hasLocalToRemove) {
        if (target.hasLocalSkills) {
          p.log.info(pc.yellow(`[dry-run] Would remove ${target.skillsDir}`));
        }
        if (target.hasLocalAgents) {
          p.log.info(pc.yellow(`[dry-run] Would remove ${target.agentsDir}`));
        }
        if (target.hasLocalConfig && !options.keepConfig) {
          p.log.info(pc.yellow(`[dry-run] Would remove ${target.configPath}`));
        }
      }
      p.outro(pc.green("[dry-run] Preview complete - no files were removed"));
      return;
    }

    const s = p.spinner();

    // Uninstall plugin
    if (hasPluginToRemove) {
      s.start("Uninstalling plugin...");

      try {
        // Try to use claude CLI to uninstall (handles settings.json)
        const cliAvailable = await isClaudeCLIAvailable();
        if (cliAvailable) {
          await claudePluginUninstall(PLUGIN_NAME, "project", projectDir);
        }

        // Remove plugin directory
        await remove(target.pluginDir);

        s.stop("Plugin uninstalled");
      } catch (error) {
        s.stop("Plugin uninstall failed");
        p.log.error(
          error instanceof Error ? error.message : "Unknown error occurred",
        );
        process.exit(EXIT_CODES.ERROR);
      }
    }

    // Remove local files
    if (hasLocalToRemove) {
      s.start("Removing local files...");

      try {
        const removed: string[] = [];

        if (target.hasLocalSkills) {
          await remove(target.skillsDir);
          removed.push(".claude/skills/");
        }

        if (target.hasLocalAgents) {
          await remove(target.agentsDir);
          removed.push(".claude/agents/");
        }

        if (target.hasLocalConfig && !options.keepConfig) {
          await remove(target.configPath);
          removed.push(".claude/config.yaml");
        }

        s.stop(
          `Removed ${removed.length} ${removed.length === 1 ? "item" : "items"}`,
        );
      } catch (error) {
        s.stop("Failed to remove local files");
        p.log.error(
          error instanceof Error ? error.message : "Unknown error occurred",
        );
        process.exit(EXIT_CODES.ERROR);
      }
    }

    console.log("");
    console.log(pc.green("Claude Collective has been uninstalled."));

    if (options.keepConfig) {
      console.log("");
      console.log(pc.dim("Configuration preserved at .claude/config.yaml"));
      console.log(
        pc.dim("Run `cc init` to reinstall with your existing configuration."),
      );
    }

    p.outro(pc.green("Uninstall complete!"));
  });
