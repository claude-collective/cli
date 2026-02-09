import path from "path";
import { copy, ensureDir, directoryExists, glob } from "../utils/fs";
import { verbose } from "../utils/logger";
import type { Marketplace, MarketplacePlugin } from "../../types";

export interface FetchSkillsOptions {
  forceRefresh?: boolean;
}

function resolvePluginSource(plugin: MarketplacePlugin, _marketplace: Marketplace): string {
  if (typeof plugin.source === "object" && plugin.source.url) {
    return plugin.source.url;
  }

  if (typeof plugin.source === "string") {
    return plugin.source;
  }

  if (typeof plugin.source === "object" && plugin.source.repo) {
    const ref = plugin.source.ref ? `#${plugin.source.ref}` : "";
    return `github:${plugin.source.repo}${ref}`;
  }

  return plugin.name;
}

export async function fetchSkills(
  skillIds: string[],
  marketplace: Marketplace,
  outputDir: string,
  sourcePath: string,
  _options: FetchSkillsOptions = {},
): Promise<string[]> {
  const skillsOutputDir = path.join(outputDir, "skills");
  await ensureDir(skillsOutputDir);

  const copiedSkills: string[] = [];

  for (const skillId of skillIds) {
    const pluginName = `skill-${skillId}`;
    const plugin = marketplace.plugins.find((p) => p.name === pluginName);

    if (plugin) {
      verbose(`Found skill plugin in marketplace: ${pluginName}`);
      const pluginSource = resolvePluginSource(plugin, marketplace);
      verbose(`Plugin source: ${pluginSource}`);
    }

    const skillSourceDir = path.join(sourcePath, "src", "skills");

    const skillPath = await findSkillPath(skillSourceDir, skillId);

    if (!skillPath) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    const relativePath = path.relative(skillSourceDir, skillPath);
    const destPath = path.join(skillsOutputDir, relativePath);

    await ensureDir(path.dirname(destPath));
    await copy(skillPath, destPath);
    copiedSkills.push(skillId);
    verbose(`Copied skill: ${skillId} -> ${destPath}`);
  }

  return copiedSkills;
}

async function findSkillPath(baseDir: string, skillId: string): Promise<string | null> {
  if (!(await directoryExists(baseDir))) {
    verbose(`Skills base directory not found: ${baseDir}`);
    return null;
  }

  if (skillId.includes("/")) {
    const fullPath = path.join(baseDir, skillId);
    if (await directoryExists(fullPath)) {
      return fullPath;
    }
    const pathWithoutAuthor = skillId.replace(/\s*\(@\w+\)$/, "");
    const pathWithoutAuthorFull = path.join(baseDir, pathWithoutAuthor);
    if (await directoryExists(pathWithoutAuthorFull)) {
      return pathWithoutAuthorFull;
    }
  }

  const escapedSkillId = skillId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = await glob(`**/${escapedSkillId}*/SKILL.md`, baseDir);

  if (matches.length > 0) {
    return path.join(baseDir, path.dirname(matches[0]));
  }

  const skillNameWithoutAuthor = skillId.replace(/\s*\(@\w+\)$/, "");
  if (skillNameWithoutAuthor !== skillId) {
    const escapedName = skillNameWithoutAuthor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchesWithoutAuthor = await glob(`**/${escapedName}*/SKILL.md`, baseDir);
    if (matchesWithoutAuthor.length > 0) {
      return path.join(baseDir, path.dirname(matchesWithoutAuthor[0]));
    }
  }

  return null;
}
