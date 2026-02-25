import { Args, Flags } from "@oclif/core";
import path from "path";
import { BaseCommand } from "../../base-command.js";
import { resolveAuthor } from "../../lib/configuration/index.js";
import { writeFile, directoryExists, fileExists } from "../../utils/fs.js";
import {
  CLI_BIN_NAME,
  KEBAB_CASE_PATTERN,
  LOCAL_SKILLS_PATH,
  PLUGIN_MANIFEST_DIR,
  SKILLS_DIR_PATH,
  STANDARD_FILES,
} from "../../consts.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { LOCAL_DEFAULTS } from "../../lib/metadata-keys.js";
import { computeSkillFolderHash } from "../../lib/versioning.js";
import type { CategoryPath } from "../../types/index.js";

export function validateSkillName(name: string): string | null {
  if (!name || name.trim() === "") {
    return "Skill name is required";
  }

  if (!KEBAB_CASE_PATTERN.test(name)) {
    return "Skill name must be kebab-case (lowercase letters, numbers, and hyphens, starting with a letter)";
  }

  return null;
}

export function toTitleCase(kebabCase: string): string {
  return kebabCase
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function generateSkillMd(name: string): string {
  const titleName = toTitleCase(name);

  return `---
name: ${name}
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

export function generateMetadataYaml(
  name: string,
  author: string,
  category: CategoryPath,
  contentHash: string,
): string {
  const titleName = toTitleCase(name);

  return `custom: true
category: ${category}
categoryExclusive: false
author: "${author}"
cliName: ${titleName}
cliDescription: Brief description
usageGuidance: Use when <guidance>.
contentHash: ${contentHash}
tags:
  - local
  - custom
`;
}

export default class NewSkill extends BaseCommand {
  static summary = "Create a new local skill with proper structure";
  static description = "Create a new local skill scaffold with SKILL.md and metadata.yaml files";

  static args = {
    name: Args.string({
      description: "Name of the skill to create (kebab-case)",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    author: Flags.string({
      char: "a",
      description: "Author identifier (e.g., @myhandle)",
      required: false,
    }),
    category: Flags.string({
      char: "c",
      description: "Skill category",
      default: LOCAL_DEFAULTS.CATEGORY,
    }),
    force: Flags.boolean({
      char: "f",
      description: "Overwrite existing skill directory",
      default: false,
    }),
    output: Flags.string({
      char: "o",
      description: "Output directory for the skill (overrides marketplace detection)",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(NewSkill);
    const projectDir = process.cwd();

    this.log("");
    this.log("Create New Skill");
    this.log("");

    const validationError = validateSkillName(args.name);
    if (validationError) {
      this.error(validationError, { exit: EXIT_CODES.INVALID_ARGS });
    }

    // Determine author: flag > project config > default
    let author = flags.author;
    if (!author) {
      author = (await resolveAuthor(projectDir)) || LOCAL_DEFAULTS.AUTHOR;
    }

    // CLI flag is an untyped string — cast at data boundary
    const category = flags.category as CategoryPath;

    // Determine skill output path: --output flag > marketplace detection > local default
    let skillsBasePath: string;
    if (flags.output) {
      skillsBasePath = path.resolve(flags.output);
    } else {
      const marketplacePath = path.join(projectDir, PLUGIN_MANIFEST_DIR, "marketplace.json");
      if (await fileExists(marketplacePath)) {
        this.log(`Detected marketplace context, creating skill in ${SKILLS_DIR_PATH}/`);
        skillsBasePath = path.join(projectDir, SKILLS_DIR_PATH);
      } else {
        skillsBasePath = path.join(projectDir, LOCAL_SKILLS_PATH);
      }
    }

    const skillDir = path.join(skillsBasePath, args.name);

    if (await directoryExists(skillDir)) {
      if (!flags.force) {
        this.error(`Skill directory already exists: ${skillDir}\nUse --force to overwrite.`, {
          exit: EXIT_CODES.ERROR,
        });
      }
      this.warn(`Overwriting existing skill at ${skillDir}`);
    }

    this.log(`Skill name: ${args.name}`);
    this.log(`Author: ${author}`);
    this.log(`Category: ${category}`);
    this.log(`Directory: ${skillDir}`);
    this.log("");

    if (flags["dry-run"]) {
      this.log("[DRY RUN] Would create skill files");
      return;
    }

    this.log("Creating skill files...");

    try {
      const skillMdContent = generateSkillMd(args.name);

      const skillMdPath = path.join(skillDir, STANDARD_FILES.SKILL_MD);
      const metadataPath = path.join(skillDir, STANDARD_FILES.METADATA_YAML);

      await writeFile(skillMdPath, skillMdContent);

      const contentHash = await computeSkillFolderHash(skillDir);
      const metadataContent = generateMetadataYaml(args.name, author, category, contentHash);
      await writeFile(metadataPath, metadataContent);

      this.log("");
      this.logSuccess(`Created ${STANDARD_FILES.SKILL_MD} at ${skillMdPath}`);
      this.logSuccess(`Created ${STANDARD_FILES.METADATA_YAML} at ${metadataPath}`);
      this.log("");
      this.log(
        `Skill created successfully! Run '${CLI_BIN_NAME} compile' to include it in your agents.`,
      );
      this.log("");
    } catch (error) {
      this.handleError(error);
    }
  }
}
