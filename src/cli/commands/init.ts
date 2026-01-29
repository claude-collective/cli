import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { stringify as stringifyYaml } from "yaml";
import { LOCAL_SKILLS_PATH } from "../consts";
import { ensureDir, writeFile, directoryExists } from "../utils/fs";
import {
  runWizard,
  clearTerminal,
  renderSelectionsHeader,
} from "../lib/wizard";
import {
  loadSkillsMatrixFromSource,
  type SourceLoadResult,
} from "../lib/source-loader";
import { formatSourceOrigin } from "../lib/config";
import { copySkillsToLocalFlattened } from "../lib/skill-copier";
import { checkPermissions } from "../lib/permission-checker";
import { loadAllAgents, loadStack } from "../lib/loader";
import { resolveAgents, resolveStackSkills } from "../lib/resolver";
import { compileAgentForPlugin } from "../lib/stack-plugin-compiler";
import { installStackAsPlugin } from "../lib/stack-installer";
import { getCollectivePluginDir } from "../lib/plugin-finder";
import { createLiquidEngine } from "../lib/compiler";
import {
  generateConfigFromSkills,
  generateConfigFromStack,
} from "../lib/config-generator";
import { EXIT_CODES } from "../lib/exit-codes";
import type {
  CompileConfig,
  CompileAgentConfig,
  StackConfig,
} from "../../types";

const PLUGIN_NAME = "claude-collective";

export const initCommand = new Command("init")
  .description("Initialize Claude Collective in this project")
  .option(
    "--source <url>",
    "Skills source URL (e.g., github:org/repo or local path)",
  )
  .option("--refresh", "Force refresh from remote source", false)
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options, command) => {
    const dryRun = command.optsWithGlobals().dryRun ?? false;
    const projectDir = process.cwd();

    p.intro(pc.cyan("Claude Collective Setup"));

    if (dryRun) {
      p.log.info(
        pc.yellow("[dry-run] Preview mode - no files will be created"),
      );
    }

    const s = p.spinner();

    const pluginDir = getCollectivePluginDir();
    const pluginExists = await directoryExists(pluginDir);

    if (pluginExists) {
      p.log.warn(
        `Claude Collective is already initialized at ${pc.cyan(pluginDir)}`,
      );
      p.log.info(`Use ${pc.cyan("cc edit")} to modify skills.`);
      p.outro(pc.dim("No changes made."));
      return;
    }

    s.start("Loading skills matrix...");

    let sourceResult: SourceLoadResult;
    try {
      sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: options.source,
        projectDir,
        forceRefresh: options.refresh,
      });

      const sourceInfo = sourceResult.isLocal
        ? "local"
        : formatSourceOrigin(sourceResult.sourceConfig.sourceOrigin);
      s.stop(
        `Loaded ${Object.keys(sourceResult.matrix.skills).length} skills (${sourceInfo})`,
      );
    } catch (error) {
      s.stop("Failed to load skills matrix");
      p.log.error(
        error instanceof Error ? error.message : "Unknown error occurred",
      );
      process.exit(EXIT_CODES.ERROR);
    }

    const matrix = sourceResult.matrix;
    const result = await runWizard(matrix);

    if (!result) {
      p.cancel("Setup cancelled");
      process.exit(EXIT_CODES.CANCELLED);
    }

    if (!result.validation.valid) {
      p.log.error("Selection has validation errors:");
      for (const error of result.validation.errors) {
        p.log.error(`  ${error.message}`);
      }
      process.exit(EXIT_CODES.ERROR);
    }

    clearTerminal();
    renderSelectionsHeader(result.selectedSkills, matrix);

    if (result.validation.warnings.length > 0) {
      console.log(pc.yellow("Warnings:"));
      for (const warning of result.validation.warnings) {
        console.log(`  ${pc.yellow("!")} ${warning.message}`);
      }
      console.log("");
    }

    p.log.info(
      `Install mode: ${pc.cyan(result.installMode === "plugin" ? "Plugin (native install)" : "Local (copy to .claude/skills/)")}`,
    );

    if (dryRun) {
      if (result.installMode === "plugin" && result.selectedStack) {
        // Plugin Mode with stack: install entire stack as ONE plugin
        p.log.info(
          pc.yellow(
            `[dry-run] Would install stack "${result.selectedStack.id}" as a native plugin`,
          ),
        );
        p.log.info(
          pc.yellow(
            `[dry-run]   claude plugin install ./compiled-stack/${result.selectedStack.id} --scope project`,
          ),
        );
        p.log.info(
          pc.yellow(
            `[dry-run] Stack includes ${result.selectedSkills.length} skills and agents bundled together`,
          ),
        );
      } else {
        // Local Mode (or Plugin Mode fallback when no stack selected)
        if (result.installMode === "plugin") {
          p.log.info(
            pc.yellow(
              `[dry-run] Individual skill plugin installation not yet supported`,
            ),
          );
          p.log.info(pc.yellow(`[dry-run] Would fall back to Local Mode...`));
        }
        const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_PATH);
        const localAgentsDir = path.join(projectDir, ".claude", "agents");
        p.log.info(
          pc.yellow(
            `[dry-run] Would copy ${result.selectedSkills.length} skills to ${localSkillsDir}`,
          ),
        );
        p.log.info(
          pc.yellow(`[dry-run] Would compile agents to ${localAgentsDir}`),
        );
        p.log.info(
          pc.yellow(`[dry-run] Would save config to .claude/config.yaml`),
        );
      }
      p.outro(pc.green("[dry-run] Preview complete - no files were created"));
      return;
    }

    if (result.installMode === "plugin") {
      // Plugin Mode: Install stack as ONE native plugin
      if (result.selectedStack) {
        s.start(
          `Compiling and installing stack "${result.selectedStack.id}"...`,
        );

        try {
          const installResult = await installStackAsPlugin({
            stackId: result.selectedStack.id,
            projectDir,
            sourcePath: sourceResult.sourcePath,
            agentSourcePath: sourceResult.sourcePath,
          });

          s.stop(`Installed stack plugin: ${installResult.pluginName}`);

          console.log("");
          console.log(pc.green("Claude Collective initialized successfully!"));
          console.log("");
          console.log(
            `Stack ${pc.cyan(`"${installResult.stackName}"`)} installed as plugin`,
          );
          console.log("");
          console.log(pc.dim("Agents included:"));
          for (const agentName of installResult.agents) {
            console.log(`  ${pc.cyan(agentName)}`);
          }
          console.log("");
          console.log(pc.dim(`Skills bundled: ${installResult.skills.length}`));
          console.log("");

          p.outro(pc.green("Claude Collective is ready to use!"));

          await checkPermissions(projectDir);
          return;
        } catch (error) {
          s.stop("Installation failed");
          p.log.error(error instanceof Error ? error.message : "Unknown error");
          process.exit(EXIT_CODES.ERROR);
        }
      } else {
        // No stack selected - individual skill installation not yet supported
        // TODO: Support installing individual skills as separate plugins
        p.log.warn(
          "Individual skill plugin installation not yet supported in Plugin Mode.",
        );
        p.log.info(
          `Falling back to Local Mode (copying to ${pc.cyan(".claude/skills/")})...`,
        );
        p.log.info(
          pc.dim(
            "To use Plugin Mode, select a pre-built stack instead of individual skills.",
          ),
        );
        console.log("");
        // Fall through to Local Mode below
      }
    }

    const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_PATH);
    const localAgentsDir = path.join(projectDir, ".claude", "agents");
    const localConfigPath = path.join(projectDir, ".claude", "config.yaml");

    s.start("Copying skills to local directory...");
    try {
      await ensureDir(localSkillsDir);
      await ensureDir(localAgentsDir);

      const copiedSkills = await copySkillsToLocalFlattened(
        result.selectedSkills,
        localSkillsDir,
        matrix,
        sourceResult,
      );

      s.stop(`Copied ${copiedSkills.length} skills to .claude/skills/`);

      s.start("Generating configuration...");

      const agents = await loadAllAgents(sourceResult.sourcePath);

      const localSkillsForResolution: Record<
        string,
        {
          id: string;
          name: string;
          description: string;
          canonicalId: string;
          path: string;
          content: string;
        }
      > = {};
      for (const copiedSkill of copiedSkills) {
        const skill = matrix.skills[copiedSkill.skillId];
        if (skill) {
          localSkillsForResolution[copiedSkill.skillId] = {
            id: copiedSkill.skillId,
            name: skill.name,
            description: skill.description || "",
            canonicalId: copiedSkill.skillId,
            path: copiedSkill.destPath,
            content: "", // Content not needed for skill references
          };
        }
      }

      let localConfig: StackConfig;
      if (result.selectedStack) {
        const loadedStackConfig = await loadStack(
          result.selectedStack.id,
          sourceResult.sourcePath,
          "dev",
        );
        localConfig = generateConfigFromStack(loadedStackConfig);
      } else {
        localConfig = generateConfigFromSkills(
          result.selectedSkills,
          sourceResult.matrix,
        );
      }

      const configYaml = stringifyYaml(localConfig, {
        indent: 2,
        lineWidth: 120,
      });
      await writeFile(localConfigPath, configYaml);

      s.stop(`Configuration saved (${localConfig.agents.length} agents)`);

      s.start("Compiling agents...");

      const compileAgents: Record<string, CompileAgentConfig> = {};
      for (const agentId of localConfig.agents) {
        if (agents[agentId]) {
          if (localConfig.agent_skills?.[agentId]) {
            const skillRefs = resolveStackSkills(
              localConfig,
              agentId,
              localSkillsForResolution,
            );
            compileAgents[agentId] = { skills: skillRefs };
          } else {
            compileAgents[agentId] = {};
          }
        }
      }

      const compileConfig: CompileConfig = {
        name: PLUGIN_NAME,
        description:
          localConfig.description ||
          `Local setup with ${result.selectedSkills.length} skills`,
        claude_md: "",
        agents: compileAgents,
      };

      const engine = await createLiquidEngine(projectDir);
      const resolvedAgents = await resolveAgents(
        agents,
        localSkillsForResolution,
        compileConfig,
        sourceResult.sourcePath,
      );

      const compiledAgentNames: string[] = [];
      for (const [name, agent] of Object.entries(resolvedAgents)) {
        const output = await compileAgentForPlugin(
          name,
          agent,
          sourceResult.sourcePath,
          engine,
        );
        await writeFile(path.join(localAgentsDir, `${name}.md`), output);
        compiledAgentNames.push(name);
      }

      s.stop(`Compiled ${compiledAgentNames.length} agents to .claude/agents/`);

      console.log("");
      console.log(pc.green("Claude Collective initialized successfully!"));
      console.log("");
      console.log(pc.dim("Skills copied to:"));
      console.log(`  ${pc.cyan(localSkillsDir)}`);
      for (const copiedSkill of copiedSkills) {
        const skill = matrix.skills[copiedSkill.skillId];
        const displayName = skill?.alias || copiedSkill.skillId;
        console.log(`    ${pc.dim(displayName + "/")}`);
      }
      console.log("");
      console.log(pc.dim("Agents compiled to:"));
      console.log(`  ${pc.cyan(localAgentsDir)}`);
      for (const agentName of compiledAgentNames) {
        console.log(`    ${pc.dim(`${agentName}.md`)}`);
      }
      console.log("");
      console.log(pc.dim("Configuration:"));
      console.log(`  ${pc.cyan(localConfigPath)}`);
      console.log("");
      console.log(pc.dim("To customize agent-skill assignments:"));
      console.log(`  ${pc.cyan("1.")} Edit ${pc.cyan(".claude/config.yaml")}`);
      console.log(
        `  ${pc.cyan("2.")} Run ${pc.cyan("cc compile")} to regenerate agents`,
      );
      console.log("");

      p.outro(pc.green("Claude Collective is ready to use!"));

      await checkPermissions(projectDir);
    } catch (error) {
      s.stop("Failed to initialize local mode");
      p.log.error(`Error: ${error}`);
      process.exit(EXIT_CODES.ERROR);
    }
  });
