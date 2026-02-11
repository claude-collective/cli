import path from "path";
import { downloadTemplate } from "giget";
import { verbose } from "../utils/logger";
import { CACHE_DIR } from "../consts";
import { ensureDir, directoryExists, readFile } from "../utils/fs";
import { isLocalSource } from "./config";
import { marketplaceSchema } from "./schemas";
import type { MarketplaceFetchResult } from "../../types";

export type FetchOptions = {
  forceRefresh?: boolean;
  subdir?: string;
};

export type FetchResult = {
  path: string;
  fromCache: boolean;
  source: string;
};

export function sanitizeSourceForCache(source: string): string {
  return source.replace(/:/g, "-").replace(/[\/]/g, "-").replace(/--+/g, "-").replace(/^-|-$/g, "");
}

function getCacheDir(source: string): string {
  const sanitized = sanitizeSourceForCache(source);
  return path.join(CACHE_DIR, "sources", sanitized);
}

export async function fetchFromSource(
  source: string,
  options: FetchOptions = {},
): Promise<FetchResult> {
  const { forceRefresh = false, subdir } = options;

  if (isLocalSource(source)) {
    return fetchFromLocalSource(source, subdir);
  }

  return fetchFromRemoteSource(source, { forceRefresh, subdir });
}

async function fetchFromLocalSource(source: string, subdir?: string): Promise<FetchResult> {
  const fullPath = subdir ? path.join(source, subdir) : source;
  const absolutePath = path.isAbsolute(fullPath) ? fullPath : path.resolve(process.cwd(), fullPath);

  if (!(await directoryExists(absolutePath))) {
    throw new Error(`Local source not found: ${absolutePath}`);
  }

  verbose(`Using local source: ${absolutePath}`);

  return {
    path: absolutePath,
    fromCache: false,
    source,
  };
}

async function fetchFromRemoteSource(source: string, options: FetchOptions): Promise<FetchResult> {
  const { forceRefresh = false, subdir } = options;
  const cacheDir = getCacheDir(source);

  const fullSource = subdir ? `${source}/${subdir}` : source;

  verbose(`Fetching from remote: ${fullSource}`);
  verbose(`Cache directory: ${cacheDir}`);

  // If cache exists and not forcing refresh, use it directly
  if (!forceRefresh && (await directoryExists(cacheDir))) {
    verbose(`Using cached source: ${cacheDir}`);
    return {
      path: cacheDir,
      fromCache: true,
      source: fullSource,
    };
  }

  await ensureDir(path.dirname(cacheDir));

  try {
    const result = await downloadTemplate(fullSource, {
      dir: cacheDir,
      force: true, // Always force when downloading to avoid "already exists" error
      offline: false,
    });

    verbose(`Downloaded to: ${result.dir}`);

    return {
      path: result.dir,
      fromCache: false,
      source: fullSource,
    };
  } catch (error) {
    throw wrapGigetError(error, source);
  }
}

function wrapGigetError(error: unknown, source: string): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("404") || message.includes("Not Found")) {
    return new Error(
      `Repository not found: ${source}\n\n` +
        `This could mean:\n` +
        `  - The repository doesn't exist\n` +
        `  - The repository is private and you need to set authentication\n` +
        `  - There's a typo in the URL\n\n` +
        `For private repositories, set the GIGET_AUTH environment variable:\n` +
        `  export GIGET_AUTH=ghp_your_github_token`,
    );
  }

  if (message.includes("401") || message.includes("Unauthorized")) {
    return new Error(
      `Authentication required for: ${source}\n\n` +
        `Set the GIGET_AUTH environment variable with a GitHub token:\n` +
        `  export GIGET_AUTH=ghp_your_github_token\n\n` +
        `Create a token at: https://github.com/settings/tokens\n` +
        `Required scope: repo (for private repos) or public_repo (for public)`,
    );
  }

  if (message.includes("403") || message.includes("Forbidden")) {
    return new Error(
      `Access denied to: ${source}\n\n` +
        `Your token may not have sufficient permissions.\n` +
        `Ensure your GIGET_AUTH token has the 'repo' scope for private repositories.`,
    );
  }

  if (
    message.includes("ENOTFOUND") ||
    message.includes("ETIMEDOUT") ||
    message.includes("network")
  ) {
    return new Error(
      `Network error fetching: ${source}\n\n` +
        `Please check your internet connection.\n` +
        `If you're behind a corporate proxy, you may need to set:\n` +
        `  export HTTPS_PROXY=http://your-proxy:port\n` +
        `  export FORCE_NODE_FETCH=true  # Required for Node 20+`,
    );
  }

  return new Error(`Failed to fetch ${source}: ${message}`);
}

export async function fetchMarketplace(
  source: string,
  options: FetchOptions = {},
): Promise<MarketplaceFetchResult> {
  const result = await fetchFromSource(source, {
    forceRefresh: options.forceRefresh,
    subdir: "", // Root of repo
  });

  const marketplacePath = path.join(result.path, ".claude-plugin", "marketplace.json");

  if (!(await directoryExists(path.dirname(marketplacePath)))) {
    throw new Error(
      `Marketplace not found at: ${marketplacePath}\n\n` +
        `Expected .claude-plugin/marketplace.json in the source repository.`,
    );
  }

  const content = await readFile(marketplacePath);
  const parsed = JSON.parse(content);
  const validation = marketplaceSchema.safeParse(parsed);

  if (!validation.success) {
    throw new Error(
      `Invalid marketplace.json at: ${marketplacePath}\n\n` +
        `Validation errors: ${validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }

  const marketplace = validation.data;

  verbose(`Loaded marketplace: ${marketplace.name} v${marketplace.version}`);

  return {
    marketplace,
    sourcePath: result.path,
    fromCache: result.fromCache ?? false,
  };
}
