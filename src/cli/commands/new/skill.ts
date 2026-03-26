import { Args, Flags } from "@oclif/core";
import path from "path";
import { BaseCommand } from "../../base-command.js";
import { resolveAuthor } from "../../lib/configuration/index.js";
import {
  loadConfigTypesDataInBackground,
  regenerateConfigTypes,
} from "../../lib/configuration/config-types-writer.js";
import { directoryExists, fileExists } from "../../utils/fs.js";
import { getErrorMessage } from "../../utils/errors.js";
import {
  CLI_BIN_NAME,
  LOCAL_SKILLS_PATH,
  PLUGIN_MANIFEST_DIR,
  SKILLS_DIR_PATH,
  STANDARD_FILES,
} from "../../consts.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { detectInstallation } from "../../lib/installation/index.js";
import { LOCAL_DEFAULTS } from "../../lib/metadata-keys.js";
import type { CategoryPath } from "../../types/index.js";
import {
  validateSkillName,
  scaffoldSkillFiles,
  updateSkillRegistryConfig,
} from "../../lib/operations/scaffold-skill.js";

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

    if (!flags.output) {
      const installation = await detectInstallation(projectDir);
      if (!installation) {
        this.error(`No installation found. Run '${CLI_BIN_NAME} init' first.`, {
          exit: EXIT_CODES.ERROR,
        });
      }
    }

    // Kick off background loading for config-types.ts regeneration (non-blocking)
    const configTypesReady = flags.output
      ? null
      : loadConfigTypesDataInBackground(flags.source, projectDir);

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

    // Boundary cast: CLI flag accepts custom category values not in the generated union
    const category = flags.category as CategoryPath;

    const domain = flags.domain ?? LOCAL_DEFAULTS.DOMAIN;

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

    this.log("Creating skill files...");

    try {
      const result = await scaffoldSkillFiles({
        name: args.name,
        author,
        category,
        domain,
        skillDir,
      });

      this.log("");
      this.logSuccess(`Created ${STANDARD_FILES.SKILL_MD} at ${result.skillMdPath}`);
      this.logSuccess(`Created ${STANDARD_FILES.METADATA_YAML} at ${result.metadataPath}`);

      // Update config files when in marketplace context
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

      // Regenerate config-types.ts to include the new skill
      if (configTypesReady) {
        try {
          await regenerateConfigTypes(projectDir, configTypesReady, {
            extraSkillIds: [args.name],
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
