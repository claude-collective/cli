import { Args, Flags } from "@oclif/core";
import path from "path";
import { BaseCommand } from "../../base-command.js";
import { resolveAuthor } from "../../lib/configuration/index.js";
import { loadConfig } from "../../lib/configuration/config-loader.js";
import {
  loadConfigTypesDataInBackground,
  regenerateConfigTypes,
} from "../../lib/configuration/config-types-writer.js";
import { directoryExists, fileExists, writeFile, ensureDir } from "../../utils/fs.js";
import { getErrorMessage } from "../../utils/errors.js";
import { verbose } from "../../utils/logger.js";
import { computeSkillFolderHash } from "../../lib/versioning.js";
import {
  CLI_BIN_NAME,
  KEBAB_CASE_PATTERN,
  LOCAL_SKILLS_PATH,
  PLUGIN_MANIFEST_DIR,
  SKILL_CATEGORIES_PATH,
  SKILL_RULES_PATH,
  SKILLS_DIR_PATH,
  STANDARD_FILES,
} from "../../consts.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { detectInstallation } from "../../lib/installation/index.js";
import { LOCAL_DEFAULTS } from "../../lib/metadata-keys.js";
import type { CategoryPath } from "../../types/index.js";
import {
  toTitleCase,
  generateSkillCategoriesTs,
  generateSkillRulesTs,
  buildCategoryEntry,
  formatTsExport,
} from "../../lib/skills/generators.js";

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
    domain: Flags.string({
      char: "d",
      description: "Domain for the skill (e.g., web, api, cli)",
      required: false,
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

    await this.ensureInstallation(projectDir, flags.output);
    const configTypesReady = this.startConfigTypesLoading(flags, projectDir);

    this.printHeader();
    this.validateName(args.name);

    const author = await this.resolveAuthorOrDefault(flags.author, projectDir);
    // Boundary cast: CLI flag accepts custom category values not in the generated union
    const category = flags.category as CategoryPath;
    const domain = flags.domain ?? LOCAL_DEFAULTS.DOMAIN;
    const skillsBasePath = await this.resolveSkillsBasePath(flags, projectDir);
    const skillDir = path.join(skillsBasePath, args.name);

    await this.checkExistingDir(skillDir, flags.force);
    this.logSkillInfo(args.name, author, category, skillDir);
    await this.createSkillFiles(
      args.name,
      author,
      category,
      domain,
      skillDir,
      flags,
      projectDir,
      configTypesReady,
    );
  }

  private async ensureInstallation(projectDir: string, output: string | undefined): Promise<void> {
    if (!output) {
      const installation = await detectInstallation(projectDir);
      if (!installation) {
        this.error(`No installation found. Run '${CLI_BIN_NAME} init' first.`, {
          exit: EXIT_CODES.ERROR,
        });
      }
    }
  }

  private startConfigTypesLoading(
    flags: { output?: string; source?: string },
    projectDir: string,
  ): ReturnType<typeof loadConfigTypesDataInBackground> | null {
    return flags.output ? null : loadConfigTypesDataInBackground(flags.source, projectDir);
  }

  private printHeader(): void {
    this.log("");
    this.log("Create New Skill");
    this.log("");
  }

  private validateName(name: string): void {
    const validationError = validateSkillName(name);
    if (validationError) {
      this.error(validationError, { exit: EXIT_CODES.INVALID_ARGS });
    }
  }

  private async resolveAuthorOrDefault(
    authorFlag: string | undefined,
    projectDir: string,
  ): Promise<string> {
    if (authorFlag) return authorFlag;
    return (await resolveAuthor(projectDir)) || LOCAL_DEFAULTS.AUTHOR;
  }

  private async resolveSkillsBasePath(
    flags: { output?: string },
    projectDir: string,
  ): Promise<string> {
    if (flags.output) {
      return path.resolve(flags.output);
    }
    const marketplacePath = path.join(projectDir, PLUGIN_MANIFEST_DIR, "marketplace.json");
    if (await fileExists(marketplacePath)) {
      this.log(`Detected marketplace context, creating skill in ${SKILLS_DIR_PATH}/`);
      return path.join(projectDir, SKILLS_DIR_PATH);
    }
    return path.join(projectDir, LOCAL_SKILLS_PATH);
  }

  private async checkExistingDir(skillDir: string, force: boolean): Promise<void> {
    if (await directoryExists(skillDir)) {
      if (!force) {
        this.error(`Skill directory already exists: ${skillDir}\nUse --force to overwrite.`, {
          exit: EXIT_CODES.ERROR,
        });
      }
      this.warn(`Overwriting existing skill at ${skillDir}`);
    }
  }

  private logSkillInfo(
    name: string,
    author: string,
    category: CategoryPath,
    skillDir: string,
  ): void {
    this.log(`Skill name: ${name}`);
    this.log(`Author: ${author}`);
    this.log(`Category: ${category}`);
    this.log(`Directory: ${skillDir}`);
    this.log("");
  }

  private async createSkillFiles(
    name: string,
    author: string,
    category: CategoryPath,
    domain: string,
    skillDir: string,
    flags: { output?: string; source?: string; force?: boolean },
    projectDir: string,
    configTypesReady: ReturnType<typeof loadConfigTypesDataInBackground> | null,
  ): Promise<void> {
    this.log("Creating skill files...");

    try {
      const result = await scaffoldSkillFiles({
        name,
        author,
        category,
        domain,
        skillDir,
      });

      this.log("");
      this.logSuccess(`Created ${STANDARD_FILES.SKILL_MD} at ${result.skillMdPath}`);
      this.logSuccess(`Created ${STANDARD_FILES.METADATA_YAML} at ${result.metadataPath}`);

      if (!flags.output) {
        const marketplacePath = path.join(projectDir, PLUGIN_MANIFEST_DIR, "marketplace.json");
        if (await fileExists(marketplacePath)) {
          try {
            await updateSkillRegistryConfig({ projectRoot: projectDir, category, domain });
          } catch (error) {
            this.warn(`Could not update config files: ${getErrorMessage(error)}`);
          }
        }
      }

      if (configTypesReady) {
        try {
          await regenerateConfigTypes(projectDir, configTypesReady, {
            extraSkillIds: [name],
            extraDomains: [domain],
            extraCategories: [category],
          });
        } catch (error) {
          this.warn(
            `Could not update ${STANDARD_FILES.CONFIG_TYPES_TS}: ${getErrorMessage(error)}`,
          );
        }
      }

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

type ScaffoldSkillOptions = {
  name: string;
  author: string;
  category: CategoryPath;
  domain: string;
  skillDir: string;
};

type ScaffoldSkillResult = {
  skillMdPath: string;
  metadataPath: string;
  contentHash: string;
};

type RegistryUpdateOptions = {
  projectRoot: string;
  category: CategoryPath;
  domain: string;
};

type RegistryUpdateResult = {
  categoriesCreated: boolean;
  categoriesUpdated: boolean;
  rulesCreated: boolean;
};

export function validateSkillName(name: string): string | null {
  if (!name || name.trim() === "") {
    return "Skill name is required";
  }

  if (!KEBAB_CASE_PATTERN.test(name)) {
    return "Skill name must be kebab-case (lowercase letters, numbers, and hyphens, starting with a letter)";
  }

  return null;
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
  domain: string,
): string {
  const titleName = toTitleCase(name);

  return `# yaml-language-server: $schema=https://raw.githubusercontent.com/agents-inc/cli/main/src/schemas/custom-metadata.schema.json
custom: true
domain: ${domain}
category: ${category}
author: "${author}"
displayName: ${titleName}
slug: ${name}
cliDescription: Brief description
usageGuidance: Use when <guidance>.
contentHash: ${contentHash}
`;
}

async function scaffoldSkillFiles(options: ScaffoldSkillOptions): Promise<ScaffoldSkillResult> {
  const { name, author, category, domain, skillDir } = options;

  const skillMdContent = generateSkillMd(name);
  const skillMdPath = path.join(skillDir, STANDARD_FILES.SKILL_MD);
  const metadataPath = path.join(skillDir, STANDARD_FILES.METADATA_YAML);

  await writeFile(skillMdPath, skillMdContent);

  const contentHash = await computeSkillFolderHash(skillDir);
  const metadataContent = generateMetadataYaml(name, author, category, contentHash, domain);
  await writeFile(metadataPath, metadataContent);

  return { skillMdPath, metadataPath, contentHash };
}

async function updateSkillRegistryConfig(
  options: RegistryUpdateOptions,
): Promise<RegistryUpdateResult> {
  const { projectRoot, category, domain } = options;

  const categoriesPath = path.join(projectRoot, SKILL_CATEGORIES_PATH);
  const rulesPath = path.join(projectRoot, SKILL_RULES_PATH);

  let categoriesCreated = false;
  let categoriesUpdated = false;
  let rulesCreated = false;

  if (await fileExists(categoriesPath)) {
    // Boundary cast: loadConfig returns unknown structure from TS file
    const parsed = (await loadConfig<Record<string, unknown>>(categoriesPath)) ?? {};
    const categories = (parsed.categories ?? {}) as Record<string, unknown>;
    if (!categories[category]) {
      categories[category] = buildCategoryEntry(category, domain);
      parsed.categories = categories;
      await writeFile(categoriesPath, formatTsExport(CATEGORIES_TS_COMMENT, parsed));
      verbose(`Added category '${category}' to ${SKILL_CATEGORIES_PATH}`);
      categoriesUpdated = true;
    }
  } else {
    await ensureDir(path.dirname(categoriesPath));
    await writeFile(categoriesPath, generateSkillCategoriesTs(category, domain));
    verbose(`Created ${SKILL_CATEGORIES_PATH}`);
    categoriesCreated = true;
  }

  if (!(await fileExists(rulesPath))) {
    await ensureDir(path.dirname(rulesPath));
    await writeFile(rulesPath, generateSkillRulesTs());
    verbose(`Created ${SKILL_RULES_PATH}`);
    rulesCreated = true;
  }

  return { categoriesCreated, categoriesUpdated, rulesCreated };
}

const CATEGORIES_TS_COMMENT = "// Skill category definitions";
