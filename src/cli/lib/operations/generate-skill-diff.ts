import path from "path";
import chalk from "chalk";
import { createTwoFilesPatch } from "diff";
import { readForkedFromMetadata, type ForkedFromMetadata } from "../skills/index.js";
import { fileExists, readFile } from "../../utils/fs.js";
import { LOCAL_SKILLS_PATH, STANDARD_FILES } from "../../consts.js";

export type SkillDiffResult = {
  skillDirName: string;
  forkedFrom: ForkedFromMetadata | null;
  hasDiff: boolean;
  diffOutput: string;
};

/**
 * Generates a unified diff between a local skill and its source version.
 *
 * Reads forkedFrom metadata to find the original skill ID, locates the source
 * SKILL.md, and produces a unified diff patch.
 */
export async function generateSkillDiff(
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

  const sourceSkill = sourceSkills[forkedFrom.skillId];

  if (!sourceSkill) {
    return {
      skillDirName,
      forkedFrom,
      hasDiff: false,
      diffOutput: `Source skill '${forkedFrom.skillId}' no longer exists`,
    };
  }

  const sourceSkillMdPath = path.join(sourcePath, "src", sourceSkill.path, STANDARD_FILES.SKILL_MD);

  if (!(await fileExists(sourceSkillMdPath))) {
    return {
      skillDirName,
      forkedFrom,
      hasDiff: false,
      diffOutput: `Source ${STANDARD_FILES.SKILL_MD} not found at ${sourceSkillMdPath}`,
    };
  }

  const sourceContent = await readFile(sourceSkillMdPath);

  const localSkillMdPath = path.join(skillDir, STANDARD_FILES.SKILL_MD);

  if (!(await fileExists(localSkillMdPath))) {
    return {
      skillDirName,
      forkedFrom,
      hasDiff: false,
      diffOutput: `Local ${STANDARD_FILES.SKILL_MD} not found at ${localSkillMdPath}`,
    };
  }

  const localContent = await readFile(localSkillMdPath);

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

/**
 * Colorizes a unified diff string for terminal display.
 * Applies chalk formatting: bold for file headers, green for additions,
 * red for removals, cyan for hunk headers.
 */
export function formatColoredDiff(diffText: string): string {
  return diffText
    .split("\n")
    .map((line) => {
      if (line.startsWith("+++") || line.startsWith("---")) {
        return chalk.bold(line);
      }
      if (line.startsWith("+")) {
        return chalk.green(line);
      }
      if (line.startsWith("-")) {
        return chalk.red(line);
      }
      if (line.startsWith("@@")) {
        return chalk.cyan(line);
      }
      return line;
    })
    .join("\n");
}
