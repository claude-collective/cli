import { Args, Flags } from "@oclif/core";
import path from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { BaseCommand } from "../../base-command.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { fetchFromSource } from "../../lib/source-fetcher.js";
import { getCurrentDate, hashFile } from "../../lib/versioning.js";
import {
  copy,
  directoryExists,
  fileExists,
  listDirectories,
  readFile,
  writeFile,
  ensureDir,
} from "../../utils/fs.js";
import { LOCAL_SKILLS_PATH } from "../../consts.js";

/**
 * Metadata for tracking where a skill was imported from.
 */
interface ForkedFromMetadata {
  source: string;
  skill_name: string;
  content_hash: string;
  date: string;
}

interface SkillMetadata {
  forked_from?: ForkedFromMetadata;
  [key: string]: unknown;
}

const SKILL_MD_FILE = "SKILL.md";
const METADATA_YAML_FILE = "metadata.yaml";
const METADATA_JSON_FILE = "metadata.json";
const DEFAULT_SKILLS_SUBDIR = "skills";

/**
 * Parse a GitHub source string into owner/repo and optional subdir.
 *
 * Supported formats:
 * - https://github.com/owner/repo
 * - github:owner/repo
 * - gh:owner/repo
 * - owner/repo (assumes GitHub)
 */
function parseGitHubSource(source: string): {
  gigetSource: string;
  displaySource: string;
} {
  // Full GitHub URL
  if (source.startsWith("https://github.com/")) {
    const path = source.replace("https://github.com/", "");
    return {
      gigetSource: `github:${path}`,
      displaySource: source,
    };
  }

  // Already in giget format
  if (source.startsWith("github:") || source.startsWith("gh:")) {
    const normalized = source.replace(/^gh:/, "github:");
    return {
      gigetSource: normalized,
      displaySource: `https://github.com/${normalized.replace("github:", "")}`,
    };
  }

  // Assume owner/repo format
  if (source.includes("/") && !source.includes(":")) {
    return {
      gigetSource: `github:${source}`,
      displaySource: `https://github.com/${source}`,
    };
  }

  // Return as-is for other sources (might be a local path or other provider)
  return {
    gigetSource: source,
    displaySource: source,
  };
}

export default class ImportSkill extends BaseCommand {
  static summary = "Import a skill from a third-party GitHub repository";
  static description =
    "Download and import skills from external GitHub repositories into your local " +
    ".claude/skills/ directory. Supports importing specific skills or listing available skills.";

  static examples = [
    {
      description: "List available skills from a repository",
      command: "<%= config.bin %> import skill github:vercel-labs/agent-skills --list",
    },
    {
      description: "Import a specific skill",
      command:
        "<%= config.bin %> import skill github:vercel-labs/agent-skills --skill react-best-practices",
    },
    {
      description: "Import all skills from a repository",
      command: "<%= config.bin %> import skill github:vercel-labs/agent-skills --all",
    },
    {
      description: "Import with custom skills directory",
      command:
        "<%= config.bin %> import skill github:owner/repo --skill my-skill --subdir custom-skills",
    },
  ];

  static args = {
    source: Args.string({
      description:
        "GitHub repository source (github:owner/repo, https://github.com/owner/repo, or owner/repo)",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    skill: Flags.string({
      char: "n",
      description: "Name of the specific skill to import",
      required: false,
    }),
    all: Flags.boolean({
      char: "a",
      description: "Import all skills from the repository",
      default: false,
    }),
    list: Flags.boolean({
      char: "l",
      description: "List available skills without importing",
      default: false,
    }),
    subdir: Flags.string({
      description: "Subdirectory containing skills (default: skills)",
      default: DEFAULT_SKILLS_SUBDIR,
    }),
    force: Flags.boolean({
      char: "f",
      description: "Overwrite existing skills",
      default: false,
    }),
    refresh: Flags.boolean({
      description: "Force refresh from remote (ignore cache)",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ImportSkill);
    const projectDir = process.cwd();

    this.log("");
    this.log("Import Third-Party Skill");
    this.log("");

    // Validate flags
    if (!flags.list && !flags.skill && !flags.all) {
      this.error("Please specify --skill <name>, --all, or --list to list available skills", {
        exit: EXIT_CODES.INVALID_ARGS,
      });
    }

    if (flags.skill && flags.all) {
      this.error("Cannot use --skill and --all together", {
        exit: EXIT_CODES.INVALID_ARGS,
      });
    }

    // Parse the source
    const { gigetSource, displaySource } = parseGitHubSource(args.source);
    this.log(`Source: ${displaySource}`);

    // Fetch the repository
    this.log("Fetching repository...");

    let repoPath: string;
    try {
      const result = await fetchFromSource(gigetSource, {
        forceRefresh: flags.refresh,
      });
      repoPath = result.path;
      this.log(result.fromCache ? "Using cached source" : "Downloaded fresh copy");
    } catch (error) {
      this.error(error instanceof Error ? error.message : `Failed to fetch: ${args.source}`, {
        exit: EXIT_CODES.NETWORK_ERROR,
      });
    }

    // Find skills directory
    const skillsDir = path.join(repoPath, flags.subdir);
    if (!(await directoryExists(skillsDir))) {
      this.error(
        `Skills directory not found: ${flags.subdir}\n` +
          `The repository doesn't have a '${flags.subdir}' directory.\n` +
          `Use --subdir to specify a different location.`,
        { exit: EXIT_CODES.INVALID_ARGS },
      );
    }

    // Discover available skills
    const skillDirs = await listDirectories(skillsDir);
    const availableSkills = await this.discoverValidSkills(skillsDir, skillDirs);

    if (availableSkills.length === 0) {
      this.error(
        `No valid skills found in ${flags.subdir}/\n` + `Skills must have a SKILL.md file.`,
        { exit: EXIT_CODES.ERROR },
      );
    }

    // Handle --list
    if (flags.list) {
      this.log("");
      this.log(`Available skills (${availableSkills.length}):`);
      this.log("");
      for (const skill of availableSkills) {
        this.log(`  - ${skill}`);
      }
      this.log("");
      this.log("Use --skill <name> to import a specific skill, or --all to import all.");
      return;
    }

    // Determine which skills to import
    let skillsToImport: string[] = [];

    if (flags.all) {
      skillsToImport = availableSkills;
    } else if (flags.skill) {
      // Validate the skill exists
      if (!availableSkills.includes(flags.skill)) {
        this.error(
          `Skill '${flags.skill}' not found in repository.\n` +
            `Available skills: ${availableSkills.join(", ")}\n` +
            `Use --list to see all available skills.`,
          { exit: EXIT_CODES.INVALID_ARGS },
        );
      }
      skillsToImport = [flags.skill];
    }

    // Destination directory
    const destDir = path.join(projectDir, LOCAL_SKILLS_PATH);

    if (flags["dry-run"]) {
      this.log("");
      this.log("[DRY RUN] Would import the following skills:");
      for (const skill of skillsToImport) {
        const destPath = path.join(destDir, skill);
        const exists = await directoryExists(destPath);
        this.log(`  - ${skill} -> ${destPath}${exists ? " (exists)" : ""}`);
      }
      return;
    }

    // Import skills
    this.log("");
    this.log(`Importing ${skillsToImport.length} skill(s)...`);

    let imported = 0;
    let skipped = 0;

    for (const skillName of skillsToImport) {
      const sourcePath = path.join(skillsDir, skillName);
      const destPath = path.join(destDir, skillName);

      // Check if already exists
      if (await directoryExists(destPath)) {
        if (!flags.force) {
          this.warn(`Skipping '${skillName}': already exists. Use --force to overwrite.`);
          skipped++;
          continue;
        }
      }

      try {
        await this.importSkill(sourcePath, destPath, skillName, displaySource);
        this.logSuccess(`Imported: ${skillName}`);
        imported++;
      } catch (error) {
        this.warn(
          `Failed to import '${skillName}': ${error instanceof Error ? error.message : String(error)}`,
        );
        skipped++;
      }
    }

    this.log("");
    this.logSuccess(`Import complete: ${imported} imported, ${skipped} skipped`);
    this.log(`Skills location: ${destDir}`);
    this.log("");
    this.log("Run 'cc compile' to include imported skills in your agents.");
    this.log("");
  }

  /**
   * Discover valid skills in a directory.
   * A valid skill must have a SKILL.md file.
   */
  private async discoverValidSkills(skillsDir: string, skillDirs: string[]): Promise<string[]> {
    const validSkills: string[] = [];

    for (const skillDir of skillDirs) {
      const skillMdPath = path.join(skillsDir, skillDir, SKILL_MD_FILE);
      if (await fileExists(skillMdPath)) {
        validSkills.push(skillDir);
      }
    }

    return validSkills.sort();
  }

  /**
   * Import a single skill to the destination directory.
   */
  private async importSkill(
    sourcePath: string,
    destPath: string,
    skillName: string,
    source: string,
  ): Promise<void> {
    // Validate SKILL.md exists
    const skillMdPath = path.join(sourcePath, SKILL_MD_FILE);
    if (!(await fileExists(skillMdPath))) {
      throw new Error("Missing required SKILL.md file");
    }

    // Generate content hash from SKILL.md
    const contentHash = await hashFile(skillMdPath);

    // Copy the entire skill directory
    await ensureDir(path.dirname(destPath));
    await copy(sourcePath, destPath);

    // Inject forked_from metadata
    await this.injectForkedFromMetadata(destPath, skillName, source, contentHash);
  }

  /**
   * Inject forked_from metadata into the skill's metadata file.
   * Creates metadata.yaml if it doesn't exist.
   */
  private async injectForkedFromMetadata(
    destPath: string,
    skillName: string,
    source: string,
    contentHash: string,
  ): Promise<void> {
    const metadataYamlPath = path.join(destPath, METADATA_YAML_FILE);
    const metadataJsonPath = path.join(destPath, METADATA_JSON_FILE);

    const forkedFrom: ForkedFromMetadata = {
      source,
      skill_name: skillName,
      content_hash: contentHash,
      date: getCurrentDate(),
    };

    // Try to update existing metadata.yaml
    if (await fileExists(metadataYamlPath)) {
      const rawContent = await readFile(metadataYamlPath);
      const lines = rawContent.split("\n");
      let yamlContent = rawContent;
      let schemaComment = "";

      if (lines[0]?.startsWith("# yaml-language-server:")) {
        schemaComment = lines[0] + "\n";
        yamlContent = lines.slice(1).join("\n");
      }

      const metadata = parseYaml(yamlContent) as SkillMetadata;
      metadata.forked_from = forkedFrom;

      const newYamlContent = stringifyYaml(metadata, { lineWidth: 0 });
      await writeFile(metadataYamlPath, schemaComment + newYamlContent);
      return;
    }

    // Try to update existing metadata.json and convert to YAML
    if (await fileExists(metadataJsonPath)) {
      const rawContent = await readFile(metadataJsonPath);
      const metadata = JSON.parse(rawContent) as SkillMetadata;
      metadata.forked_from = forkedFrom;

      // Create metadata.yaml with converted content
      const yamlContent = stringifyYaml(metadata, { lineWidth: 0 });
      await writeFile(metadataYamlPath, yamlContent);
      return;
    }

    // Create minimal metadata.yaml if neither exists
    const minimalMetadata: SkillMetadata = {
      cli_name: skillName
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
      cli_description: "Imported from third-party repository",
      category: "imported",
      category_exclusive: false,
      author: "@imported",
      forked_from: forkedFrom,
    };

    const yamlContent = stringifyYaml(minimalMetadata, { lineWidth: 0 });
    await writeFile(metadataYamlPath, yamlContent);
  }
}
