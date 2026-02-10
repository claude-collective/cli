import { createHash } from "crypto";
import path from "path";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import { readFile, writeFile, glob, fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { versionedMetadataSchema } from "./schemas";

const HASH_PREFIX_LENGTH = 7;

const METADATA_FILE_NAME = "metadata.yaml";

const HASHABLE_FILES = ["SKILL.md", "reference.md"];

const HASHABLE_DIRS = ["examples", "scripts"];

interface VersionedMetadata {
  version: number;
  content_hash?: string;
  updated?: string;
  [key: string]: unknown;
}

export interface VersionCheckResult {
  skillPath: string;
  previousVersion: number;
  newVersion: number;
  previousHash: string | undefined;
  newHash: string;
  changed: boolean;
}

export function getCurrentDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function hashString(content: string): string {
  const hash = createHash("sha256");
  hash.update(content);
  return hash.digest("hex").slice(0, HASH_PREFIX_LENGTH);
}

export async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return hashString(content);
}

export async function hashSkillFolder(skillPath: string): Promise<string> {
  const contents: string[] = [];

  for (const fileName of HASHABLE_FILES) {
    const filePath = path.join(skillPath, fileName);
    if (await fileExists(filePath)) {
      const content = await readFile(filePath);
      contents.push(`${fileName}:${content}`);
    }
  }

  for (const dirName of HASHABLE_DIRS) {
    const dirPath = path.join(skillPath, dirName);
    if (await fileExists(dirPath)) {
      const files = await glob("**/*", dirPath);
      for (const file of files.sort()) {
        const filePath = path.join(dirPath, file);
        const content = await readFile(filePath);
        contents.push(`${dirName}/${file}:${content}`);
      }
    }
  }

  const combined = contents.join("\n---\n");
  return hashString(combined);
}

async function readMetadata(
  skillPath: string,
): Promise<{ metadata: VersionedMetadata; schemaComment: string }> {
  const metadataPath = path.join(skillPath, METADATA_FILE_NAME);
  const rawContent = await readFile(metadataPath);

  const lines = rawContent.split("\n");
  let schemaComment = "";
  let yamlContent = rawContent;

  if (lines[0]?.startsWith("# yaml-language-server:")) {
    schemaComment = lines[0] + "\n";
    yamlContent = lines.slice(1).join("\n");
  }

  const raw = parseYaml(yamlContent);
  const result = versionedMetadataSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(
      `Invalid metadata.yaml at ${skillPath}: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }

  const metadata = result.data as VersionedMetadata;
  return { metadata, schemaComment };
}

async function writeMetadata(
  skillPath: string,
  metadata: VersionedMetadata,
  schemaComment: string,
): Promise<void> {
  const metadataPath = path.join(skillPath, METADATA_FILE_NAME);
  const yamlContent = stringifyYaml(metadata, { lineWidth: 0 });
  await writeFile(metadataPath, schemaComment + yamlContent);
}

export async function versionSkill(skillPath: string): Promise<VersionCheckResult> {
  const newHash = await hashSkillFolder(skillPath);

  const { metadata, schemaComment } = await readMetadata(skillPath);
  const previousVersion = metadata.version;
  const previousHash = metadata.content_hash;

  const changed = previousHash !== newHash;

  if (changed) {
    metadata.version = previousVersion + 1;
    metadata.content_hash = newHash;
    metadata.updated = getCurrentDate();

    await writeMetadata(skillPath, metadata, schemaComment);

    verbose(`  Version bumped: ${skillPath} (v${previousVersion} -> v${metadata.version})`);
  }

  return {
    skillPath,
    previousVersion,
    newVersion: changed ? previousVersion + 1 : previousVersion,
    previousHash,
    newHash,
    changed,
  };
}

export async function versionAllSkills(skillsDir: string): Promise<VersionCheckResult[]> {
  const results: VersionCheckResult[] = [];

  const metadataFiles = await glob("**/metadata.yaml", skillsDir);

  for (const metadataFile of metadataFiles) {
    const skillPath = path.join(skillsDir, path.dirname(metadataFile));

    try {
      const result = await versionSkill(skillPath);
      results.push(result);
    } catch (error) {
      console.warn(`  Warning: Failed to version skill at ${skillPath}: ${error}`);
    }
  }

  return results;
}

export function printVersionResults(results: VersionCheckResult[]): void {
  const changed = results.filter((r) => r.changed);
  const unchanged = results.filter((r) => !r.changed);

  if (changed.length > 0) {
    console.log(`\n  Version Updates:`);
    for (const result of changed) {
      const skillName = path.basename(result.skillPath);
      console.log(`    ✓ ${skillName}: v${result.previousVersion} -> v${result.newVersion}`);
    }
  }

  console.log(`\n  Summary: ${changed.length} updated, ${unchanged.length} unchanged`);
}
