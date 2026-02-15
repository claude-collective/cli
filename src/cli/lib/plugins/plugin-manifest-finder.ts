import path from "path";

import { PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE } from "../../consts";
import { fileExists } from "../../utils/fs";

// Walks up from startDir looking for the plugin manifest file.
export async function findPluginManifest(startDir: string): Promise<string | null> {
  let currentDir = startDir;
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const manifestPath = path.join(currentDir, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE);
    if (await fileExists(manifestPath)) {
      return manifestPath;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}
