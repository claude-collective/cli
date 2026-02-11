import path from "path";
import os from "os";
import { fileExists, readFile, glob } from "../utils/fs";
import { verbose } from "../utils/logger";
import { CLAUDE_DIR, PLUGINS_SUBDIR, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE } from "../consts";
import type { MergedSkillsMatrix, PluginManifest, SkillId } from "../types";
import { pluginManifestSchema } from "./schemas";

export function getUserPluginsDir(): string {
  return path.join(os.homedir(), CLAUDE_DIR, PLUGINS_SUBDIR);
}

export function getCollectivePluginDir(projectDir?: string): string {
  const dir = projectDir ?? process.cwd();
  return path.join(dir, CLAUDE_DIR, PLUGINS_SUBDIR, "claude-collective");
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
    const content = await readFile(manifestPath);
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

  // Build alias-to-id and id-based lookups
  // Boundary cast: Object.entries(matrix.skills) returns [string, ResolvedSkill][] but keys are SkillId
  const aliasToId = new Map<string, SkillId>();
  for (const [id, skill] of Object.entries(matrix.skills)) {
    if (!skill) continue;
    if (skill.displayName) {
      aliasToId.set(skill.displayName.toLowerCase(), id as SkillId);
    }
  }

  // Boundary cast: Object.entries(matrix.skills) returns [string, ResolvedSkill][] but keys are SkillId
  const dirToId = new Map<string, SkillId>();
  for (const [id] of Object.entries(matrix.skills)) {
    const idParts = id.split("/");
    const lastPart = idParts[idParts.length - 1];
    if (lastPart) {
      dirToId.set(lastPart.toLowerCase(), id as SkillId);
    }
  }

  for (const skillFile of skillFiles) {
    const fullPath = path.join(pluginSkillsDir, skillFile);
    const content = await readFile(fullPath);

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const nameMatch = frontmatter.match(/^name:\s*["']?(.+?)["']?\s*$/m);
      if (nameMatch) {
        const skillName = nameMatch[1].trim();
        // Try direct match as skill ID first, then alias lookup
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
