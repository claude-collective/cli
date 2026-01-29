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
