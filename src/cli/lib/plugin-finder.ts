import path from "path";
import os from "os";
import { fileExists, readFile, glob } from "../utils/fs";
import { verbose } from "../utils/logger";
import {
  CLAUDE_DIR,
  PLUGINS_SUBDIR,
  PLUGIN_MANIFEST_DIR,
  PLUGIN_MANIFEST_FILE,
} from "../consts";
import type { PluginManifest } from "../../types";
import type { MergedSkillsMatrix } from "../types-matrix";

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

export async function readPluginManifest(
  pluginDir: string,
): Promise<PluginManifest | null> {
  const manifestPath = getPluginManifestPath(pluginDir);

  if (!(await fileExists(manifestPath))) {
    verbose(`  No manifest at ${manifestPath}`);
    return null;
  }

  try {
    const content = await readFile(manifestPath);
    const manifest = JSON.parse(content) as PluginManifest;

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
): Promise<string[]> {
  const skillFiles = await glob("**/SKILL.md", pluginSkillsDir);
  const skillIds: string[] = [];

  const nameToId = new Map<string, string>();
  for (const [id, skill] of Object.entries(matrix.skills)) {
    nameToId.set(skill.name.toLowerCase(), id);
    if (skill.alias) {
      nameToId.set(skill.alias.toLowerCase(), id);
    }
  }

  const dirToId = new Map<string, string>();
  for (const [id, skill] of Object.entries(matrix.skills)) {
    const baseName = skill.name.toLowerCase().replace(/\s+/g, "-");
    dirToId.set(baseName, id);

    const idParts = id.split("/");
    const lastPart = idParts[idParts.length - 1];
    if (lastPart) {
      dirToId.set(lastPart.toLowerCase(), id);
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
        const skillId = nameToId.get(skillName.toLowerCase());
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
