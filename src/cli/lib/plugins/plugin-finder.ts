import os from "os";
import path from "path";

import { last, zip } from "remeda";

import { fileExists, readFileSafe, readFile, glob } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import {
  CLAUDE_DIR,
  DEFAULT_PLUGIN_NAME,
  MAX_PLUGIN_FILE_SIZE,
  PLUGINS_SUBDIR,
  PLUGIN_MANIFEST_DIR,
  PLUGIN_MANIFEST_FILE,
} from "../../consts";
import type { MergedSkillsMatrix, PluginManifest, ResolvedSkill, SkillId } from "../../types";
import { typedEntries } from "../../utils/typed-object";
import { pluginManifestSchema } from "../schemas";

const MAX_SKILL_NAME_LENGTH = 100;

export function getUserPluginsDir(): string {
  return path.join(os.homedir(), CLAUDE_DIR, PLUGINS_SUBDIR);
}

export function getCollectivePluginDir(projectDir?: string): string {
  const dir = projectDir ?? process.cwd();
  return path.join(dir, CLAUDE_DIR, PLUGINS_SUBDIR, DEFAULT_PLUGIN_NAME);
}

export function getProjectPluginsDir(projectDir?: string): string {
  const dir = projectDir ?? process.cwd();
  return path.join(dir, CLAUDE_DIR, PLUGINS_SUBDIR);
}

export function getPluginSkillsDir(pluginDir: string): string {
  return path.join(pluginDir, "skills");
}

export function getPluginAgentsDir(pluginDir: string): string {
  return path.join(pluginDir, "agents");
}

export function getPluginManifestPath(pluginDir: string): string {
  return path.join(pluginDir, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE);
}

export async function readPluginManifest(pluginDir: string): Promise<PluginManifest | null> {
  const manifestPath = getPluginManifestPath(pluginDir);

  if (!(await fileExists(manifestPath))) {
    verbose(`  No manifest at ${manifestPath}`);
    return null;
  }

  try {
    const content = await readFileSafe(manifestPath, MAX_PLUGIN_FILE_SIZE);
    const manifest = pluginManifestSchema.parse(JSON.parse(content));

    if (!manifest.name || typeof manifest.name !== "string") {
      verbose(`  Invalid manifest at ${manifestPath}: missing name`);
      return null;
    }

    return manifest;
  } catch (error) {
    verbose(`  Failed to parse manifest at ${manifestPath}: ${error}`);
    return null;
  }
}

export async function getPluginSkillIds(
  pluginSkillsDir: string,
  matrix: MergedSkillsMatrix,
): Promise<SkillId[]> {
  const skillFiles = await glob("**/SKILL.md", pluginSkillsDir);
  const skillIds: SkillId[] = [];

  const aliasToId = new Map<string, SkillId>();
  for (const [id, skill] of typedEntries<SkillId, ResolvedSkill>(matrix.skills)) {
    if (!skill) continue;
    if (skill.displayName) {
      aliasToId.set(skill.displayName.toLowerCase(), id);
    }
  }

  const dirToId = new Map<string, SkillId>();
  for (const [id] of typedEntries<SkillId, ResolvedSkill>(matrix.skills)) {
    const idParts = id.split("/");
    const lastPart = last(idParts);
    if (lastPart) {
      dirToId.set(lastPart.toLowerCase(), id);
    }
  }

  const fileContents = await Promise.all(
    skillFiles.map((skillFile) => readFile(path.join(pluginSkillsDir, skillFile))),
  );

  for (const [skillFile, content] of zip(skillFiles, fileContents)) {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const nameMatch = frontmatter.match(/^name:\s*["']?(.+?)["']?\s*$/m);
      if (nameMatch) {
        const skillName = nameMatch[1].trim();
        if (skillName.length === 0) {
          warn(`Skipping plugin skill '${skillFile}': empty name in frontmatter`);
          continue;
        }
        if (skillName.length > MAX_SKILL_NAME_LENGTH) {
          warn(
            `Skipping plugin skill '${skillFile}': name exceeds ${MAX_SKILL_NAME_LENGTH} characters`,
          );
          continue;
        }
        if (matrix.skills[skillName as SkillId]) {
          skillIds.push(skillName as SkillId);
          continue;
        }
        const skillId = aliasToId.get(skillName.toLowerCase());
        if (skillId) {
          skillIds.push(skillId);
          continue;
        }
      }
    }

    const dirPath = path.dirname(skillFile);
    const dirName = path.basename(dirPath);
    const skillId = dirToId.get(dirName.toLowerCase());
    if (skillId) {
      skillIds.push(skillId);
    }
  }

  return skillIds;
}
