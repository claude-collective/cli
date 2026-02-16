import { spawn } from "child_process";
import { getErrorMessage } from "./errors";
import { warn } from "./logger";

// Argument length limits to prevent oversized CLI arguments
const MAX_PLUGIN_PATH_LENGTH = 1024;
const MAX_PLUGIN_NAME_LENGTH = 256;
const MAX_MARKETPLACE_SOURCE_LENGTH = 1024;

// Marketplace/plugin names: alphanumeric, dashes, underscores, dots, @
const SAFE_NAME_PATTERN = /^[a-zA-Z0-9._@/-]+$/;

// Plugin path/ref: alphanumeric, dashes, underscores, dots, slashes, @, colons (for marketplace refs like skill@marketplace)
const SAFE_PLUGIN_PATH_PATTERN = /^[a-zA-Z0-9._@/:~-]+$/;

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0E-\x1F\x7F]/u;

function validatePluginPath(pluginPath: string): void {
  if (!pluginPath || pluginPath.trim().length === 0) {
    throw new Error("Plugin path must not be empty.");
  }

  if (pluginPath.length > MAX_PLUGIN_PATH_LENGTH) {
    throw new Error(
      `Plugin path is too long (${pluginPath.length} characters, max ${MAX_PLUGIN_PATH_LENGTH}).`,
    );
  }

  if (CONTROL_CHAR_PATTERN.test(pluginPath)) {
    throw new Error("Plugin path contains invalid control characters.");
  }

  if (!SAFE_PLUGIN_PATH_PATTERN.test(pluginPath)) {
    throw new Error(
      `Plugin path contains invalid characters: "${pluginPath}"\n` +
        "Plugin paths may only contain alphanumeric characters, dashes, underscores, dots, slashes, @, and colons.",
    );
  }
}

function validateMarketplaceSource(source: string): void {
  if (!source || source.trim().length === 0) {
    throw new Error("Marketplace source must not be empty.");
  }

  if (source.length > MAX_MARKETPLACE_SOURCE_LENGTH) {
    throw new Error(
      `Marketplace source is too long (${source.length} characters, max ${MAX_MARKETPLACE_SOURCE_LENGTH}).`,
    );
  }

  if (CONTROL_CHAR_PATTERN.test(source)) {
    throw new Error("Marketplace source contains invalid control characters.");
  }

  if (!SAFE_PLUGIN_PATH_PATTERN.test(source)) {
    throw new Error(
      `Marketplace source contains invalid characters: "${source}"\n` +
        "Source may only contain alphanumeric characters, dashes, underscores, dots, slashes, @, and colons.",
    );
  }
}

function validatePluginName(pluginName: string): void {
  if (!pluginName || pluginName.trim().length === 0) {
    throw new Error("Plugin name must not be empty.");
  }

  if (pluginName.length > MAX_PLUGIN_NAME_LENGTH) {
    throw new Error(
      `Plugin name is too long (${pluginName.length} characters, max ${MAX_PLUGIN_NAME_LENGTH}).`,
    );
  }

  if (CONTROL_CHAR_PATTERN.test(pluginName)) {
    throw new Error("Plugin name contains invalid control characters.");
  }

  if (!SAFE_NAME_PATTERN.test(pluginName)) {
    throw new Error(
      `Plugin name contains invalid characters: "${pluginName}"\n` +
        "Names may only contain alphanumeric characters, dashes, underscores, dots, @, and slashes.",
    );
  }
}

export type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export async function execCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: options?.cwd,
      env: { ...process.env, ...options?.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

export async function claudePluginInstall(
  pluginPath: string,
  scope: "project" | "user",
  projectDir: string,
): Promise<void> {
  validatePluginPath(pluginPath);

  const args = ["plugin", "install", pluginPath, "--scope", scope];
  const result = await execCommand("claude", args, { cwd: projectDir });

  if (result.exitCode !== 0) {
    const errorMessage = result.stderr || result.stdout || "Unknown error";
    throw new Error(`Plugin installation failed: ${errorMessage.trim()}`);
  }
}

export async function isClaudeCLIAvailable(): Promise<boolean> {
  try {
    const result = await execCommand("claude", ["--version"], {});
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export type MarketplaceInfo = {
  name: string;
  source: string;
  repo?: string;
  path?: string;
};

export async function claudePluginMarketplaceList(): Promise<MarketplaceInfo[]> {
  try {
    const result = await execCommand("claude", ["plugin", "marketplace", "list", "--json"], {});

    if (result.exitCode !== 0) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      warn("Failed to parse marketplace list output as JSON");
      return [];
    }

    if (!Array.isArray(parsed)) {
      warn("Unexpected marketplace list format — expected an array");
      return [];
    }

    return parsed as MarketplaceInfo[];
  } catch {
    return [];
  }
}

export async function claudePluginMarketplaceExists(name: string): Promise<boolean> {
  const marketplaces = await claudePluginMarketplaceList();
  return marketplaces.some((m) => m.name === name);
}

export async function claudePluginMarketplaceAdd(source: string): Promise<void> {
  validateMarketplaceSource(source);

  const args = ["plugin", "marketplace", "add", source];
  let result;
  try {
    result = await execCommand("claude", args, {});
  } catch (err) {
    throw new Error(`Failed to add marketplace: ${getErrorMessage(err)}`);
  }

  if (result.exitCode !== 0) {
    const errorMessage = result.stderr || result.stdout || "Unknown error";
    if (errorMessage.includes("already installed")) {
      return;
    }
    throw new Error(`Failed to add marketplace: ${errorMessage.trim()}`);
  }
}

export async function claudePluginUninstall(
  pluginName: string,
  scope: "project" | "user",
  projectDir: string,
): Promise<void> {
  validatePluginName(pluginName);

  const args = ["plugin", "uninstall", pluginName, "--scope", scope];
  const result = await execCommand("claude", args, { cwd: projectDir });

  if (result.exitCode !== 0) {
    const errorMessage = result.stderr || result.stdout || "Unknown error";
    // Ignore "not installed" errors - plugin may already be removed
    if (errorMessage.includes("not installed") || errorMessage.includes("not found")) {
      return;
    }
    throw new Error(`Plugin uninstall failed: ${errorMessage.trim()}`);
  }
}
