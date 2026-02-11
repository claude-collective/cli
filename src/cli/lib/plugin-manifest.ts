import path from "path";
import { ensureDir, writeFile } from "../utils/fs";
import { DEFAULT_VERSION } from "../consts";
import type { PluginManifest, PluginAuthor } from "../../types";

const PLUGIN_DIR_NAME = ".claude-plugin";
const PLUGIN_MANIFEST_FILE = "plugin.json";
const SKILL_PLUGIN_PREFIX = "skill-";

export type SkillManifestOptions = {
  skillName: string;
  description?: string;
  author?: string;
  authorEmail?: string;
  version?: string;
  keywords?: string[];
};

export type StackManifestOptions = {
  stackName: string;
  description?: string;
  author?: string;
  authorEmail?: string;
  version?: string;
  keywords?: string[];
  hasSkills?: boolean;
  hasAgents?: boolean;
  hasHooks?: boolean;
};

function buildAuthor(name?: string, email?: string): PluginAuthor | undefined {
  if (!name) {
    return undefined;
  }
  const author: PluginAuthor = { name };
  if (email) {
    author.email = email;
  }
  return author;
}

export function generateSkillPluginManifest(options: SkillManifestOptions): PluginManifest {
  const manifest: PluginManifest = {
    name: `${SKILL_PLUGIN_PREFIX}${options.skillName}`,
    version: options.version ?? DEFAULT_VERSION,
    skills: "./skills/",
  };

  if (options.description) {
    manifest.description = options.description;
  }

  const author = buildAuthor(options.author, options.authorEmail);
  if (author) {
    manifest.author = author;
  }

  if (options.keywords && options.keywords.length > 0) {
    manifest.keywords = options.keywords;
  }

  return manifest;
}

export function generateStackPluginManifest(options: StackManifestOptions): PluginManifest {
  const manifest: PluginManifest = {
    name: options.stackName,
    version: options.version ?? DEFAULT_VERSION,
  };

  if (options.hasSkills) {
    manifest.skills = "./skills/";
  }

  if (options.description) {
    manifest.description = options.description;
  }

  const author = buildAuthor(options.author, options.authorEmail);
  if (author) {
    manifest.author = author;
  }

  if (options.keywords && options.keywords.length > 0) {
    manifest.keywords = options.keywords;
  }

  // Note: Claude Code plugins don't support agents field in manifest
  // Agents are discovered from ./agents/ directory automatically

  if (options.hasHooks) {
    manifest.hooks = "./hooks/hooks.json";
  }

  return manifest;
}

export async function writePluginManifest(
  outputDir: string,
  manifest: PluginManifest,
): Promise<string> {
  const pluginDir = path.join(outputDir, PLUGIN_DIR_NAME);
  const manifestPath = path.join(pluginDir, PLUGIN_MANIFEST_FILE);

  await ensureDir(pluginDir);

  const content = JSON.stringify(manifest, null, 2);
  await writeFile(manifestPath, content);

  return manifestPath;
}

export function getPluginDir(outputDir: string): string {
  return path.join(outputDir, PLUGIN_DIR_NAME);
}

export function getPluginManifestPath(outputDir: string): string {
  return path.join(outputDir, PLUGIN_DIR_NAME, PLUGIN_MANIFEST_FILE);
}
