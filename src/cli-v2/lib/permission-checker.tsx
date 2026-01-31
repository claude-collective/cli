import path from "path";
import { Text, Box } from "ink";
import React from "react";
import { fileExists, readFile } from "../utils/fs";

interface PermissionConfig {
  allow?: string[];
  deny?: string[];
}

interface SettingsFile {
  permissions?: PermissionConfig;
}

/**
 * Check permissions configuration and return warning component if needed.
 * Returns null if permissions are properly configured.
 */
export async function checkPermissions(projectRoot: string): Promise<React.ReactElement | null> {
  const settingsPath = path.join(projectRoot, ".claude", "settings.json");
  const localSettingsPath = path.join(
    projectRoot,
    ".claude",
    "settings.local.json",
  );

  let permissions: PermissionConfig | undefined;

  for (const filePath of [localSettingsPath, settingsPath]) {
    if (await fileExists(filePath)) {
      try {
        const content = await readFile(filePath);
        const parsed = JSON.parse(content) as SettingsFile;
        if (parsed.permissions) {
          permissions = parsed.permissions;
          break;
        }
      } catch {}
    }
  }

  if (!permissions) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
        <Text bold color="yellow">Permission Notice</Text>
        <Text>No permissions configured in .claude/settings.json</Text>
        <Text>Agents will prompt for approval on each tool use.</Text>
        <Text> </Text>
        <Text>For autonomous operation, add to .claude/settings.json:</Text>
        <Text> </Text>
        <Text color="dim">{"{"}</Text>
        <Text color="dim">{"  \"permissions\": {"}</Text>
        <Text color="dim">{"    \"allow\": ["}</Text>
        <Text color="dim">{"      \"Read(*)\","}</Text>
        <Text color="dim">{"      \"Bash(git *)\","}</Text>
        <Text color="dim">{"      \"Bash(bun *)\""}</Text>
        <Text color="dim">{"    ]"}</Text>
        <Text color="dim">{"  }"}</Text>
        <Text color="dim">{"}"}</Text>
      </Box>
    );
  }

  const hasRestrictiveBash = permissions.deny?.some(
    (rule) => rule === "Bash(*)" || rule === "Bash",
  );
  const hasNoAllows = !permissions.allow || permissions.allow.length === 0;

  if (hasRestrictiveBash || hasNoAllows) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
        <Text bold color="yellow">Permission Warnings</Text>
        {hasRestrictiveBash && (
          <Text>⚠ Bash is denied in permissions. Some agents require Bash for git, testing, and build commands.</Text>
        )}
        {hasNoAllows && (
          <Text>⚠ No allow rules configured. Agents will prompt for each tool use.</Text>
        )}
      </Box>
    );
  }

  return null;
}
