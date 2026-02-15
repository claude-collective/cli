import path from "path";

import { readFileSafe, writeFile } from "../../utils/fs";
import {
  PLUGIN_MANIFEST_DIR,
  PLUGIN_MANIFEST_FILE,
  DEFAULT_VERSION,
  MAX_PLUGIN_FILE_SIZE,
} from "../../consts";
import { pluginManifestSchema } from "../schemas";

export type VersionBumpType = "major" | "minor" | "patch";

function parseVersion(version: string): [number, number, number] {
  const parts = version.split(".").map(Number);
  return [parts[0] || 1, parts[1] || 0, parts[2] || 0];
}

export async function bumpPluginVersion(pluginDir: string, type: VersionBumpType): Promise<string> {
  const manifestPath = path.join(pluginDir, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE);
  const content = await readFileSafe(manifestPath, MAX_PLUGIN_FILE_SIZE);
  const manifest = pluginManifestSchema.parse(JSON.parse(content));

  const [major, minor, patch] = parseVersion(manifest.version || DEFAULT_VERSION);

  let newVersion: string;
  switch (type) {
    case "major":
      newVersion = `${major + 1}.0.0`;
      break;
    case "minor":
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case "patch":
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }

  manifest.version = newVersion;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  return newVersion;
}

export async function getPluginVersion(pluginDir: string): Promise<string> {
  const manifestPath = path.join(pluginDir, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE);
  const content = await readFileSafe(manifestPath, MAX_PLUGIN_FILE_SIZE);
  const manifest = pluginManifestSchema.parse(JSON.parse(content));
  return manifest.version || DEFAULT_VERSION;
}
