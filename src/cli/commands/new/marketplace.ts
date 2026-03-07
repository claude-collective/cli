import { Args, Flags } from "@oclif/core";
import path from "path";
import { BaseCommand } from "../../base-command.js";
import { writeFile, directoryExists, ensureDir } from "../../utils/fs.js";
import { getErrorMessage } from "../../utils/errors.js";
import {
  CLI_BIN_NAME,
  KEBAB_CASE_PATTERN,
  PLUGIN_MANIFEST_DIR,
  SKILL_CATEGORIES_PATH,
  SKILL_RULES_PATH,
  SKILLS_DIR_PATH,
  STACKS_FILE_PATH,
  STANDARD_FILES,
} from "../../consts.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { LOCAL_DEFAULTS } from "../../lib/metadata-keys.js";
import { compileAllSkillPlugins } from "../../lib/skills/skill-plugin-compiler.js";
import {
  loadConfigTypesDataInBackground,
  regenerateConfigTypes,
} from "../../lib/configuration/config-types-writer.js";
import { saveProjectConfig } from "../../lib/configuration/config.js";
import { generateMarketplace, writeMarketplace } from "../../lib/marketplace-generator.js";
import { extendSchemasWithCustomValues } from "../../lib/schemas.js";
import { generateSkillCategoriesTs, generateSkillRulesTs } from "./skill.js";
import type { CategoryPath } from "../../types/index.js";

export function validateMarketplaceName(name: string): string | null {
  if (!name || name.trim() === "") {
    return "Marketplace name is required";
  }

  if (!KEBAB_CASE_PATTERN.test(name)) {
    return "Marketplace name must be kebab-case (lowercase letters, numbers, and hyphens, starting with a letter)";
  }

  return null;
}

export function generateStacksTs(name: string): string {
  const data = {
    stacks: [
      {
        id: "dummy-stack",
        name: "Dummy Stack",
        description: `Default stack for ${name}`,
        agents: {
          "web-developer": {
            "dummy-category": "dummy-skill",
          },
        },
        philosophy: "Ship fast, iterate faster",
      },
    ],
  };
  const body = JSON.stringify(data, null, 2);
  return `// Stack definitions for ${name}\nexport default ${body};\n`;
}

export function generateReadme(name: string): string {
  return `# ${name}

Private marketplace for custom skills and stacks.

## Directory Structure

\`\`\`
${STACKS_FILE_PATH}         # Stack definitions (agent groupings with skill mappings)
${SKILLS_DIR_PATH}/                # Custom skill definitions
\`\`\`

## Creating Skills

\`\`\`bash
${CLI_BIN_NAME} new skill <name> --category <category-name>
\`\`\`

Each skill lives in \`${SKILLS_DIR_PATH}/<skill-name>/\` with:
- \`${STANDARD_FILES.SKILL_MD}\` -- Skill content (what the skill teaches)
- \`${STANDARD_FILES.METADATA_YAML}\` -- Skill metadata (category, author, description, custom: true)

## Using This Marketplace

Point the CLI at this marketplace as a source:

\`\`\`bash
# Local development
${CLI_BIN_NAME} init --source /path/to/${name}

# From a git repository
${CLI_BIN_NAME} init --source github:your-org/${name}
\`\`\`

## How It Works

The CLI auto-discovers skills from the \`${SKILLS_DIR_PATH}/\` directory
and stacks from \`${STACKS_FILE_PATH}\`.
Custom categories are discovered from skill \`${STANDARD_FILES.METADATA_YAML}\` files with \`custom: true\`.
Custom skills appear alongside built-in ones in the wizard. No manual registration needed.
`;
}

export default class NewMarketplace extends BaseCommand {
  static summary = "Scaffold a new private marketplace project";
  static description =
    "Create a new private marketplace directory with the required structure " +
    "for custom skills and stacks.";

  static examples = [
    {
      description: "Create a new marketplace",
      command: "<%= config.bin %> <%= command.id %> acme-skills",
    },
    {
      description: "Initialize the current directory as a marketplace",
      command: "<%= config.bin %> <%= command.id %> .",
    },
    {
      description: "Create in a specific location",
      command: "<%= config.bin %> <%= command.id %> acme-skills --output ~/projects",
    },
    {
      description: "Overwrite an existing directory",
      command: "<%= config.bin %> <%= command.id %> acme-skills --force",
    },
  ];

  static args = {
    name: Args.string({
      description:
        'Name of the marketplace directory (kebab-case), or "." to use the current directory',
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    force: Flags.boolean({
      char: "f",
      description: "Overwrite existing directory",
      default: false,
    }),
    output: Flags.string({
      char: "o",
      description: "Parent directory to create the marketplace in (default: current directory)",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(NewMarketplace);

    this.log("");
    this.log("Create New Marketplace");
    this.log("");

    const parentDir = flags.output ? path.resolve(flags.output) : process.cwd();
    const useCurrentDir = args.name === ".";

    const marketplaceName = useCurrentDir ? path.basename(parentDir) : args.name;
    const marketplaceDir = useCurrentDir ? parentDir : path.join(parentDir, args.name);

    const validationError = validateMarketplaceName(marketplaceName);
    if (validationError) {
      if (useCurrentDir) {
        this.error(
          `Current directory name '${marketplaceName}' is not valid kebab-case. Rename it or pass an explicit name.`,
          { exit: EXIT_CODES.INVALID_ARGS },
        );
      }
      this.error(validationError, { exit: EXIT_CODES.INVALID_ARGS });
    }

    // Skip existing directory check when using "." (the directory obviously exists)
    if (!useCurrentDir && (await directoryExists(marketplaceDir))) {
      if (!flags.force) {
        this.error(`Directory already exists: ${marketplaceDir}\nUse --force to overwrite.`, {
          exit: EXIT_CODES.ERROR,
        });
      }
      this.warn(`Overwriting existing directory at ${marketplaceDir}`);
    }

    this.log(`Marketplace: ${marketplaceName}`);
    this.log(`Directory: ${marketplaceDir}`);
    this.log("");

    const skillName = "dummy-skill";

    this.log("Creating marketplace structure...");

    try {
      // Create config/stacks.ts
      const stacksContent = generateStacksTs(marketplaceName);
      const stacksPath = path.join(marketplaceDir, STACKS_FILE_PATH);
      await ensureDir(path.dirname(stacksPath));
      await writeFile(stacksPath, stacksContent);

      // Create config/skill-categories.ts
      const categoriesContent = generateSkillCategoriesTs(
        LOCAL_DEFAULTS.CATEGORY as CategoryPath,
        LOCAL_DEFAULTS.DOMAIN,
      );
      const categoriesPath = path.join(marketplaceDir, SKILL_CATEGORIES_PATH);
      await writeFile(categoriesPath, categoriesContent);

      // Create config/skill-rules.ts
      const rulesContent = generateSkillRulesTs();
      const rulesPath = path.join(marketplaceDir, SKILL_RULES_PATH);
      await writeFile(rulesPath, rulesContent);

      // Delegate skill creation to the new:skill command
      const skillsDir = path.join(marketplaceDir, SKILLS_DIR_PATH);

      const skillArgs = [skillName, "--output", skillsDir, "--domain", LOCAL_DEFAULTS.DOMAIN];
      if (flags.force) skillArgs.push("--force");
      await this.config.runCommand("new:skill", skillArgs);

      // Create README.md
      const readmeContent = generateReadme(marketplaceName);
      const readmePath = path.join(marketplaceDir, "README.md");
      await writeFile(readmePath, readmeContent);

      // Create .claude-src/config.ts so the marketplace is a valid installation
      await saveProjectConfig(marketplaceDir, {
        source: ".",
        marketplace: marketplaceName,
      });

      this.log("");
      this.logSuccess(`Created ${STACKS_FILE_PATH}`);
      this.logSuccess(`Created ${SKILL_CATEGORIES_PATH}`);
      this.logSuccess(`Created ${SKILL_RULES_PATH}`);
      this.logSuccess("Created README.md");
      this.logSuccess("Created .claude-src/config.ts");
      this.log("");

      // Build plugins and marketplace.json so the marketplace is immediately valid
      await this.buildMarketplace(marketplaceDir, marketplaceName);

      this.log("Marketplace created successfully!");
      this.log("");
      this.log("Next steps:");
      if (!useCurrentDir) {
        this.log(`  1. cd ${marketplaceName}`);
      }
      this.log(
        `  ${useCurrentDir ? "1" : "2"}. ${CLI_BIN_NAME} new skill <name> --category <category-name>`,
      );
      this.log(`  ${useCurrentDir ? "2" : "3"}. Push to a git repository`);
      this.log(
        `  ${useCurrentDir ? "3" : "4"}. ${CLI_BIN_NAME} init --source github:your-org/${marketplaceName}`,
      );
      this.log("");
    } catch (error) {
      this.handleError(error);
    }
  }

  private async buildMarketplace(marketplaceDir: string, marketplaceName: string): Promise<void> {
    const skillsDir = path.resolve(marketplaceDir, SKILLS_DIR_PATH);
    const pluginsOutputDir = path.resolve(marketplaceDir, "dist/plugins");
    const marketplaceOutputPath = path.resolve(
      marketplaceDir,
      PLUGIN_MANIFEST_DIR,
      "marketplace.json",
    );

    try {
      // Register custom values so schema validation accepts marketplace-specific domains/categories
      extendSchemasWithCustomValues({
        categories: [LOCAL_DEFAULTS.CATEGORY],
        domains: [LOCAL_DEFAULTS.DOMAIN],
      });

      this.log("Building plugins...");
      const results = await compileAllSkillPlugins(skillsDir, pluginsOutputDir);
      this.logSuccess(`Built ${results.length} skill plugins.`);

      this.log("Generating marketplace.json...");
      const marketplace = await generateMarketplace(pluginsOutputDir, {
        name: marketplaceName,
        ownerName: marketplaceName,
        pluginRoot: "./dist/plugins",
      });
      await writeMarketplace(marketplaceOutputPath, marketplace);
      this.logSuccess(
        `Generated ${PLUGIN_MANIFEST_DIR}/marketplace.json with ${marketplace.plugins.length} plugins.`,
      );

      this.log("Generating config-types.ts...");
      const configTypesData = loadConfigTypesDataInBackground(marketplaceDir, marketplaceDir);
      await regenerateConfigTypes(marketplaceDir, configTypesData);
      this.logSuccess("Generated .claude-src/config-types.ts");
    } catch (error) {
      this.warn(`Build step failed: ${getErrorMessage(error)}`);
      this.warn(
        "The scaffold is still valid. Run 'build plugins' and 'build marketplace' manually.",
      );
    }
  }
}
