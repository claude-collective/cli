/**
 * Shared test helpers for CLI tests
 *
 * This module provides common utilities to reduce duplication across test files.
 */

import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, stat } from "fs/promises";
import type { MergedSkillsMatrix, ResolvedSkill } from "../../types-matrix";
import type { StackConfig, AgentDefinition } from "../../../types";

// =============================================================================
// File System Helpers
// =============================================================================

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Create a temporary directory for tests
 */
export async function createTempDir(prefix = "cc-test-"): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

/**
 * Clean up a temporary directory
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  await rm(dirPath, { recursive: true, force: true });
}

// =============================================================================
// Test Directory Structure
// =============================================================================

export interface TestDirs {
  tempDir: string;
  projectDir: string;
  pluginDir: string;
  skillsDir: string;
  agentsDir: string;
}

/**
 * Create a complete test directory structure for plugin tests
 */
export async function createTestDirs(prefix = "cc-test-"): Promise<TestDirs> {
  const tempDir = await createTempDir(prefix);
  const projectDir = path.join(tempDir, "project");
  const pluginDir = path.join(
    projectDir,
    ".claude",
    "plugins",
    "claude-collective",
  );
  const skillsDir = path.join(pluginDir, "skills");
  const agentsDir = path.join(pluginDir, "agents");

  await mkdir(skillsDir, { recursive: true });
  await mkdir(agentsDir, { recursive: true });

  return { tempDir, projectDir, pluginDir, skillsDir, agentsDir };
}

/**
 * Clean up test directories
 */
export async function cleanupTestDirs(dirs: TestDirs): Promise<void> {
  await cleanupTempDir(dirs.tempDir);
}

// =============================================================================
// Mock Data Creators
// =============================================================================

/**
 * Create a minimal resolved skill for testing
 */
export function createMockSkill(
  id: string,
  category: string,
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return {
    id,
    name: id.replace(/ \(@.*\)$/, ""),
    description: `${id} skill`,
    category,
    categoryExclusive: false,
    tags: [],
    author: "@test",
    conflictsWith: [],
    recommends: [],
    recommendedBy: [],
    requires: [],
    requiredBy: [],
    alternatives: [],
    discourages: [],
    requiresSetup: [],
    providesSetupFor: [],
    path: `skills/${category}/${id}/`,
    ...overrides,
  };
}

/**
 * Create a minimal merged skills matrix for testing
 */
export function createMockMatrix(
  skills: Record<string, ResolvedSkill>,
  overrides?: Partial<MergedSkillsMatrix>,
): MergedSkillsMatrix {
  return {
    version: "1.0.0",
    categories: {},
    skills,
    suggestedStacks: [],
    aliases: {},
    aliasesReverse: {},
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a minimal stack config for testing
 */
export function createMockStackConfig(
  name: string,
  skills: string[],
  overrides?: Partial<StackConfig>,
): StackConfig {
  return {
    name,
    version: "1.0.0",
    description: `Test stack: ${name}`,
    author: "@test",
    skills,
    agents: ["web-developer", "api-developer"],
    agent_skills: {
      "web-developer": skills.filter((s) => !s.includes("backend")),
      "api-developer": skills.filter((s) => !s.includes("frontend")),
    },
    ...overrides,
  };
}

/**
 * Create a minimal agent definition for testing
 */
export function createMockAgent(
  name: string,
  overrides?: Partial<AgentDefinition>,
): AgentDefinition {
  return {
    name,
    description: `${name} agent`,
    tools: "Read, Write, Edit, Grep, Glob, Bash",
    model: "opus",
    permissionMode: "default",
    ...overrides,
  };
}

// =============================================================================
// File Content Helpers
// =============================================================================

/**
 * Create a minimal SKILL.md content
 */
export function createSkillContent(
  name: string,
  description = "A test skill",
): string {
  return `---
name: ${name}
description: ${description}
category: test
---

# ${name}

This is a test skill.
`;
}

/**
 * Create a minimal metadata.yaml content
 */
export function createMetadataContent(author = "@test"): string {
  return `version: 1
author: ${author}
`;
}

/**
 * Create a minimal agent.yaml content
 */
export function createAgentYamlContent(
  name: string,
  description = "A test agent",
): string {
  return `name: ${name}
description: ${description}
tools: Read, Write, Edit
model: opus
permissionMode: default
`;
}

/**
 * Write a test skill to a directory
 */
export async function writeTestSkill(
  skillsDir: string,
  skillName: string,
  options?: { author?: string; description?: string },
): Promise<string> {
  const skillDir = path.join(skillsDir, skillName);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, "SKILL.md"),
    createSkillContent(skillName, options?.description),
  );

  await writeFile(
    path.join(skillDir, "metadata.yaml"),
    createMetadataContent(options?.author),
  );

  return skillDir;
}

/**
 * Write a test agent definition to a directory
 */
export async function writeTestAgent(
  agentsDir: string,
  agentName: string,
  options?: { description?: string },
): Promise<string> {
  const agentDir = path.join(agentsDir, agentName);
  await mkdir(agentDir, { recursive: true });

  await writeFile(
    path.join(agentDir, "agent.yaml"),
    createAgentYamlContent(agentName, options?.description),
  );

  return agentDir;
}
