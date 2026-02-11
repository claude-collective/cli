/**
 * Find the nearest plugin manifest by walking up the directory tree.
 */
import path from "path";
import { PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE } from "../../consts";
import { fileExists } from "../../utils/fs";

/**
 * Walk up from `startDir` to the filesystem root, looking for
 * `PLUGIN_MANIFEST_DIR/PLUGIN_MANIFEST_FILE` (e.g. `.claude-plugin/plugin.json`).
 *
 * Returns the full path to the manifest file, or `null` if not found.
 */
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
