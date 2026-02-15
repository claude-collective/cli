import React from "react";

import { Text, Box } from "ink";
import path from "path";

import { CLI_COLORS, MAX_CONFIG_FILE_SIZE } from "../consts";
import { fileExists, readFileSafe } from "../utils/fs";
import { warn } from "../utils/logger";
import { settingsFileSchema, warnUnknownFields } from "./schemas";

type PermissionConfig = {
  allow?: string[];
  deny?: string[];
};

type SettingsFile = {
  permissions?: PermissionConfig;
};

export async function checkPermissions(projectRoot: string): Promise<React.ReactElement | null> {
  const settingsPath = path.join(projectRoot, ".claude", "settings.json");
  const localSettingsPath = path.join(projectRoot, ".claude", "settings.local.json");

  let permissions: PermissionConfig | undefined;

  for (const filePath of [localSettingsPath, settingsPath]) {
    if (await fileExists(filePath)) {
      try {
        const content = await readFileSafe(filePath, MAX_CONFIG_FILE_SIZE);
        const raw = JSON.parse(content);
        if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
          const EXPECTED_SETTINGS_KEYS = ["permissions"] as const;
          warnUnknownFields(
            raw as Record<string, unknown>,
            EXPECTED_SETTINGS_KEYS,
            `settings file '${filePath}'`,
          );
        }
        const result = settingsFileSchema.safeParse(raw);
        const parsed: SettingsFile = result.success ? (result.data as SettingsFile) : {};
        if (parsed.permissions) {
          permissions = parsed.permissions;
          break;
        }
      } catch {
        warn(`Malformed settings file at '${filePath}' — skipping`);
      }
    }
  }

  if (!permissions) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor={CLI_COLORS.WARNING} padding={1}>
        <Text bold color={CLI_COLORS.WARNING}>
          Permission Notice
        </Text>
        <Text>No permissions configured in .claude/settings.json</Text>
        <Text>Agents will prompt for approval on each tool use.</Text>
        <Text> </Text>
        <Text>For autonomous operation, add to .claude/settings.json:</Text>
        <Text> </Text>
        <Text color="dim">{"{"}</Text>
        <Text color="dim">{'  "permissions": {'}</Text>
        <Text color="dim">{'    "allow": ['}</Text>
        <Text color="dim">{'      "Read(*)",'}</Text>
        <Text color="dim">{'      "Bash(git *)",'}</Text>
        <Text color="dim">{'      "Bash(bun *)"'}</Text>
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
      <Box flexDirection="column" borderStyle="round" borderColor={CLI_COLORS.WARNING} padding={1}>
        <Text bold color={CLI_COLORS.WARNING}>
          Permission Warnings
        </Text>
        {hasRestrictiveBash && (
          <Text>
            ⚠ Bash is denied in permissions. Some agents require Bash for git, testing, and build
            commands.
          </Text>
        )}
        {hasNoAllows && (
          <Text>⚠ No allow rules configured. Agents will prompt for each tool use.</Text>
        )}
      </Box>
    );
  }

  return null;
}
