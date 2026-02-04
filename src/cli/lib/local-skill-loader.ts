import { parse as parseYaml } from "yaml";
import path from "path";
import {
  directoryExists,
  listDirectories,
  fileExists,
  readFile,
} from "../utils/fs";
import { verbose } from "../utils/logger";
import { LOCAL_SKILLS_PATH } from "../consts";
import { parseFrontmatter } from "./loader";
import type { ExtractedSkillMetadata } from "../types-matrix";

const LOCAL_CATEGORY = "local";
const LOCAL_AUTHOR = "@local";

interface LocalRawMetadata {
  cli_name: string;
  cli_description?: string;
}

export interface LocalSkillDiscoveryResult {
  skills: ExtractedSkillMetadata[];
  localSkillsPath: string;
}

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
  const metadata = parseYaml(metadataContent) as LocalRawMetadata;

  if (!metadata.cli_name) {
    verbose(
      `Skipping local skill '${skillDirName}': Missing required 'cli_name' in metadata.yaml`,
    );
    return null;
  }

  const skillMdContent = await readFile(skillMdPath);
  const frontmatter = parseFrontmatter(skillMdContent);

  if (!frontmatter) {
    verbose(
      `Skipping local skill '${skillDirName}': Invalid SKILL.md frontmatter`,
    );
    return null;
  }

  const relativePath = `${LOCAL_SKILLS_PATH}/${skillDirName}/`;
  const skillId = frontmatter.name;

  const extracted: ExtractedSkillMetadata = {
    id: skillId,
    directoryPath: skillDirName,
    name: `${metadata.cli_name} ${LOCAL_AUTHOR}`,
    description: metadata.cli_description || frontmatter.description,
    usageGuidance: undefined,
    category: LOCAL_CATEGORY,
    categoryExclusive: false,
    author: LOCAL_AUTHOR,
    tags: [],
    compatibleWith: [],
    conflictsWith: [],
    requires: [],
    requiresSetup: [],
    providesSetupFor: [],
    path: relativePath,
    local: true,
    localPath: relativePath,
  };

  verbose(`Extracted local skill: ${skillId}`);
  return extracted;
}
