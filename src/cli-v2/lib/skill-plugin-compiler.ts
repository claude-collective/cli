import path from "path";
import { parse as parseYaml } from "yaml";
import {
  readFile,
  writeFile,
  ensureDir,
  glob,
  fileExists,
  copy,
} from "../utils/fs";
import { verbose } from "../utils/logger";
import {
  generateSkillPluginManifest,
  writePluginManifest,
  getPluginManifestPath,
} from "./plugin-manifest";
import { hashSkillFolder, getCurrentDate } from "./versioning";
import { DEFAULT_VERSION } from "../consts";
import type {
  PluginManifest,
  SkillFrontmatter,
  SkillMetadataConfig,
} from "../../types";

export interface SkillPluginOptions {
  skillPath: string;
  outputDir: string;
  skillName?: string;
}

export interface CompiledSkillPlugin {
  pluginPath: string;
  manifest: PluginManifest;
  skillName: string;
}

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

const SKILL_FILES = ["SKILL.md", "reference.md"] as const;

const SKILL_DIRS = ["examples", "scripts"] as const;

function parseFrontmatter(content: string): SkillFrontmatter | null {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return null;

  const yamlContent = match[1];
  const frontmatter = parseYaml(yamlContent) as SkillFrontmatter;

  if (!frontmatter.name || !frontmatter.description) return null;
  return frontmatter;
}

function sanitizeSkillName(name: string): string {
  return name.replace(/\+/g, "-");
}

function parseMajorVersion(version: string): number {
  const match = version.match(/^(\d+)\./);
  return match ? parseInt(match[1], 10) : 1;
}

function bumpMajorVersion(version: string): string {
  const major = parseMajorVersion(version);
  return `${major + 1}.0.0`;
}

const CONTENT_HASH_FILE = ".content-hash";

async function readExistingManifest(
  pluginDir: string,
): Promise<{ version: string; contentHash: string | undefined } | null> {
  const manifestPath = getPluginManifestPath(pluginDir);

  if (!(await fileExists(manifestPath))) {
    return null;
  }

  try {
    const content = await readFile(manifestPath);
    const manifest = JSON.parse(content) as PluginManifest;

    const hashFilePath = manifestPath.replace("plugin.json", CONTENT_HASH_FILE);
    let contentHash: string | undefined;
    if (await fileExists(hashFilePath)) {
      contentHash = (await readFile(hashFilePath)).trim();
    }

    return {
      version: manifest.version ?? DEFAULT_VERSION,
      contentHash,
    };
  } catch {
    return null;
  }
}

async function determineVersion(
  skillPath: string,
  pluginDir: string,
): Promise<{ version: string; contentHash: string }> {
  const newHash = await hashSkillFolder(skillPath);

  const existing = await readExistingManifest(pluginDir);

  if (!existing) {
    return {
      version: DEFAULT_VERSION,
      contentHash: newHash,
    };
  }

  if (existing.contentHash !== newHash) {
    return {
      version: bumpMajorVersion(existing.version),
      contentHash: newHash,
    };
  }

  return {
    version: existing.version,
    contentHash: newHash,
  };
}

export function extractSkillName(skillPath: string): string {
  const dirName = path.basename(skillPath);
  const withoutAuthor = dirName.replace(/\s*\(@\w+\)$/, "").trim();
  return sanitizeSkillName(withoutAuthor);
}

export function extractCategory(
  skillPath: string,
  skillsRoot: string,
): string | undefined {
  const relativePath = path.relative(skillsRoot, skillPath);
  const parts = relativePath.split(path.sep);
  return parts.length > 1 ? parts[0] : undefined;
}

export function extractAuthor(skillPath: string): string | undefined {
  const dirName = path.basename(skillPath);
  const match = dirName.match(/\(@(\w+)\)$/);
  return match ? match[1] : undefined;
}

async function readSkillMetadata(
  skillPath: string,
): Promise<SkillMetadataConfig | null> {
  const metadataPath = path.join(skillPath, "metadata.yaml");

  if (!(await fileExists(metadataPath))) {
    return null;
  }

  try {
    const content = await readFile(metadataPath);
    const lines = content.split("\n");
    const yamlContent = lines[0]?.startsWith("# yaml-language-server:")
      ? lines.slice(1).join("\n")
      : content;

    return parseYaml(yamlContent) as SkillMetadataConfig;
  } catch {
    return null;
  }
}

function generateReadme(
  skillName: string,
  frontmatter: SkillFrontmatter,
  metadata: SkillMetadataConfig | null,
): string {
  const lines: string[] = [];

  lines.push(`# ${skillName}`);
  lines.push("");
  lines.push(frontmatter.description);
  lines.push("");

  if (metadata?.tags && metadata.tags.length > 0) {
    lines.push("## Tags");
    lines.push("");
    lines.push(metadata.tags.map((t) => `\`${t}\``).join(" "));
    lines.push("");
  }

  lines.push("## Installation");
  lines.push("");
  lines.push("Add this plugin to your Claude Code configuration:");
  lines.push("");
  lines.push("```json");
  lines.push(`{`);
  lines.push(`  "plugins": ["skill-${skillName}"]`);
  lines.push(`}`);
  lines.push("```");
  lines.push("");

  lines.push("## Usage");
  lines.push("");
  lines.push(`This skill is automatically available when installed.`);
  if (metadata?.requires && metadata.requires.length > 0) {
    lines.push("");
    lines.push("**Requires:** " + metadata.requires.join(", "));
  }
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push("*Generated by Claude Collective skill-plugin-compiler*");
  lines.push("");

  return lines.join("\n");
}

export async function compileSkillPlugin(
  options: SkillPluginOptions,
): Promise<CompiledSkillPlugin> {
  const { skillPath, outputDir, skillName: overrideName } = options;

  const skillName = overrideName ?? extractSkillName(skillPath);
  const author = extractAuthor(skillPath);

  verbose(`Compiling skill plugin: ${skillName} from ${skillPath}`);

  const skillMdPath = path.join(skillPath, "SKILL.md");
  if (!(await fileExists(skillMdPath))) {
    throw new Error(
      `Skill '${skillName}' is missing required SKILL.md file. Expected at: ${skillMdPath}`,
    );
  }

  const skillMdContent = await readFile(skillMdPath);
  const frontmatter = parseFrontmatter(skillMdContent);

  if (!frontmatter) {
    throw new Error(
      `Skill '${skillName}' has invalid or missing YAML frontmatter in SKILL.md. ` +
        `Required fields: 'name' and 'description'. File: ${skillMdPath}`,
    );
  }

  const metadata = await readSkillMetadata(skillPath);

  const pluginDir = path.join(outputDir, `skill-${skillName}`);
  const skillsDir = path.join(pluginDir, "skills", skillName);

  await ensureDir(pluginDir);
  await ensureDir(skillsDir);

  const { version, contentHash } = await determineVersion(skillPath, pluginDir);

  const manifest = generateSkillPluginManifest({
    skillName,
    description: frontmatter.description,
    author: author ? `@${author}` : metadata?.author,
    version,
    keywords: metadata?.tags,
  });

  await writePluginManifest(pluginDir, manifest);

  const hashFilePath = getPluginManifestPath(pluginDir).replace(
    "plugin.json",
    CONTENT_HASH_FILE,
  );
  await writeFile(hashFilePath, contentHash);

  verbose(`  Wrote plugin.json for ${skillName} (v${version})`);

  await writeFile(path.join(skillsDir, "SKILL.md"), skillMdContent);
  verbose(`  Copied SKILL.md`);

  for (const fileName of SKILL_FILES) {
    if (fileName === "SKILL.md") continue;

    const sourcePath = path.join(skillPath, fileName);
    if (await fileExists(sourcePath)) {
      const content = await readFile(sourcePath);
      await writeFile(path.join(skillsDir, fileName), content);
      verbose(`  Copied ${fileName}`);
    }
  }

  for (const dirName of SKILL_DIRS) {
    const sourceDir = path.join(skillPath, dirName);
    if (await fileExists(sourceDir)) {
      await copy(sourceDir, path.join(skillsDir, dirName));
      verbose(`  Copied ${dirName}/`);
    }
  }

  const readme = generateReadme(skillName, frontmatter, metadata);
  await writeFile(path.join(pluginDir, "README.md"), readme);
  verbose(`  Generated README.md`);

  return {
    pluginPath: pluginDir,
    manifest,
    skillName,
  };
}

export async function compileAllSkillPlugins(
  skillsDir: string,
  outputDir: string,
): Promise<CompiledSkillPlugin[]> {
  const results: CompiledSkillPlugin[] = [];

  const skillMdFiles = await glob("**/SKILL.md", skillsDir);

  const skillNameMap = new Map<string, string[]>();
  for (const skillMdFile of skillMdFiles) {
    const skillPath = path.join(skillsDir, path.dirname(skillMdFile));
    const baseName = extractSkillName(skillPath);
    const existing = skillNameMap.get(baseName) ?? [];
    existing.push(skillPath);
    skillNameMap.set(baseName, existing);
  }

  const collidingNames = new Set<string>();
  for (const [name, paths] of skillNameMap.entries()) {
    if (paths.length > 1) {
      collidingNames.add(name);
      verbose(`Name collision detected for "${name}": ${paths.length} skills`);
    }
  }

  for (const skillMdFile of skillMdFiles) {
    const skillPath = path.join(skillsDir, path.dirname(skillMdFile));
    const baseName = extractSkillName(skillPath);

    let skillName = baseName;
    if (collidingNames.has(baseName)) {
      const category = extractCategory(skillPath, skillsDir);
      if (category) {
        skillName = `${category}-${baseName}`;
      }
    }

    try {
      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
        skillName,
      });
      results.push(result);
      console.log(`  [OK] skill-${result.skillName}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(
        `  [WARN] Failed to compile skill 'skill-${skillName}' from ${skillPath}: ${errorMessage}`,
      );
    }
  }

  return results;
}

export function printCompilationSummary(results: CompiledSkillPlugin[]): void {
  console.log(`\nCompiled ${results.length} skill plugins:`);
  for (const result of results) {
    console.log(`  - skill-${result.skillName} (v${result.manifest.version})`);
  }
}
