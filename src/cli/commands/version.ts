import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import {
  PLUGIN_MANIFEST_DIR,
  PLUGIN_MANIFEST_FILE,
  DEFAULT_VERSION,
} from "../consts";
import { readFile, writeFile, fileExists } from "../utils/fs";
import { EXIT_CODES } from "../lib/exit-codes";
import type { PluginManifest } from "../../types";

type VersionAction = "patch" | "minor" | "major" | "set";

interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

function parseSemver(version: string): SemverParts | null {
  const match = version.match(SEMVER_REGEX);
  if (!match) {
    return null;
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

function formatSemver(parts: SemverParts): string {
  return `${parts.major}.${parts.minor}.${parts.patch}`;
}

function incrementVersion(
  version: string,
  action: "patch" | "minor" | "major",
): string {
  const parts = parseSemver(version);
  if (!parts) {
    return DEFAULT_VERSION;
  }

  switch (action) {
    case "major":
      return formatSemver({ major: parts.major + 1, minor: 0, patch: 0 });
    case "minor":
      return formatSemver({
        major: parts.major,
        minor: parts.minor + 1,
        patch: 0,
      });
    case "patch":
      return formatSemver({
        major: parts.major,
        minor: parts.minor,
        patch: parts.patch + 1,
      });
  }
}

async function findPluginManifest(startDir: string): Promise<string | null> {
  let currentDir = startDir;
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const manifestPath = path.join(
      currentDir,
      PLUGIN_MANIFEST_DIR,
      PLUGIN_MANIFEST_FILE,
    );
    if (await fileExists(manifestPath)) {
      return manifestPath;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

async function readPluginManifest(
  manifestPath: string,
): Promise<PluginManifest> {
  const content = await readFile(manifestPath);
  return JSON.parse(content) as PluginManifest;
}

async function writePluginManifestFile(
  manifestPath: string,
  manifest: PluginManifest,
): Promise<void> {
  const content = JSON.stringify(manifest, null, 2);
  await writeFile(manifestPath, content);
}

export const versionCommand = new Command("version")
  .description("Manage plugin version")
  .argument("<action>", 'Version action: "patch", "minor", "major", or "set"')
  .argument("[version]", 'Version to set (only for "set" action)')
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (action: string, version?: string) => {
    const validActions: VersionAction[] = ["patch", "minor", "major", "set"];
    if (!validActions.includes(action as VersionAction)) {
      p.log.error(
        `Invalid action: "${action}". Must be one of: ${validActions.join(", ")}`,
      );
      process.exit(EXIT_CODES.INVALID_ARGS);
    }

    const versionAction = action as VersionAction;

    if (versionAction === "set") {
      if (!version) {
        p.log.error('Version argument required for "set" action');
        p.log.info("Usage: cc version set <version>");
        process.exit(EXIT_CODES.INVALID_ARGS);
      }

      if (!parseSemver(version)) {
        p.log.error(
          `Invalid version format: "${version}". Must be semantic version (e.g., 1.0.0)`,
        );
        process.exit(EXIT_CODES.INVALID_ARGS);
      }
    }

    const manifestPath = await findPluginManifest(process.cwd());
    if (!manifestPath) {
      p.log.error("No plugin.json found in current directory or parents");
      p.log.info(
        `Expected location: ${PLUGIN_MANIFEST_DIR}/${PLUGIN_MANIFEST_FILE}`,
      );
      process.exit(EXIT_CODES.ERROR);
    }

    let manifest: PluginManifest;
    try {
      manifest = await readPluginManifest(manifestPath);
    } catch (error) {
      p.log.error(`Failed to read plugin manifest: ${error}`);
      process.exit(EXIT_CODES.ERROR);
    }

    const oldVersion = manifest.version || DEFAULT_VERSION;

    let newVersion: string;
    if (versionAction === "set") {
      newVersion = version!;
    } else {
      newVersion = incrementVersion(oldVersion, versionAction);
    }

    manifest.version = newVersion;

    try {
      await writePluginManifestFile(manifestPath, manifest);
    } catch (error) {
      p.log.error(`Failed to write plugin manifest: ${error}`);
      process.exit(EXIT_CODES.ERROR);
    }

    const pluginName = manifest.name || "unknown";
    console.log(
      `${pc.cyan(pluginName)}: ${pc.dim(oldVersion)} ${pc.yellow("->")} ${pc.green(newVersion)}`,
    );
  });
