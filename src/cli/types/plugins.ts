/**
 * Plugin and marketplace types — manifest, marketplace entries, and fetch results.
 */

import type { AgentHookDefinition } from "./agents";

/**
 * Author information for plugin manifest
 */
export type PluginAuthor = {
  /** Author's display name */
  name: string;
  /** Author's email address (optional) */
  email?: string;
};

/**
 * Plugin manifest for Claude Code plugins (plugin.json)
 * Defines the structure and content of a plugin package
 */
export type PluginManifest = {
  /** Plugin name in kebab-case (e.g., "skill-react", "stack-nextjs-fullstack") */
  name: string;
  /** Plugin version in semver format (e.g., "1.0.0") */
  version?: string;
  /** Brief description of the plugin's purpose */
  description?: string;
  /** Plugin author information */
  author?: PluginAuthor;
  /** Keywords for discoverability */
  keywords?: string[];
  /** Path(s) to commands directory or files */
  commands?: string | string[];
  /** Path(s) to agents directory or files */
  agents?: string | string[];
  /** Path(s) to skills directory or files */
  skills?: string | string[];
  /** Path to hooks config file or inline hooks object */
  hooks?: string | Record<string, AgentHookDefinition[]>;
};

/**
 * Remote source configuration for marketplace plugins
 */
export type MarketplaceRemoteSource = {
  /** Source type: github or url */
  source: "github" | "url";
  /** GitHub repository in owner/repo format */
  repo?: string;
  /** Direct URL to plugin archive */
  url?: string;
  /** Git ref (branch, tag, or commit) */
  ref?: string;
};

/**
 * Plugin entry in a marketplace.json file
 */
export type MarketplacePlugin = {
  /** Plugin name in kebab-case (e.g., "skill-react") */
  name: string;
  /** Local path or remote source configuration */
  source: string | MarketplaceRemoteSource;
  /** Brief description of the plugin */
  description?: string;
  /** Plugin version */
  version?: string;
  /** Plugin author information */
  author?: PluginAuthor;
  /** Plugin category for organization (e.g., "frontend", "backend") */
  category?: string;
  /** Keywords for discoverability */
  keywords?: string[];
};

/**
 * Marketplace owner information
 */
export type MarketplaceOwner = {
  /** Owner's display name */
  name: string;
  /** Owner's contact email */
  email?: string;
};

/**
 * Marketplace metadata
 */
export type MarketplaceMetadata = {
  /** Root directory for plugin sources */
  pluginRoot?: string;
};

/**
 * Marketplace configuration (marketplace.json)
 * Defines a collection of Claude Code plugins
 */
export type Marketplace = {
  /** JSON schema reference URL */
  $schema?: string;
  /** Marketplace name in kebab-case */
  name: string;
  /** Marketplace version (semantic versioning) */
  version: string;
  /** Brief description of the marketplace */
  description?: string;
  /** Marketplace owner information */
  owner: MarketplaceOwner;
  /** Additional marketplace metadata */
  metadata?: MarketplaceMetadata;
  /** List of plugins in the marketplace */
  plugins: MarketplacePlugin[];
};

/**
 * Result from fetching marketplace data from a remote source.
 * Contains the parsed marketplace and caching metadata.
 */
export type MarketplaceFetchResult = {
  /** Parsed marketplace data */
  marketplace: Marketplace;
  /** Path where source was fetched/cached */
  sourcePath: string;
  /** Whether result came from cache */
  fromCache: boolean;
};
