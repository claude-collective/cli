import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { loadGlobalConfig } from "../lib/config";
import { writeFile, directoryExists } from "../utils/fs";
import { LOCAL_SKILLS_PATH } from "../consts";
import { EXIT_CODES } from "../lib/exit-codes";

const DEFAULT_AUTHOR = "@local";
const DEFAULT_CATEGORY = "local";
const KEBAB_CASE_PATTERN = /^[a-z][a-z0-9-]*$/;

interface NewSkillOptions {
  author?: string;
  category: string;
  force: boolean;
}

/**
 * Validates that a skill name follows kebab-case convention.
 * Must start with lowercase letter, followed by lowercase letters, numbers, or hyphens.
 */
export function validateSkillName(name: string): string | null {
  if (!name || name.trim() === "") {
    return "Skill name is required";
  }

  if (!KEBAB_CASE_PATTERN.test(name)) {
    return "Skill name must be kebab-case (lowercase letters, numbers, and hyphens, starting with a letter)";
  }

  return null;
}

/**
 * Converts kebab-case to Title Case.
 * e.g., "my-patterns" -> "My Patterns"
 */
export function toTitleCase(kebabCase: string): string {
  return kebabCase
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Generates the SKILL.md content with frontmatter.
 */
export function generateSkillMd(name: string, author: string): string {
  const titleName = toTitleCase(name);
  const skillId = `${name} (${author})`;

  return `---
name: ${skillId}
description: Brief description of this skill
---

# ${titleName}

> **Quick Guide:** Add a brief summary of what this skill teaches.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

**(Add critical requirements here)**

</critical_requirements>

---

**When to use:**

- Add use cases here

**Key patterns covered:**

- Add patterns here

---

<patterns>

## Core Patterns

### Pattern 1: Example Pattern

Add your patterns here.

</patterns>

---

<critical_reminders>

## CRITICAL REMINDERS

**(Repeat critical requirements here)**

</critical_reminders>
`;
}

/**
 * Generates the metadata.yaml content.
 */
export function generateMetadataYaml(
  name: string,
  author: string,
  category: string,
): string {
  const titleName = toTitleCase(name);

  return `# yaml-language-server: $schema=https://raw.githubusercontent.com/claude-collective/skills/main/schemas/metadata.schema.json
category: ${category}
category_exclusive: false
author: "${author}"
version: 1
cli_name: ${titleName}
cli_description: Brief description
usage_guidance: Use when <guidance>.
tags:
  - local
  - custom
`;
}

async function newSkillAction(
  name: string,
  options: NewSkillOptions,
): Promise<void> {
  const projectDir = process.cwd();

  p.intro(pc.cyan("Create New Skill"));

  // Validate skill name
  const validationError = validateSkillName(name);
  if (validationError) {
    p.log.error(validationError);
    process.exit(EXIT_CODES.INVALID_ARGS);
  }

  // Determine author: flag > global config > default
  let author = options.author;
  if (!author) {
    const globalConfig = await loadGlobalConfig();
    author = globalConfig?.author || DEFAULT_AUTHOR;
  }

  const category = options.category;

  // Determine skill directory path
  const skillDir = path.join(projectDir, LOCAL_SKILLS_PATH, name);

  // Check if directory already exists
  if (await directoryExists(skillDir)) {
    if (!options.force) {
      p.log.error(
        `Skill directory already exists: ${pc.cyan(skillDir)}\n` +
          `Use ${pc.yellow("--force")} to overwrite.`,
      );
      process.exit(EXIT_CODES.ERROR);
    }
    p.log.warn(`Overwriting existing skill at ${pc.cyan(skillDir)}`);
  }

  p.log.info(pc.dim(`Skill name: ${name}`));
  p.log.info(pc.dim(`Author: ${author}`));
  p.log.info(pc.dim(`Category: ${category}`));
  p.log.info(pc.dim(`Directory: ${skillDir}`));

  const s = p.spinner();
  s.start("Creating skill files...");

  try {
    // Generate file contents
    const skillMdContent = generateSkillMd(name, author);
    const metadataContent = generateMetadataYaml(name, author, category);

    // Write files (writeFile automatically creates parent directories)
    const skillMdPath = path.join(skillDir, "SKILL.md");
    const metadataPath = path.join(skillDir, "metadata.yaml");

    await writeFile(skillMdPath, skillMdContent);
    await writeFile(metadataPath, metadataContent);

    s.stop("Skill created");

    console.log("");
    p.log.success(`Created ${pc.green("SKILL.md")} at ${pc.cyan(skillMdPath)}`);
    p.log.success(
      `Created ${pc.green("metadata.yaml")} at ${pc.cyan(metadataPath)}`,
    );
    console.log("");

    p.outro(
      pc.green("Skill created successfully!") +
        pc.dim(` Run ${pc.cyan("cc compile")} to include it in your agents.`),
    );
  } catch (error) {
    s.stop("Failed");
    p.log.error(
      error instanceof Error ? error.message : "Unknown error occurred",
    );
    process.exit(EXIT_CODES.ERROR);
  }
}

export const skillSubcommand = new Command("skill")
  .argument("<name>", "Name of the skill to create (kebab-case)")
  .description("Create a new local skill with proper structure")
  .option("-a, --author <author>", "Author identifier (e.g., @myhandle)")
  .option(
    "-c, --category <category>",
    "Skill category (default: local)",
    DEFAULT_CATEGORY,
  )
  .option("-f, --force", "Overwrite existing skill directory", false)
  .action(newSkillAction);
