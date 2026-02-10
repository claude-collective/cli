import path from "path";
import { mapValues } from "remeda";
import { parse as parseYaml } from "yaml";
import { readFile, fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { CLAUDE_DIR, CLAUDE_SRC_DIR } from "../consts";
import type {
  ProjectConfig,
  SkillAssignment,
  SkillEntry,
  AgentSkillConfig,
  ValidationResult,
} from "../../types";
import { projectConfigLoaderSchema } from "./schemas";

const CONFIG_PATH = `${CLAUDE_SRC_DIR}/config.yaml`;
const LEGACY_CONFIG_PATH = `${CLAUDE_DIR}/config.yaml`;

export interface LoadedProjectConfig {
  config: ProjectConfig;
  configPath: string;
  /** true if was StackConfig format (legacy) */
  isLegacy: boolean;
}

/**
 * Load project config from .claude-src/config.yaml (with fallback to .claude/config.yaml)
 */
export async function loadProjectConfig(projectDir: string): Promise<LoadedProjectConfig | null> {
  // Check .claude-src/config.yaml first (new location)
  const srcConfigPath = path.join(projectDir, CONFIG_PATH);
  // Fall back to .claude/config.yaml (legacy location)
  const legacyConfigPath = path.join(projectDir, LEGACY_CONFIG_PATH);

  let configPath = srcConfigPath;
  if (!(await fileExists(srcConfigPath))) {
    if (await fileExists(legacyConfigPath)) {
      configPath = legacyConfigPath;
      verbose(`Using legacy config location: ${legacyConfigPath}`);
    } else {
      verbose(`Project config not found at ${srcConfigPath} or ${legacyConfigPath}`);
      return null;
    }
  }

  try {
    const content = await readFile(configPath);
    const parsed = parseYaml(content);

    if (!parsed || typeof parsed !== "object") {
      verbose(`Invalid project config structure at ${configPath}`);
      return null;
    }

    // Validate YAML-parsed data structure using Zod (lenient: allows partial configs)
    const result = projectConfigLoaderSchema.safeParse(parsed);
    if (!result.success) {
      verbose(`Invalid project config at ${configPath}: ${result.error.message}`);
      return null;
    }

    verbose(`Loaded project config from ${configPath}`);
    return {
      // Loader schema validates field types but allows partial configs;
      // required field validation happens in validateProjectConfig()
      config: result.data as ProjectConfig,
      configPath,
      isLegacy: false,
    };
  } catch (error) {
    verbose(`Failed to parse project config: ${error}`);
    return null;
  }
}

/**
 * Validate project config structure.
 * Returns validation result with errors and warnings.
 */
export function validateProjectConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["Config must be an object"], warnings: [] };
  }

  const c = config as Record<string, unknown>;

  // Required: name
  if (!c.name || typeof c.name !== "string") {
    errors.push("name is required and must be a string");
  }

  // Required: agents (for compilation)
  if (!c.agents || !Array.isArray(c.agents)) {
    errors.push("agents is required and must be an array");
  } else {
    for (const agent of c.agents) {
      if (typeof agent !== "string") {
        errors.push(`agents must contain strings, found: ${typeof agent}`);
      }
    }
  }

  // Optional: version
  if (c.version !== undefined && c.version !== "1") {
    errors.push('version must be "1" (or omitted for default)');
  }

  // Optional: skills
  if (c.skills !== undefined) {
    if (!Array.isArray(c.skills)) {
      errors.push("skills must be an array");
    } else {
      for (const skill of c.skills) {
        const skillError = validateSkillEntry(skill);
        if (skillError) {
          errors.push(skillError);
        }
      }
    }
  }

  // Optional: agent_skills
  if (c.agent_skills !== undefined) {
    if (typeof c.agent_skills !== "object" || c.agent_skills === null) {
      errors.push("agent_skills must be an object");
    } else {
      for (const [agentName, agentSkills] of Object.entries(c.agent_skills)) {
        const agentSkillsError = validateAgentSkillConfig(agentName, agentSkills);
        if (agentSkillsError) {
          errors.push(agentSkillsError);
        }
      }
    }
  }

  // Optional: preload_patterns
  if (c.preload_patterns !== undefined) {
    if (typeof c.preload_patterns !== "object" || c.preload_patterns === null) {
      errors.push("preload_patterns must be an object");
    } else {
      for (const [agentName, patterns] of Object.entries(c.preload_patterns)) {
        if (!Array.isArray(patterns)) {
          errors.push(`preload_patterns.${agentName} must be an array of strings`);
        } else {
          for (const pattern of patterns) {
            if (typeof pattern !== "string") {
              errors.push(`preload_patterns.${agentName} must contain only strings`);
              break;
            }
          }
        }
      }
    }
  }

  // Optional: custom_agents
  if (c.custom_agents !== undefined) {
    const customAgentsErrors = validateCustomAgents(c.custom_agents, c.agents);
    errors.push(...customAgentsErrors);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/** Maximum number of custom agents allowed per project */
const MAX_CUSTOM_AGENTS = 20;

/** Valid model values for custom agents */
const VALID_MODELS = ["sonnet", "opus", "haiku", "inherit"];

/** Valid permission modes for custom agents */
const VALID_PERMISSION_MODES = [
  "default",
  "acceptEdits",
  "dontAsk",
  "bypassPermissions",
  "plan",
  "delegate",
];

/**
 * Validate custom_agents section of config
 */
function validateCustomAgents(customAgents: unknown, agents: unknown): string[] {
  const errors: string[] = [];

  if (typeof customAgents !== "object" || customAgents === null) {
    errors.push("custom_agents must be an object");
    return errors;
  }

  const customAgentEntries = Object.entries(customAgents);

  // Check maximum limit
  if (customAgentEntries.length > MAX_CUSTOM_AGENTS) {
    errors.push(
      `custom_agents cannot exceed ${MAX_CUSTOM_AGENTS} agents (found ${customAgentEntries.length})`,
    );
  }

  // Collect custom agent names for circular reference check
  const customAgentNames = new Set(customAgentEntries.map(([name]) => name));

  for (const [agentName, agentConfig] of customAgentEntries) {
    const agentErrors = validateCustomAgentConfig(agentName, agentConfig, customAgentNames);
    errors.push(...agentErrors);
  }

  return errors;
}

/**
 * Validate a single custom agent configuration
 */
function validateCustomAgentConfig(
  agentName: string,
  config: unknown,
  customAgentNames: Set<string>,
): string[] {
  const errors: string[] = [];
  const prefix = `custom_agents.${agentName}`;

  if (typeof config !== "object" || config === null) {
    errors.push(`${prefix} must be an object`);
    return errors;
  }

  const c = config as Record<string, unknown>;

  // Required: title
  if (!c.title || typeof c.title !== "string") {
    errors.push(`${prefix}.title is required and must be a string`);
  }

  // Required: description
  if (!c.description || typeof c.description !== "string") {
    errors.push(`${prefix}.description is required and must be a string`);
  }

  // Optional: extends
  if (c.extends !== undefined) {
    if (typeof c.extends !== "string") {
      errors.push(`${prefix}.extends must be a string`);
    } else if (customAgentNames.has(c.extends)) {
      // Custom agents cannot extend other custom agents
      errors.push(`${prefix}.extends cannot reference another custom agent "${c.extends}"`);
    }
  }

  // Optional: model
  if (c.model !== undefined) {
    if (typeof c.model !== "string" || !VALID_MODELS.includes(c.model)) {
      errors.push(`${prefix}.model must be one of: ${VALID_MODELS.join(", ")}`);
    }
  }

  // Optional: tools
  if (c.tools !== undefined) {
    if (!Array.isArray(c.tools)) {
      errors.push(`${prefix}.tools must be an array`);
    } else {
      for (const tool of c.tools) {
        if (typeof tool !== "string") {
          errors.push(`${prefix}.tools must contain only strings`);
          break;
        }
      }
    }
  }

  // Optional: disallowed_tools
  if (c.disallowed_tools !== undefined) {
    if (!Array.isArray(c.disallowed_tools)) {
      errors.push(`${prefix}.disallowed_tools must be an array`);
    } else {
      for (const tool of c.disallowed_tools) {
        if (typeof tool !== "string") {
          errors.push(`${prefix}.disallowed_tools must contain only strings`);
          break;
        }
      }
    }
  }

  // Optional: permission_mode
  if (c.permission_mode !== undefined) {
    if (
      typeof c.permission_mode !== "string" ||
      !VALID_PERMISSION_MODES.includes(c.permission_mode)
    ) {
      errors.push(`${prefix}.permission_mode must be one of: ${VALID_PERMISSION_MODES.join(", ")}`);
    }
  }

  // Optional: skills
  if (c.skills !== undefined) {
    if (!Array.isArray(c.skills)) {
      errors.push(`${prefix}.skills must be an array`);
    } else {
      for (const skill of c.skills) {
        const skillError = validateSkillEntry(skill);
        if (skillError) {
          errors.push(`${prefix}.skills: ${skillError}`);
        }
      }
    }
  }

  // Optional: hooks
  if (c.hooks !== undefined) {
    if (typeof c.hooks !== "object" || c.hooks === null) {
      errors.push(`${prefix}.hooks must be an object`);
    }
    // Note: Detailed hook validation could be added later if needed
  }

  return errors;
}

/**
 * Validate a single skill entry
 */
function validateSkillEntry(skill: unknown): string | null {
  if (typeof skill === "string") {
    return null; // String skill IDs are valid
  }

  if (typeof skill !== "object" || skill === null) {
    return "skills must be strings or objects";
  }

  const s = skill as Record<string, unknown>;

  if (!s.id || typeof s.id !== "string") {
    return "skill object must have an id string";
  }

  if (s.local === true && !s.path) {
    return `local skill "${s.id}" must have a path`;
  }

  if (s.preloaded !== undefined && typeof s.preloaded !== "boolean") {
    return `skill "${s.id}" preloaded must be a boolean`;
  }

  if (s.local !== undefined && typeof s.local !== "boolean") {
    return `skill "${s.id}" local must be a boolean`;
  }

  if (s.path !== undefined && typeof s.path !== "string") {
    return `skill "${s.id}" path must be a string`;
  }

  return null;
}

/**
 * Validate agent skill config (can be simple list or categorized)
 */
function validateAgentSkillConfig(agentName: string, agentSkills: unknown): string | null {
  // Check if it's a simple list (array)
  if (Array.isArray(agentSkills)) {
    for (const skill of agentSkills) {
      const skillError = validateSkillEntry(skill);
      if (skillError) {
        return `agent_skills.${agentName}: ${skillError}`;
      }
    }
    return null;
  }

  // Check if it's categorized (object with array values)
  if (typeof agentSkills === "object" && agentSkills !== null) {
    for (const [category, skills] of Object.entries(agentSkills)) {
      if (!Array.isArray(skills)) {
        return `agent_skills.${agentName}.${category} must be an array`;
      }
      for (const skill of skills) {
        const skillError = validateSkillEntry(skill);
        if (skillError) {
          return `agent_skills.${agentName}.${category}: ${skillError}`;
        }
      }
    }
    return null;
  }

  return `agent_skills.${agentName} must be an array or object`;
}

/**
 * Check if agent_skills value is in simple list format (array)
 */
export function isSimpleAgentSkills(value: unknown): value is SkillEntry[] {
  return Array.isArray(value);
}

/**
 * Normalize a skill entry to SkillAssignment
 */
export function normalizeSkillEntry(entry: SkillEntry): SkillAssignment {
  if (typeof entry === "string") {
    return { id: entry };
  }
  return entry;
}

/**
 * Normalize agent_skills to always be categorized format for internal use.
 * Simple lists are placed under an "uncategorized" key.
 */
export function normalizeAgentSkills(
  agentSkills: Record<string, AgentSkillConfig>,
): Record<string, Record<string, SkillAssignment[]>> {
  return mapValues(agentSkills, (skills) => {
    if (isSimpleAgentSkills(skills)) {
      // Simple list -> put under "uncategorized"
      return { uncategorized: skills.map(normalizeSkillEntry) };
    }
    // Already categorized -> normalize entries
    return mapValues(skills, (categorySkills) => categorySkills.map(normalizeSkillEntry));
  });
}
