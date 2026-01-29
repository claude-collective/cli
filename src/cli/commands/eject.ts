import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import {
  copy,
  ensureDir,
  directoryExists,
  fileExists,
  writeFile,
} from "../utils/fs";
import { DIRS, PROJECT_ROOT } from "../consts";
import { EXIT_CODES } from "../lib/exit-codes";

const EJECT_TYPES = ["templates", "skills", "config", "all"] as const;
type EjectType = (typeof EJECT_TYPES)[number];

const DEFAULT_CONFIG_CONTENT = `# Claude Collective Configuration
# Agent-skill mappings for this project

name: my-project
description: Project description

# Agents to compile
agents:
  - frontend-developer
  - backend-developer
  - tester
  - pm

# Agent-specific skill assignments (optional)
# If not specified, all available skills are given to all agents
agent_skills:
  frontend-developer:
    - react
    - zustand
    - scss-modules
  backend-developer:
    - hono
    - drizzle
    - better-auth
`;

const DEFAULT_SKILL_MD_CONTENT = `---
name: example-skill
description: Short description of the skill
---

# Example Skill

## Overview
Describe what this skill teaches the agent.

## Instructions
Specific instructions for the agent.

## Examples
\`\`\`typescript
// Example code
\`\`\`
`;

const DEFAULT_METADATA_CONTENT = `# yaml-language-server: $schema=../../schemas/metadata.schema.json
category: custom
author: "@local"
cli_name: Example Skill
cli_description: Short description for CLI
`;

export const ejectCommand = new Command("eject")
  .description("Eject bundled content for local customization")
  .argument("[type]", "What to eject: templates, skills, config, all")
  .option("-f, --force", "Overwrite existing files", false)
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (type: string | undefined, options: { force: boolean }) => {
    const projectDir = process.cwd();

    if (!type) {
      p.log.error(
        "Please specify what to eject: templates, skills, config, or all",
      );
      process.exit(EXIT_CODES.INVALID_ARGS);
    }

    if (!EJECT_TYPES.includes(type as EjectType)) {
      p.log.error(`Unknown eject type: ${type}`);
      p.log.info(`Valid types: ${EJECT_TYPES.join(", ")}`);
      process.exit(EXIT_CODES.INVALID_ARGS);
    }

    p.intro(pc.cyan("Claude Collective Eject"));

    const ejectType = type as EjectType;

    switch (ejectType) {
      case "templates":
        await ejectTemplates(projectDir, options.force);
        break;
      case "skills":
        await ejectSkills(projectDir, options.force);
        break;
      case "config":
        await ejectConfig(projectDir, options.force);
        break;
      case "all":
        await ejectTemplates(projectDir, options.force);
        await ejectSkills(projectDir, options.force);
        await ejectConfig(projectDir, options.force);
        break;
    }

    p.outro(pc.green("Eject complete!"));
  });

async function ejectTemplates(
  projectDir: string,
  force: boolean,
): Promise<void> {
  const sourceDir = path.join(PROJECT_ROOT, DIRS.templates);
  const destDir = path.join(projectDir, ".claude", "templates");

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

async function ejectSkills(projectDir: string, force: boolean): Promise<void> {
  const destDir = path.join(projectDir, ".claude", "skill-templates");

  if ((await directoryExists(destDir)) && !force) {
    p.log.warn(
      `Skill templates already exist at ${destDir}. Use --force to overwrite.`,
    );
    return;
  }

  await ensureDir(destDir);

  const exampleSkillDir = path.join(destDir, "example-skill");
  await ensureDir(exampleSkillDir);

  await writeFile(
    path.join(exampleSkillDir, "SKILL.md"),
    DEFAULT_SKILL_MD_CONTENT,
  );

  await writeFile(
    path.join(exampleSkillDir, "metadata.yaml"),
    DEFAULT_METADATA_CONTENT,
  );

  p.log.success(`Skill templates ejected to ${pc.cyan(destDir)}`);
  p.log.info(pc.dim("Copy example-skill/ to .claude/skills/ and customize."));
}

async function ejectConfig(projectDir: string, force: boolean): Promise<void> {
  const destPath = path.join(projectDir, ".claude", "config.yaml");

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
