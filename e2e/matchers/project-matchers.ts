import path from "path";
import { readFile, readdir } from "fs/promises";
import { DIRS, FILES } from "../pages/constants.js";

export type PluginScope = "project" | "user";
type AgentContentExpectations = {
  contains?: string[];
  notContains?: string[];
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    await readdir(dirPath);
    return true;
  } catch {
    return false;
  }
}

export type ConfigExpectations = {
  skillIds?: string[];
  source?: string;
  agents?: string[];
};

export const projectMatchers = {
  /**
   * Checks that .claude-src/config.ts exists and optionally validates content.
   * Usage: await expect(project).toHaveConfig({ skillIds: ["web-framework-react"] })
   */
  async toHaveConfig(received: { dir: string }, expectations?: ConfigExpectations) {
    const configPath = path.join(received.dir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
    const exists = await fileExists(configPath);

    if (!exists) {
      return {
        pass: false,
        message: () => `Expected config.ts at ${configPath} but it does not exist`,
      };
    }

    if (!expectations) {
      return {
        pass: true,
        message: () => `Expected config.ts to not exist at ${configPath}`,
      };
    }

    const content = await readFile(configPath, "utf-8");

    if (expectations.skillIds) {
      for (const id of expectations.skillIds) {
        if (!content.includes(id)) {
          return {
            pass: false,
            message: () =>
              `Expected config.ts to contain skill "${id}" but it does not.\nContent:\n${content}`,
          };
        }
      }
    }

    if (expectations.source) {
      if (!content.includes(expectations.source)) {
        return {
          pass: false,
          message: () =>
            `Expected config.ts to contain source "${expectations.source}" but it does not.\nContent:\n${content}`,
        };
      }
    }

    if (expectations.agents) {
      for (const agent of expectations.agents) {
        if (!content.includes(agent)) {
          return {
            pass: false,
            message: () =>
              `Expected config.ts to contain agent "${agent}" but it does not.\nContent:\n${content}`,
          };
        }
      }
    }

    return {
      pass: true,
      message: () => `Expected config.ts to not match expectations`,
    };
  },

  /**
   * Checks that compiled agent .md files exist in .claude/agents/.
   */
  async toHaveCompiledAgents(received: { dir: string }) {
    const agentsDir = path.join(received.dir, DIRS.CLAUDE, DIRS.AGENTS);
    const exists = await directoryExists(agentsDir);

    if (!exists) {
      return {
        pass: false,
        message: () => `Expected agents directory at ${agentsDir} but it does not exist`,
      };
    }

    const entries = await readdir(agentsDir);
    const mdFiles = entries.filter((f) => f.endsWith(".md"));

    if (mdFiles.length === 0) {
      return {
        pass: false,
        message: () =>
          `Expected compiled agent .md files in ${agentsDir} but found none. Entries: ${entries.join(", ")}`,
      };
    }

    return {
      pass: true,
      message: () => `Expected no compiled agents in ${agentsDir} but found: ${mdFiles.join(", ")}`,
    };
  },

  /**
   * Checks that a specific agent was compiled (has .md file with frontmatter).
   */
  async toHaveCompiledAgent(received: { dir: string }, agentName: string) {
    const agentPath = path.join(received.dir, DIRS.CLAUDE, DIRS.AGENTS, `${agentName}.md`);
    const exists = await fileExists(agentPath);

    if (!exists) {
      return {
        pass: false,
        message: () => `Expected compiled agent at ${agentPath} but it does not exist`,
      };
    }

    const content = await readFile(agentPath, "utf-8");
    if (!content.startsWith("---")) {
      return {
        pass: false,
        message: () =>
          `Expected agent file to start with YAML frontmatter but got:\n${content.slice(0, 100)}`,
      };
    }

    return {
      pass: true,
      message: () => `Expected no compiled agent "${agentName}" at ${agentPath}`,
    };
  },

  /**
   * Checks that a skill was copied locally.
   */
  async toHaveSkillCopied(received: { dir: string }, skillId: string) {
    const skillMdPath = path.join(received.dir, DIRS.CLAUDE, DIRS.SKILLS, skillId, FILES.SKILL_MD);
    const exists = await fileExists(skillMdPath);

    return {
      pass: exists,
      message: () =>
        exists
          ? `Expected skill "${skillId}" to not be copied locally`
          : `Expected skill "${skillId}" to be copied locally at ${skillMdPath}`,
    };
  },

  /**
   * Checks that no local skills exist.
   */
  async toHaveNoLocalSkills(received: { dir: string }) {
    const skillsDir = path.join(received.dir, DIRS.CLAUDE, DIRS.SKILLS);
    const exists = await directoryExists(skillsDir);

    if (!exists) {
      return { pass: true, message: () => `Expected local skills to exist` };
    }

    const entries = await readdir(skillsDir);
    return {
      pass: entries.length === 0,
      message: () =>
        entries.length === 0
          ? `Expected local skills to exist`
          : `Expected no local skills but found: ${entries.join(", ")}`,
    };
  },

  /**
   * Checks that no plugins are enabled in settings.json.
   */
  async toHaveNoPlugins(received: { dir: string }) {
    const settingsPath = path.join(received.dir, DIRS.CLAUDE, FILES.SETTINGS_JSON);
    const exists = await fileExists(settingsPath);

    if (!exists) {
      return { pass: true, message: () => `Expected plugins to exist` };
    }

    const content = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(content);
    const enabled = settings.enabledPlugins;

    if (!enabled) {
      return { pass: true, message: () => `Expected plugins to exist` };
    }

    const activeKeys = Object.entries(enabled).filter(([, v]) => v === true);
    return {
      pass: activeKeys.length === 0,
      message: () =>
        activeKeys.length === 0
          ? `Expected plugins to exist`
          : `Expected no plugins but found: ${activeKeys.map(([k]) => k).join(", ")}`,
    };
  },

  /**
   * Checks that a plugin is enabled in settings.json.
   */
  async toHavePlugin(received: { dir: string }, pluginKey: string) {
    const settingsPath = path.join(received.dir, DIRS.CLAUDE, FILES.SETTINGS_JSON);
    const exists = await fileExists(settingsPath);

    if (!exists) {
      return {
        pass: false,
        message: () => `Expected settings.json at ${settingsPath} but it does not exist`,
      };
    }

    const content = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(content);
    const isEnabled = settings.enabledPlugins?.[pluginKey] === true;

    return {
      pass: isEnabled,
      message: () =>
        isEnabled
          ? `Expected plugin "${pluginKey}" to not be enabled`
          : `Expected plugin "${pluginKey}" to be enabled in settings.json`,
    };
  },

  /**
   * Checks that a plugin's installation record exists in the global registry
   * at <dir>/.claude/plugins/installed_plugins.json.
   */
  async toHavePluginInRegistry(received: { dir: string }, pluginKey: string, scope?: PluginScope) {
    const registryPath = path.join(
      received.dir,
      DIRS.CLAUDE,
      DIRS.PLUGINS,
      FILES.INSTALLED_PLUGINS_JSON,
    );
    const exists = await fileExists(registryPath);

    if (!exists) {
      return {
        pass: false,
        message: () => `Expected plugin registry at ${registryPath} but it does not exist`,
      };
    }

    const content = await readFile(registryPath, "utf-8");
    const registry = JSON.parse(content);
    const installations = registry.plugins?.[pluginKey];

    if (!Array.isArray(installations) || installations.length === 0) {
      return {
        pass: false,
        message: () => `Expected plugin "${pluginKey}" to be in registry but it was not found`,
      };
    }

    if (scope) {
      const hasScope = installations.some((i: { scope: string }) => i.scope === scope);
      return {
        pass: hasScope,
        message: () =>
          hasScope
            ? `Expected plugin "${pluginKey}" to not have scope "${scope}" in registry`
            : `Expected plugin "${pluginKey}" to have scope "${scope}" in registry but found: ${JSON.stringify(installations)}`,
      };
    }

    return {
      pass: true,
      message: () => `Expected plugin "${pluginKey}" to not be in registry`,
    };
  },

  /**
   * Checks that a compiled agent contains (or does not contain) expected text.
   * Usage: await expect({ dir }).toHaveCompiledAgentContent("web-developer", { contains: ["skill-id"], notContains: ["other-skill"] })
   */
  async toHaveCompiledAgentContent(
    received: { dir: string },
    agentName: string,
    expectations: AgentContentExpectations,
  ) {
    const agentPath = path.join(received.dir, DIRS.CLAUDE, DIRS.AGENTS, `${agentName}.md`);
    const exists = await fileExists(agentPath);

    if (!exists) {
      return {
        pass: false,
        message: () => `Expected compiled agent at ${agentPath} but it does not exist`,
      };
    }

    const content = await readFile(agentPath, "utf-8");

    if (expectations.contains) {
      for (const text of expectations.contains) {
        if (!content.includes(text)) {
          return {
            pass: false,
            message: () =>
              `Expected compiled agent "${agentName}" to contain "${text}" but it does not.\nContent excerpt:\n${content.slice(0, 500)}`,
          };
        }
      }
    }

    if (expectations.notContains) {
      for (const text of expectations.notContains) {
        if (content.includes(text)) {
          return {
            pass: false,
            message: () =>
              `Expected compiled agent "${agentName}" to NOT contain "${text}" but it does`,
          };
        }
      }
    }

    return {
      pass: true,
      message: () => `Expected compiled agent "${agentName}" to not match content expectations`,
    };
  },

  /**
   * Checks that the .claude/skills/ directory has the expected number of entries,
   * or optionally that specific skill IDs exist.
   */
  async toHaveLocalSkills(received: { dir: string }, expectedSkillIds?: string[]) {
    const skillsDir = path.join(received.dir, DIRS.CLAUDE, DIRS.SKILLS);
    const exists = await directoryExists(skillsDir);

    if (!exists) {
      return {
        pass: false,
        message: () => `Expected skills directory at ${skillsDir} but it does not exist`,
      };
    }

    const entries = await readdir(skillsDir);

    if (expectedSkillIds) {
      for (const id of expectedSkillIds) {
        if (!entries.includes(id)) {
          return {
            pass: false,
            message: () =>
              `Expected skill "${id}" in ${skillsDir} but found: ${entries.join(", ")}`,
          };
        }
      }
    }

    return {
      pass: true,
      message: () => `Expected no local skills but found: ${entries.join(", ")}`,
    };
  },

  /**
   * Checks that the ejected template (agent.liquid) exists.
   */
  async toHaveEjectedTemplate(received: { dir: string }) {
    const templatePath = path.join(
      received.dir,
      DIRS.CLAUDE_SRC,
      "agents",
      "_templates",
      "agent.liquid",
    );
    const exists = await fileExists(templatePath);

    return {
      pass: exists,
      message: () =>
        exists
          ? `Expected ejected template to not exist at ${templatePath}`
          : `Expected ejected template at ${templatePath} but it does not exist`,
    };
  },

  /**
   * Checks that settings.json exists and optionally validates its content.
   */
  async toHaveSettings(
    received: { dir: string },
    expectations?: { hasKey?: string; keyValue?: unknown },
  ) {
    const settingsPath = path.join(received.dir, DIRS.CLAUDE, FILES.SETTINGS_JSON);
    const exists = await fileExists(settingsPath);

    if (!exists) {
      return {
        pass: false,
        message: () => `Expected settings.json at ${settingsPath} but it does not exist`,
      };
    }

    if (!expectations) {
      return {
        pass: true,
        message: () => `Expected settings.json to not exist at ${settingsPath}`,
      };
    }

    const content = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(content);

    if (expectations.hasKey) {
      const keys = expectations.hasKey.split(".");
      let val: unknown = settings;
      for (const k of keys) {
        val = (val as Record<string, unknown>)?.[k];
      }
      if (val === undefined) {
        return {
          pass: false,
          message: () =>
            `Expected settings.json to have key "${expectations.hasKey}" but it does not.\nContent:\n${content}`,
        };
      }
      if (expectations.keyValue !== undefined && val !== expectations.keyValue) {
        return {
          pass: false,
          message: () =>
            `Expected settings.json key "${expectations.hasKey}" to be ${JSON.stringify(expectations.keyValue)} but got ${JSON.stringify(val)}`,
        };
      }
    }

    return {
      pass: true,
      message: () => `Expected settings.json to not match expectations`,
    };
  },
};
