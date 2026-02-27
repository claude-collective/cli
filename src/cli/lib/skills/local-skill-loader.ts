import { parse as parseYaml } from "yaml";
import path from "path";
import { directoryExists, listDirectories, fileExists, readFile } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import { LOCAL_SKILLS_PATH, STANDARD_FILES } from "../../consts";
import { parseFrontmatter } from "../loading";
import type { CategoryPath, ExtractedSkillMetadata, SkillId } from "../../types";
import { formatZodErrors, localRawMetadataSchema } from "../schemas";
import { LOCAL_DEFAULTS, METADATA_KEYS } from "../metadata-keys";

type LocalRawMetadata = {
  displayName: string;
  cliDescription?: string;
  /** Original skill category from source (e.g., "web-framework", "web-styling", "api-api") */
  category?: CategoryPath;
  usageGuidance?: string;
  tags?: string[];
};

export type LocalSkillDiscoveryResult = {
  skills: ExtractedSkillMetadata[];
  localSkillsPath: string;
};

export async function discoverLocalSkills(
  projectDir: string,
): Promise<LocalSkillDiscoveryResult | null> {
  const localSkillsPath = path.join(projectDir, LOCAL_SKILLS_PATH);

  if (!(await directoryExists(localSkillsPath))) {
    verbose(`Local skills directory not found: ${localSkillsPath}`);
    return null;
  }

  const skills: ExtractedSkillMetadata[] = [];
  const skillDirs = await listDirectories(localSkillsPath);

  for (const skillDirName of skillDirs) {
    const skill = await extractLocalSkill(localSkillsPath, skillDirName);
    if (skill) {
      skills.push(skill);
    }
  }

  verbose(`Discovered ${skills.length} local skills from ${localSkillsPath}`);

  return {
    skills,
    localSkillsPath,
  };
}

async function extractLocalSkill(
  localSkillsPath: string,
  skillDirName: string,
): Promise<ExtractedSkillMetadata | null> {
  const skillDir = path.join(localSkillsPath, skillDirName);
  const metadataPath = path.join(skillDir, STANDARD_FILES.METADATA_YAML);
  const skillMdPath = path.join(skillDir, STANDARD_FILES.SKILL_MD);

  if (!(await fileExists(metadataPath))) {
    verbose(`Skipping local skill '${skillDirName}': No metadata.yaml found`);
    return null;
  }

  if (!(await fileExists(skillMdPath))) {
    verbose(`Skipping local skill '${skillDirName}': No SKILL.md found`);
    return null;
  }

  const metadataContent = await readFile(metadataPath);
  const parsed = localRawMetadataSchema.safeParse(parseYaml(metadataContent));

  if (!parsed.success) {
    verbose(
      `Skipping local skill '${skillDirName}': invalid metadata.yaml — ${formatZodErrors(parsed.error.issues)}`,
    );
    return null;
  }

  const metadata = parsed.data as LocalRawMetadata;

  if (!metadata.displayName) {
    throw new Error(
      `Local skill '${skillDirName}' is missing required '${METADATA_KEYS.DISPLAY_NAME}' field in metadata.yaml`,
    );
  }

  const skillMdContent = await readFile(skillMdPath);
  const frontmatter = parseFrontmatter(skillMdContent, skillMdPath);

  if (!frontmatter) {
    verbose(`Skipping local skill '${skillDirName}': invalid SKILL.md frontmatter`);
    return null;
  }

  const relativePath = `${LOCAL_SKILLS_PATH}/${skillDirName}/`;
  const skillId = frontmatter.name;

  // Use category from metadata.yaml if available (preserved from source skill),
  // otherwise fall back to generic "local" category
  const category = metadata.category || LOCAL_DEFAULTS.CATEGORY;

  if (!metadata.category) {
    warn(
      `Local skill '${skillDirName}' has no category in metadata.yaml — defaulting to '${LOCAL_DEFAULTS.CATEGORY}' (will not appear in wizard domain views)`,
    );
  }

  const extracted: ExtractedSkillMetadata = {
    id: skillId,
    directoryPath: skillDirName,
    description: metadata.cliDescription || frontmatter.description,
    usageGuidance: metadata.usageGuidance,
    category,
    author: LOCAL_DEFAULTS.AUTHOR,
    tags: metadata.tags ?? [],
    path: relativePath,
    local: true,
    localPath: relativePath,
  };

  verbose(`Extracted local skill: ${skillId}`);
  return extracted;
}
