import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { createTwoFilesPatch } from "diff";
import { parse as parseYaml } from "yaml";
import { loadSkillsMatrixFromSource } from "../lib/source-loader";
import { EXIT_CODES } from "../lib/exit-codes";
import { fileExists, readFile, listDirectories } from "../utils/fs";
import { LOCAL_SKILLS_PATH, SKILLS_DIR_PATH } from "../consts";

/**
 * ForkedFrom metadata stored in local skill's metadata.yaml
 */
interface ForkedFromMetadata {
  skill_id: string;
  content_hash: string;
  date: string;
}

/**
 * Local skill metadata structure
 */
interface LocalSkillMetadata {
  forked_from?: ForkedFromMetadata;
  [key: string]: unknown;
}

/**
 * Result of diffing a local skill against its source
 */
interface SkillDiffResult {
  skillDirName: string;
  forkedFrom: ForkedFromMetadata | null;
  hasDiff: boolean;
  diffOutput: string;
}

/**
 * Read forked_from metadata from a local skill's metadata.yaml
 */
async function readForkedFromMetadata(
  skillDir: string,
): Promise<ForkedFromMetadata | null> {
  const metadataPath = path.join(skillDir, "metadata.yaml");

  if (!(await fileExists(metadataPath))) {
    return null;
  }

  const content = await readFile(metadataPath);
  const metadata = parseYaml(content) as LocalSkillMetadata;

  return metadata.forked_from ?? null;
}

/**
 * Color the diff output for terminal display
 */
function colorDiff(diffText: string): string {
  return diffText
    .split("\n")
    .map((line) => {
      if (line.startsWith("+++") || line.startsWith("---")) {
        return pc.bold(line);
      }
      if (line.startsWith("+")) {
        return pc.green(line);
      }
      if (line.startsWith("-")) {
        return pc.red(line);
      }
      if (line.startsWith("@@")) {
        return pc.cyan(line);
      }
      return line;
    })
    .join("\n");
}

/**
 * Generate diff for a single skill
 */
async function diffSkill(
  localSkillsPath: string,
  skillDirName: string,
  sourcePath: string,
  sourceSkills: Record<string, { path: string }>,
): Promise<SkillDiffResult> {
  const skillDir = path.join(localSkillsPath, skillDirName);
  const forkedFrom = await readForkedFromMetadata(skillDir);

  if (!forkedFrom) {
    return {
      skillDirName,
      forkedFrom: null,
      hasDiff: false,
      diffOutput: "",
    };
  }

  const sourceSkill = sourceSkills[forkedFrom.skill_id];

  if (!sourceSkill) {
    return {
      skillDirName,
      forkedFrom,
      hasDiff: false,
      diffOutput: `Source skill '${forkedFrom.skill_id}' no longer exists`,
    };
  }

  // Load source SKILL.md
  const sourceSkillMdPath = path.join(
    sourcePath,
    "src",
    sourceSkill.path,
    "SKILL.md",
  );

  if (!(await fileExists(sourceSkillMdPath))) {
    return {
      skillDirName,
      forkedFrom,
      hasDiff: false,
      diffOutput: `Source SKILL.md not found at ${sourceSkillMdPath}`,
    };
  }

  const sourceContent = await readFile(sourceSkillMdPath);

  // Load local SKILL.md
  const localSkillMdPath = path.join(skillDir, "SKILL.md");

  if (!(await fileExists(localSkillMdPath))) {
    return {
      skillDirName,
      forkedFrom,
      hasDiff: false,
      diffOutput: `Local SKILL.md not found at ${localSkillMdPath}`,
    };
  }

  const localContent = await readFile(localSkillMdPath);

  // Generate unified diff
  const sourceLabel = `source/${sourceSkill.path}/SKILL.md`;
  const localLabel = `local/${LOCAL_SKILLS_PATH}/${skillDirName}/SKILL.md`;

  const diff = createTwoFilesPatch(
    sourceLabel,
    localLabel,
    sourceContent,
    localContent,
    "", // No source header
    "", // No local header
  );

  // Check if there are actual differences (not just the file headers)
  const hasDiff = diff.split("\n").some((line) => {
    return (
      (line.startsWith("+") || line.startsWith("-")) &&
      !line.startsWith("+++") &&
      !line.startsWith("---")
    );
  });

  return {
    skillDirName,
    forkedFrom,
    hasDiff,
    diffOutput: diff,
  };
}

export const diffCommand = new Command("diff")
  .description(
    "Show differences between local forked skills and their source versions",
  )
  .option("-s, --source <source>", "Skills source path or URL")
  .option("--skill <name>", "Show diff for specific skill only")
  .option("-q, --quiet", "Suppress output, only return exit code")
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(
    async (options: { source?: string; skill?: string; quiet?: boolean }) => {
      const s = p.spinner();
      const projectDir = process.cwd();

      try {
        const localSkillsPath = path.join(projectDir, LOCAL_SKILLS_PATH);

        // Check if local skills directory exists
        if (!(await fileExists(localSkillsPath))) {
          if (!options.quiet) {
            p.log.warn(
              "No local skills found. Run `cc init` or `cc edit` first.",
            );
          }
          process.exit(EXIT_CODES.SUCCESS);
        }

        if (!options.quiet) {
          s.start("Loading skills...");
        }

        const { matrix, sourcePath, isLocal } =
          await loadSkillsMatrixFromSource({
            sourceFlag: options.source,
            projectDir,
          });

        if (!options.quiet) {
          s.stop(
            pc.dim(
              `Loaded from ${isLocal ? "local" : "remote"}: ${sourcePath}`,
            ),
          );
        }

        // Build source skills map for lookup
        const sourceSkills: Record<string, { path: string }> = {};
        for (const [skillId, skill] of Object.entries(matrix.skills)) {
          if (!skill.local) {
            sourceSkills[skillId] = { path: skill.path };
          }
        }

        // Get local skill directories
        let skillDirs = await listDirectories(localSkillsPath);

        // Filter to specific skill if --skill flag provided
        if (options.skill) {
          skillDirs = skillDirs.filter((dir) => dir === options.skill);
          if (skillDirs.length === 0) {
            if (!options.quiet) {
              p.log.error(`Skill '${options.skill}' not found in local skills`);
            }
            process.exit(EXIT_CODES.ERROR);
          }
        }

        // Process each skill
        const results: SkillDiffResult[] = [];
        const skillsWithoutForkedFrom: string[] = [];

        for (const skillDirName of skillDirs) {
          const result = await diffSkill(
            localSkillsPath,
            skillDirName,
            sourcePath,
            sourceSkills,
          );
          results.push(result);

          if (!result.forkedFrom) {
            skillsWithoutForkedFrom.push(skillDirName);
          }
        }

        // Count skills with differences
        const skillsWithDiffs = results.filter((r) => r.hasDiff);

        // Output results
        if (!options.quiet) {
          console.log("");

          // Warn about skills without forked_from
          if (skillsWithoutForkedFrom.length > 0) {
            for (const skillName of skillsWithoutForkedFrom) {
              p.log.warn(
                `Skill '${skillName}' has no forked_from metadata - cannot compare`,
              );
            }
            console.log("");
          }

          // Check if any forked skills exist
          const forkedSkills = results.filter((r) => r.forkedFrom);

          if (forkedSkills.length === 0) {
            p.log.info("No forked skills to compare.");
          } else if (skillsWithDiffs.length === 0) {
            p.log.success(
              `All ${forkedSkills.length} forked skill(s) are up to date with source.`,
            );
          } else {
            // Show diffs
            for (const result of skillsWithDiffs) {
              console.log(
                pc.bold(
                  `\n=== ${result.skillDirName} (forked from ${result.forkedFrom?.skill_id}) ===\n`,
                ),
              );
              console.log(colorDiff(result.diffOutput));
            }

            console.log("");
            p.log.info(
              `Found differences in ${pc.yellow(String(skillsWithDiffs.length))} skill(s).`,
            );
          }

          console.log("");
        }

        // Exit with appropriate code
        if (skillsWithDiffs.length > 0) {
          process.exit(EXIT_CODES.ERROR);
        }
        process.exit(EXIT_CODES.SUCCESS);
      } catch (error) {
        if (!options.quiet) {
          s.stop(pc.red("Failed to compare skills"));
        }
        const message = error instanceof Error ? error.message : String(error);

        if (!options.quiet) {
          console.error(pc.red(`\nError: ${message}\n`));
        }
        process.exit(EXIT_CODES.ERROR);
      }
    },
  );
