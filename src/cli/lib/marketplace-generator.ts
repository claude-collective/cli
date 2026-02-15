import path from "path";
import { sortBy } from "remeda";

import { MAX_PLUGIN_FILE_SIZE } from "../consts";
import { getErrorMessage } from "../utils/errors";
import { readFileSafe, writeFile, glob, ensureDir } from "../utils/fs";
import { verbose, warn } from "../utils/logger";
import type { Marketplace, MarketplacePlugin, PluginManifest } from "../types";
import { pluginManifestSchema } from "./schemas";

const PLUGIN_MANIFEST_PATH = ".claude-plugin/plugin.json";
const MARKETPLACE_SCHEMA_URL = "https://anthropic.com/claude-code/marketplace.schema.json";

/**
 * Category patterns for marketplace plugins.
 *
 * Plugin names match skill IDs directly (e.g., "web-framework-react").
 * The category is the first segment of the ID:
 * - web-* -> web
 * - api-* -> api
 * - cli-* -> cli
 * - meta-* -> methodology
 * - infra-* -> infra
 * - mobile-* -> mobile
 * - security-* -> security
 */
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /^web-/, category: "web" },
  { pattern: /^api-/, category: "api" },
  { pattern: /^cli-/, category: "cli" },
  { pattern: /^meta-/, category: "methodology" },
  { pattern: /^infra-/, category: "infra" },
  { pattern: /^mobile-/, category: "mobile" },
  { pattern: /^security-/, category: "security" },
];

type MarketplaceOptions = {
  name: string;
  version?: string;
  description?: string;
  ownerName: string;
  ownerEmail?: string;
  pluginRoot: string;
};

function inferCategoryFromPluginName(pluginName: string): string | undefined {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(pluginName)) {
      return category;
    }
  }
  return undefined;
}

async function readPluginManifest(pluginDir: string): Promise<PluginManifest | null> {
  const manifestPath = path.join(pluginDir, PLUGIN_MANIFEST_PATH);

  try {
    const content = await readFileSafe(manifestPath, MAX_PLUGIN_FILE_SIZE);
    return pluginManifestSchema.parse(JSON.parse(content));
  } catch (error) {
    verbose(`Failed to read plugin manifest at '${manifestPath}': ${getErrorMessage(error)}`);
    return null;
  }
}

function convertManifestToMarketplacePlugin(
  manifest: PluginManifest,
  pluginRoot: string,
  pluginDirName: string,
): MarketplacePlugin {
  const category = inferCategoryFromPluginName(manifest.name);

  const plugin: MarketplacePlugin = {
    name: manifest.name,
    source: `./${pluginRoot}/${pluginDirName}`,
    description: manifest.description,
    version: manifest.version,
    author: manifest.author,
    keywords: manifest.keywords,
  };

  if (category) {
    plugin.category = category;
  }

  return plugin;
}

export async function generateMarketplace(
  pluginsDir: string,
  options: MarketplaceOptions,
): Promise<Marketplace> {
  verbose(`Scanning plugins directory: ${pluginsDir}`);

  const manifestFiles = await glob(`**/${PLUGIN_MANIFEST_PATH}`, pluginsDir);
  verbose(`Found ${manifestFiles.length} plugin manifests`);

  const plugins: MarketplacePlugin[] = [];

  for (const manifestFile of manifestFiles) {
    const pluginDirName = manifestFile.split("/")[0];
    const pluginDir = path.join(pluginsDir, pluginDirName);

    const manifest = await readPluginManifest(pluginDir);
    if (!manifest) {
      warn(`Could not read plugin manifest: '${manifestFile}'`);
      continue;
    }

    const plugin = convertManifestToMarketplacePlugin(
      manifest,
      options.pluginRoot.replace(/^\.\//, ""),
      pluginDirName,
    );
    plugins.push(plugin);
    verbose(`  [OK] ${plugin.name}`);
  }

  const sortedPlugins = sortBy(plugins, (p) => p.name);

  const marketplace: Marketplace = {
    $schema: MARKETPLACE_SCHEMA_URL,
    name: options.name,
    version: options.version ?? "1.0.0",
    owner: {
      name: options.ownerName,
    },
    metadata: {
      pluginRoot: options.pluginRoot,
    },
    plugins: sortedPlugins,
  };

  if (options.description) {
    marketplace.description = options.description;
  }

  if (options.ownerEmail) {
    marketplace.owner.email = options.ownerEmail;
  }

  return marketplace;
}

export async function writeMarketplace(
  outputPath: string,
  marketplace: Marketplace,
): Promise<void> {
  await ensureDir(path.dirname(outputPath));
  const content = JSON.stringify(marketplace, null, 2) + "\n";
  await writeFile(outputPath, content);
}

export function getMarketplaceStats(marketplace: Marketplace): {
  total: number;
  byCategory: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};

  for (const plugin of marketplace.plugins) {
    const category = plugin.category ?? "uncategorized";
    byCategory[category] = (byCategory[category] ?? 0) + 1;
  }

  return {
    total: marketplace.plugins.length,
    byCategory,
  };
}
