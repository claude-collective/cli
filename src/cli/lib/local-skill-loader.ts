import { parse as parseYaml } from "yaml";
import path from "path";
import { directoryExists, listDirectories, fileExists, readFile } from "../utils/fs";
import { verbose, warn } from "../utils/logger";
import { LOCAL_SKILLS_PATH } from "../consts";
import { parseFrontmatter } from "./loader";
import type { ExtractedSkillMetadata, CategoryPath, SkillId } from "../types-matrix";
import { localRawMetadataSchema } from "./schemas";

const LOCAL_CATEGORY: CategoryPath = "local";
const LOCAL_AUTHOR = "@local";

type LocalRawMetadata = {
  cli_name: string;
  cli_description?: string;
  /** Original skill category from source (e.g., "framework", "styling", "api") */
  category?: CategoryPath;
  category_exclusive?: boolean;
  usage_guidance?: string;
  tags?: string[];
  compatible_with?: SkillId[];
  conflicts_with?: SkillId[];
  requires?: SkillId[];
  requires_setup?: SkillId[];
  provides_setup_for?: SkillId[];
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
  const metadataPath = path.join(skillDir, "metadata.yaml");
  const skillMdPath = path.join(skillDir, "SKILL.md");

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
      `Skipping local skill '${skillDirName}': Invalid metadata.yaml — ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
    return null;
  }

  const metadata = parsed.data as LocalRawMetadata;

  if (!metadata.cli_name) {
    verbose(`Skipping local skill '${skillDirName}': Missing required 'cli_name' in metadata.yaml`);
    return null;
  }

  const skillMdContent = await readFile(skillMdPath);
  const frontmatter = parseFrontmatter(skillMdContent);

  if (!frontmatter) {
    verbose(`Skipping local skill '${skillDirName}': Invalid SKILL.md frontmatter`);
    return null;
  }

  const relativePath = `${LOCAL_SKILLS_PATH}/${skillDirName}/`;
  const skillId = frontmatter.name;

  // Use category from metadata.yaml if available (preserved from source skill),
  // otherwise fall back to generic "local" category
  const category = metadata.category || LOCAL_CATEGORY;

  if (!metadata.category) {
    warn(
      `Local skill '${skillDirName}' has no category in metadata.yaml — defaulting to '${LOCAL_CATEGORY}' (will not appear in wizard domain views)`,
    );
  }

  const extracted: ExtractedSkillMetadata = {
    id: skillId,
    directoryPath: skillDirName,
    description: metadata.cli_description || frontmatter.description,
    usageGuidance: metadata.usage_guidance,
    category,
    categoryExclusive: metadata.category_exclusive ?? false,
    author: LOCAL_AUTHOR,
    tags: metadata.tags ?? [],
    compatibleWith: metadata.compatible_with ?? [],
    conflictsWith: metadata.conflicts_with ?? [],
    requires: metadata.requires ?? [],
    requiresSetup: metadata.requires_setup ?? [],
    providesSetupFor: metadata.provides_setup_for ?? [],
    path: relativePath,
    local: true,
    localPath: relativePath,
  };

  verbose(`Extracted local skill: ${skillId}`);
  return extracted;
}
