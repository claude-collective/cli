import path from "path";
import { readFile, writeFile, glob, ensureDir } from "../utils/fs";
import { verbose } from "../utils/logger";
import type {
  Marketplace,
  MarketplacePlugin,
  PluginManifest,
} from "../../types";

const PLUGIN_MANIFEST_PATH = ".claude-plugin/plugin.json";
const MARKETPLACE_SCHEMA_URL =
  "https://anthropic.com/claude-code/marketplace.schema.json";

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /^skill-setup-/, category: "setup" },
  { pattern: /^skill-backend-/, category: "backend" },
  { pattern: /^skill-frontend-/, category: "frontend" },
  { pattern: /^skill-cli-/, category: "cli" },
  // CLI-specific technologies
  {
    pattern: /^skill-(commander|clack|inquirer|ora|chalk|picocolors)/,
    category: "cli",
  },
  // These patterns match common backend technologies
  {
    pattern: /^skill-(express|fastify|hono|drizzle|prisma)/,
    category: "backend",
  },
  { pattern: /^skill-better-auth/, category: "backend" },
  // Frontend frameworks and libraries
  {
    pattern: /^skill-(react|vue|angular|solid|next|nuxt|remix)/,
    category: "frontend",
  },
  { pattern: /^skill-(tailwind|scss|cva|shadcn|radix)/, category: "frontend" },
  {
    pattern: /^skill-(framer-motion|css-animations|view-transitions)/,
    category: "frontend",
  },
  {
    pattern: /^skill-(zustand|mobx|redux|jotai|pinia|ngrx)/,
    category: "frontend",
  },
  // Testing
  {
    pattern: /^skill-(vitest|cypress|playwright|jest|testing)/,
    category: "testing",
  },
  { pattern: /^skill-(react-testing|vue-test|karma)/, category: "testing" },
  // API/Data
  {
    pattern: /^skill-(react-query|swr|trpc|graphql|msw|mocks)/,
    category: "api",
  },
  { pattern: /^skill-(websockets|socket-io|sse)/, category: "api" },
  // Observability
  { pattern: /^skill-(posthog|axiom|pino|sentry)/, category: "observability" },
  // Mobile
  { pattern: /^skill-(expo|react-native)/, category: "mobile" },
  // DevOps/CI
  { pattern: /^skill-github-actions/, category: "devops" },
  // Tooling
  { pattern: /^skill-(turborepo|storybook|tooling)/, category: "tooling" },
  // Security
  { pattern: /^skill-security/, category: "security" },
  { pattern: /^skill-(react-hook-form|vee-validate|zod)/, category: "forms" },
  { pattern: /^skill-(react-intl|next-intl|vue-i18n)/, category: "i18n" },
];

export interface MarketplaceOptions {
  name: string;
  version?: string;
  description?: string;
  ownerName: string;
  ownerEmail?: string;
  pluginRoot: string;
}

function inferCategory(pluginName: string): string | undefined {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(pluginName)) {
      return category;
    }
  }
  return undefined;
}

async function readPluginManifest(
  pluginDir: string,
): Promise<PluginManifest | null> {
  const manifestPath = path.join(pluginDir, PLUGIN_MANIFEST_PATH);

  try {
    const content = await readFile(manifestPath);
    return JSON.parse(content) as PluginManifest;
  } catch {
    return null;
  }
}

function toMarketplacePlugin(
  manifest: PluginManifest,
  pluginRoot: string,
  pluginDirName: string,
): MarketplacePlugin {
  const category = inferCategory(manifest.name);

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
      verbose(`  [WARN] Could not read manifest: ${manifestFile}`);
      continue;
    }

    const plugin = toMarketplacePlugin(
      manifest,
      options.pluginRoot.replace(/^\.\//, ""),
      pluginDirName,
    );
    plugins.push(plugin);
    verbose(`  [OK] ${plugin.name}`);
  }

  plugins.sort((a, b) => a.name.localeCompare(b.name));

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
    plugins,
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
