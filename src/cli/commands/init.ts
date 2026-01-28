import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { Liquid } from "liquidjs";
import { stringify as stringifyYaml } from "yaml";
import { DIRS, PROJECT_ROOT, LOCAL_SKILLS_PATH } from "../consts";
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
import { getCollectivePluginDir } from "../lib/plugin-finder";
import {
  generateConfigFromSkills,
  generateConfigFromStack,
} from "../lib/config-generator";
import type {
  CompileConfig,
  CompileAgentConfig,
  StackConfig,
} from "../../types";

/**
 * Default plugin name for Claude Collective
 */
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
    // Get global --dry-run option from parent
    const dryRun = command.optsWithGlobals().dryRun ?? false;

    // Determine target directory (current working directory)
    const projectDir = process.cwd();

    p.intro(pc.cyan("Claude Collective Setup"));

    if (dryRun) {
      p.log.info(
        pc.yellow("[dry-run] Preview mode - no files will be created"),
      );
    }

    const s = p.spinner();

    // Check if plugin already exists (from previous installation)
    const pluginDir = getCollectivePluginDir();
    const pluginExists = await directoryExists(pluginDir);

    if (pluginExists) {
      // Plugin already exists - inform user
      p.log.warn(
        `Claude Collective is already initialized at ${pc.cyan(pluginDir)}`,
      );
      p.log.info(`Use ${pc.cyan("cc edit")} to modify skills.`);
      p.outro(pc.dim("No changes made."));
      return;
    }

    // Load skills matrix from source
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
      process.exit(1);
    }

    const matrix = sourceResult.matrix;

    // Run the wizard
    const result = await runWizard(matrix);

    if (!result) {
      p.cancel("Setup cancelled");
      process.exit(0);
    }

    // Validate the result
    if (!result.validation.valid) {
      p.log.error("Selection has validation errors:");
      for (const error of result.validation.errors) {
        p.log.error(`  ${error.message}`);
      }
      process.exit(1);
    }

    // Show final summary - clear screen and show selections header
    clearTerminal();
    renderSelectionsHeader(result.selectedSkills, matrix);

    // Show warnings if any
    if (result.validation.warnings.length > 0) {
      console.log(pc.yellow("Warnings:"));
      for (const warning of result.validation.warnings) {
        console.log(`  ${pc.yellow("!")} ${warning.message}`);
      }
      console.log("");
    }

    // Log the selected install mode
    p.log.info(
      `Install mode: ${pc.cyan(result.installMode === "plugin" ? "Plugin (native install)" : "Local (copy to .claude/skills/)")}`,
    );

    if (dryRun) {
      if (result.installMode === "plugin") {
        p.log.info(
          pc.yellow(
            `[dry-run] Would install ${result.selectedSkills.length} skills as native plugins`,
          ),
        );
        for (const skillId of result.selectedSkills) {
          const skill = matrix.skills[skillId];
          const pluginName = `skill-${skill?.alias || skillId}`;
          p.log.info(
            pc.yellow(
              `[dry-run]   claude plugin install ${pluginName}@claude-collective --scope project`,
            ),
          );
        }
        p.log.info(
          pc.yellow(`[dry-run] Would compile agents to .claude/agents/`),
        );
      } else {
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

    // =========================================================================
    // Plugin Mode: Install each skill as native plugin + compile agents to .claude/agents/
    // =========================================================================
    if (result.installMode === "plugin") {
      s.start("Installing skills as native plugins...");

      // Note: This simulates the `claude plugin install` command.
      // The actual marketplace isn't set up yet, so we log what would be installed.
      for (const skillId of result.selectedSkills) {
        const skill = matrix.skills[skillId];
        const pluginName = `skill-${skill?.alias || skillId}`;

        // In production, this would be:
        // execSync(`claude plugin install ${pluginName}@claude-collective --scope project`, { stdio: 'inherit' });
        p.log.info(
          `Would install: ${pc.cyan(`${pluginName}@claude-collective`)}`,
        );
      }

      s.stop(
        `Simulated installation of ${result.selectedSkills.length} skills`,
      );

      // Compile agents to .claude/agents/
      s.start("Compiling agents...");

      const projectAgentsDir = path.join(projectDir, ".claude", "agents");
      await ensureDir(projectAgentsDir);

      // Load agents and skills for compilation
      const agents = await loadAllAgents(sourceResult.sourcePath);

      // For Plugin Mode, we don't copy skills locally - they'll be installed as plugins
      // But we still need skill metadata for agent compilation
      // Create a minimal skills map from the matrix for agent resolution
      const skillsForResolution: Record<
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
      for (const skillId of result.selectedSkills) {
        const skill = matrix.skills[skillId];
        if (skill) {
          skillsForResolution[skillId] = {
            id: skillId,
            name: skill.name,
            description: skill.description || "",
            canonicalId: skillId,
            path: skill.path || "",
            content: "", // Content not needed for skill references
          };
        }
      }

      // Generate config for agent resolution
      let pluginConfig: StackConfig;
      if (result.selectedStack) {
        const loadedStackConfig = await loadStack(
          result.selectedStack.id,
          sourceResult.sourcePath,
          "dev",
        );
        pluginConfig = generateConfigFromStack(loadedStackConfig);
      } else {
        pluginConfig = generateConfigFromSkills(
          result.selectedSkills,
          sourceResult.matrix,
        );
      }

      // Build compile config
      const compileAgents: Record<string, CompileAgentConfig> = {};
      for (const agentId of pluginConfig.agents) {
        if (agents[agentId]) {
          if (pluginConfig.agent_skills?.[agentId]) {
            const skillRefs = resolveStackSkills(
              pluginConfig,
              agentId,
              skillsForResolution,
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
          pluginConfig.description ||
          `Plugin with ${result.selectedSkills.length} skills`,
        claude_md: "",
        agents: compileAgents,
      };

      // Create Liquid engine
      const engine = new Liquid({
        root: [path.join(PROJECT_ROOT, DIRS.templates)],
        extname: ".liquid",
        strictVariables: false,
        strictFilters: true,
      });

      // Resolve and compile agents
      const resolvedAgents = await resolveAgents(
        agents,
        skillsForResolution,
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
        await writeFile(path.join(projectAgentsDir, `${name}.md`), output);
        compiledAgentNames.push(name);
      }

      s.stop(`Compiled ${compiledAgentNames.length} agents to .claude/agents/`);

      // Display summary for Plugin Mode
      console.log("");
      console.log(pc.green("Claude Collective initialized successfully!"));
      console.log("");
      console.log(pc.dim("Skills to install (when marketplace is ready):"));
      for (const skillId of result.selectedSkills) {
        const skill = matrix.skills[skillId];
        const pluginName = `skill-${skill?.alias || skillId}`;
        console.log(`  ${pc.cyan(pluginName)}@claude-collective`);
      }
      console.log("");
      console.log(pc.dim("Agents compiled:"));
      console.log(`  ${pc.cyan(projectAgentsDir)}`);
      for (const agentName of compiledAgentNames) {
        console.log(`    ${pc.dim(`${agentName}.md`)}`);
      }
      console.log("");

      p.outro(pc.green("Claude Collective is ready to use!"));

      // Check for permission configuration
      await checkPermissions(projectDir);
      return;
    }

    // =========================================================================
    // Local Mode: Copy skills to .claude/skills/ (flattened structure)
    // =========================================================================
    const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_PATH);
    const localAgentsDir = path.join(projectDir, ".claude", "agents");
    const localConfigPath = path.join(projectDir, ".claude", "config.yaml");

    s.start("Copying skills to local directory...");
    try {
      // Create local directory structure
      await ensureDir(localSkillsDir);
      await ensureDir(localAgentsDir);

      // Copy skills to .claude/skills/ with flattened structure
      const copiedSkills = await copySkillsToLocalFlattened(
        result.selectedSkills,
        localSkillsDir,
        matrix,
        sourceResult,
      );

      s.stop(`Copied ${copiedSkills.length} skills to .claude/skills/`);

      // Generate config
      s.start("Generating configuration...");

      const agents = await loadAllAgents(sourceResult.sourcePath);

      // Load skills from the local .claude/skills/ directory for agent compilation
      // We need to build a skills map from the copied skills
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
        // Using a pre-configured stack template
        const loadedStackConfig = await loadStack(
          result.selectedStack.id,
          sourceResult.sourcePath,
          "dev",
        );
        localConfig = generateConfigFromStack(loadedStackConfig);
      } else {
        // Custom skill selection - generate config from mappings
        localConfig = generateConfigFromSkills(
          result.selectedSkills,
          sourceResult.matrix,
        );
      }

      // Save config.yaml to .claude/config.yaml
      const configYaml = stringifyYaml(localConfig, {
        indent: 2,
        lineWidth: 120,
      });
      await writeFile(localConfigPath, configYaml);

      s.stop(`Configuration saved (${localConfig.agents.length} agents)`);

      // Compile agents to .claude/agents/
      s.start("Compiling agents...");

      // Build compile config from the generated local config
      const compileAgents: Record<string, CompileAgentConfig> = {};
      for (const agentId of localConfig.agents) {
        if (agents[agentId]) {
          // If we have agent_skills, use them for compilation
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

      // Create Liquid engine - templates are bundled with CLI, not fetched from source
      const engine = new Liquid({
        root: [path.join(PROJECT_ROOT, DIRS.templates)],
        extname: ".liquid",
        strictVariables: false,
        strictFilters: true,
      });

      // Resolve and compile agents
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

      // Display summary for Local Mode
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

      // Check for permission configuration
      await checkPermissions(projectDir);
    } catch (error) {
      s.stop("Failed to initialize local mode");
      p.log.error(`Error: ${error}`);
      process.exit(1);
    }
  });
