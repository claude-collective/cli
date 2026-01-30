import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import os from "os";
import {
  copy,
  ensureDir,
  directoryExists,
  fileExists,
  writeFile,
} from "../utils/fs";
import { DIRS, PROJECT_ROOT } from "../consts";
import {
  getCollectivePluginDir,
  getPluginSkillsDir,
} from "../lib/plugin-finder";
import { EXIT_CODES } from "../lib/exit-codes";

const EJECT_TYPES = ["templates", "config", "skills", "agents", "all"] as const;
type EjectType = (typeof EJECT_TYPES)[number];

const DEFAULT_CONFIG_CONTENT = `# Claude Collective Configuration
# Agent-skill mappings for this project

name: my-project
description: Project description

# Agents to compile
agents:
  - web-developer
  - api-developer
  - web-tester
  - web-pm

# Agent-specific skill assignments (optional)
# If not specified, all available skills are given to all agents
agent_skills:
  web-developer:
    - react
    - zustand
    - scss-modules
  api-developer:
    - hono
    - drizzle
    - better-auth
`;

export const ejectCommand = new Command("eject")
  .description("Eject bundled content for local customization")
  .argument("[type]", "What to eject: templates, config, skills, agents, all")
  .option("-f, --force", "Overwrite existing files", false)
  .option(
    "-o, --output <dir>",
    "Output directory (default: .claude/ in current directory)",
  )
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(
    async (
      type: string | undefined,
      options: { force: boolean; output?: string },
    ) => {
      const projectDir = process.cwd();

      if (!type) {
        p.log.error(
          "Please specify what to eject: templates, config, skills, agents, or all",
        );
        process.exit(EXIT_CODES.INVALID_ARGS);
      }

      if (!EJECT_TYPES.includes(type as EjectType)) {
        p.log.error(`Unknown eject type: ${type}`);
        p.log.info(`Valid types: ${EJECT_TYPES.join(", ")}`);
        process.exit(EXIT_CODES.INVALID_ARGS);
      }

      // Resolve output base directory
      let outputBase: string;
      if (options.output) {
        // Expand ~ to home directory if present
        const expandedPath = options.output.startsWith("~")
          ? path.join(os.homedir(), options.output.slice(1))
          : options.output;
        outputBase = path.resolve(projectDir, expandedPath);

        // Validate output path is not an existing file
        if (await fileExists(outputBase)) {
          p.log.error(`Output path exists as a file: ${outputBase}`);
          p.log.info("Please specify a directory path, not a file.");
          process.exit(EXIT_CODES.INVALID_ARGS);
        }
      } else {
        outputBase = path.join(projectDir, ".claude");
      }

      p.intro(pc.cyan("Claude Collective Eject"));

      // Show output directory when using custom path
      if (options.output) {
        p.log.info(`Output directory: ${pc.cyan(outputBase)}`);
      }

      const ejectType = type as EjectType;
      const directOutput = !!options.output;

      switch (ejectType) {
        case "templates":
          await ejectTemplates(outputBase, options.force, directOutput);
          break;
        case "config":
          await ejectConfig(outputBase, options.force, directOutput);
          break;
        case "skills":
          await ejectSkills(outputBase, options.force, directOutput);
          break;
        case "agents":
          await ejectAgents(outputBase, options.force, directOutput);
          break;
        case "all":
          await ejectTemplates(outputBase, options.force, directOutput);
          await ejectConfig(outputBase, options.force, directOutput);
          await ejectSkills(outputBase, options.force, directOutput);
          await ejectAgents(outputBase, options.force, directOutput);
          break;
      }

      p.outro(pc.green("Eject complete!"));
    },
  );

async function ejectTemplates(
  outputBase: string,
  force: boolean,
  directOutput: boolean = false,
): Promise<void> {
  const sourceDir = path.join(PROJECT_ROOT, DIRS.templates);
  // When directOutput is true (--output used), write directly to outputBase
  // When false (default), add "templates" subdirectory for backward compatibility
  const destDir = directOutput
    ? outputBase
    : path.join(outputBase, "templates");

  if ((await directoryExists(destDir)) && !force) {
    p.log.warn(
      `Templates already exist at ${destDir}. Use --force to overwrite.`,
    );
    return;
  }

  await ensureDir(destDir);
  await copy(sourceDir, destDir);

  p.log.success(`Templates ejected to ${pc.cyan(destDir)}`);
  p.log.info(
    pc.dim("You can now customize agent.liquid and partials locally."),
  );
}

async function ejectConfig(
  outputBase: string,
  force: boolean,
  directOutput: boolean = false,
): Promise<void> {
  // Config always outputs to config.yaml in the specified location
  const destPath = path.join(outputBase, "config.yaml");

  if ((await fileExists(destPath)) && !force) {
    p.log.warn(
      `Config already exists at ${destPath}. Use --force to overwrite.`,
    );
    return;
  }

  await ensureDir(path.dirname(destPath));
  await writeFile(destPath, DEFAULT_CONFIG_CONTENT);

  p.log.success(`Config template ejected to ${pc.cyan(destPath)}`);
  p.log.info(pc.dim("Customize agent-skill mappings for your project."));
}

async function ejectSkills(
  outputBase: string,
  force: boolean,
  directOutput: boolean = false,
): Promise<void> {
  // Find skills from installed plugin
  const pluginDir = getCollectivePluginDir();
  const sourceDir = getPluginSkillsDir(pluginDir);

  if (!(await directoryExists(sourceDir))) {
    p.log.warn("No skills found in installed plugin.");
    p.log.info(
      pc.dim("Install skills with 'cc add <skill>' first, then try again."),
    );
    return;
  }

  // When directOutput is true (--output used), write directly to outputBase
  // When false (default), add "skills" subdirectory
  const destDir = directOutput ? outputBase : path.join(outputBase, "skills");

  if ((await directoryExists(destDir)) && !force) {
    p.log.warn(`Skills already exist at ${destDir}. Use --force to overwrite.`);
    return;
  }

  await ensureDir(destDir);
  await copy(sourceDir, destDir);

  p.log.success(`Skills ejected to ${pc.cyan(destDir)}`);
  p.log.info(pc.dim("You can now customize skill content locally."));
}

async function ejectAgents(
  outputBase: string,
  force: boolean,
  directOutput: boolean = false,
): Promise<void> {
  // Source is the agents directory from PROJECT_ROOT (excluding _templates)
  const sourceDir = path.join(PROJECT_ROOT, DIRS.agents);

  if (!(await directoryExists(sourceDir))) {
    p.log.warn("No agent partials found.");
    return;
  }

  // When directOutput is true (--output used), write directly to outputBase
  // When false (default), add "agents/_partials" subdirectory
  const destDir = directOutput
    ? outputBase
    : path.join(outputBase, "agents", "_partials");

  if ((await directoryExists(destDir)) && !force) {
    p.log.warn(
      `Agent partials already exist at ${destDir}. Use --force to overwrite.`,
    );
    return;
  }

  await ensureDir(destDir);
  await copy(sourceDir, destDir);

  p.log.success(`Agent partials ejected to ${pc.cyan(destDir)}`);
  p.log.info(
    pc.dim(
      "You can now customize agent intro, workflow, and examples locally.",
    ),
  );
}
