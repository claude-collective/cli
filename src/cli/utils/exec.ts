import { spawn } from "child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a command and return the result
 */
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

/**
 * Install a plugin using the native claude CLI
 */
export async function claudePluginInstall(
  pluginPath: string,
  scope: "project" | "user",
  projectDir: string,
): Promise<void> {
  const args = ["plugin", "install", pluginPath, "--scope", scope];
  const result = await execCommand("claude", args, { cwd: projectDir });

  if (result.exitCode !== 0) {
    const errorMessage = result.stderr || result.stdout || "Unknown error";
    throw new Error(`Plugin installation failed: ${errorMessage.trim()}`);
  }
}

/**
 * Check if the claude CLI is available
 */
export async function isClaudeCLIAvailable(): Promise<boolean> {
  try {
    const result = await execCommand("claude", ["--version"], {});
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export interface MarketplaceInfo {
  name: string;
  source: string;
  repo?: string;
  path?: string;
}

/**
 * List configured marketplaces in Claude Code
 */
export async function claudePluginMarketplaceList(): Promise<
  MarketplaceInfo[]
> {
  try {
    const result = await execCommand(
      "claude",
      ["plugin", "marketplace", "list", "--json"],
      {},
    );

    if (result.exitCode !== 0) {
      return [];
    }

    return JSON.parse(result.stdout);
  } catch {
    // Returns empty array if claude CLI is not available or parsing fails
    return [];
  }
}

/**
 * Check if a marketplace with the given name exists
 */
export async function claudePluginMarketplaceExists(
  name: string,
): Promise<boolean> {
  const marketplaces = await claudePluginMarketplaceList();
  return marketplaces.some((m) => m.name === name);
}

/**
 * Add a marketplace to Claude Code from a GitHub repository
 */
export async function claudePluginMarketplaceAdd(
  githubRepo: string,
  name: string,
): Promise<void> {
  const args = ["plugin", "marketplace", "add", githubRepo, "--name", name];
  let result;
  try {
    result = await execCommand("claude", args, {});
  } catch (err) {
    throw new Error(
      `Failed to add marketplace: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }

  if (result.exitCode !== 0) {
    const errorMessage = result.stderr || result.stdout || "Unknown error";
    if (errorMessage.includes("already installed")) {
      return;
    }
    throw new Error(`Failed to add marketplace: ${errorMessage.trim()}`);
  }
}

/**
 * Uninstall a plugin using the native claude CLI
 */
export async function claudePluginUninstall(
  pluginName: string,
  scope: "project" | "user",
  projectDir: string,
): Promise<void> {
  const args = ["plugin", "uninstall", pluginName, "--scope", scope];
  const result = await execCommand("claude", args, { cwd: projectDir });

  if (result.exitCode !== 0) {
    const errorMessage = result.stderr || result.stdout || "Unknown error";
    // Ignore "not installed" errors - plugin may already be removed
    if (
      errorMessage.includes("not installed") ||
      errorMessage.includes("not found")
    ) {
      return;
    }
    throw new Error(`Plugin uninstall failed: ${errorMessage.trim()}`);
  }
}
