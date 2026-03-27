import fs from "fs";
import os from "os";
import {
  detectGlobalInstallation,
  detectProjectInstallation,
  type Installation,
} from "../installation/index.js";

export type BothInstallations = {
  global: Installation | null;
  project: Installation | null;
  hasBoth: boolean;
};

/**
 * Detects both global and project installations.
 *
 * Skips project detection when projectDir is the home directory
 * to avoid double-compile. Returns a convenience `hasBoth` flag
 * used by callers to set scopeFilter on compile passes.
 */
export async function detectBothInstallations(projectDir: string): Promise<BothInstallations> {
  const global = await detectGlobalInstallation();

  let isSameAsHome: boolean;
  try {
    isSameAsHome = fs.realpathSync(projectDir) === fs.realpathSync(os.homedir());
  } catch {
    isSameAsHome = projectDir === os.homedir();
  }

  const project = isSameAsHome ? null : await detectProjectInstallation(projectDir);
  return { global, project, hasBoth: !!global && !!project };
}
