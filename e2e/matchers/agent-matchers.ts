import path from "path";
import { readFile } from "fs/promises";
import { DIRS } from "../pages/constants.js";
import { fileExists } from "../helpers/test-utils.js";

/** Lightweight YAML line parser for frontmatter -- handles scalars and one array */
function parseYamlFrontmatter(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let arrayKey = "";
  let arrayItems: string[] = [];

  for (const line of lines) {
    if (/^\w+:$/.test(line.trim())) {
      if (arrayKey) {
        result[arrayKey] = [...arrayItems];
        arrayItems = [];
      }
      arrayKey = line.trim().slice(0, -1);
      continue;
    }
    if (arrayKey && line.trim().startsWith("- ")) {
      arrayItems.push(line.trim().slice(2));
      continue;
    }
    if (arrayKey) {
      result[arrayKey] = [...arrayItems];
      arrayKey = "";
      arrayItems = [];
    }
    const keyMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) result[keyMatch[1]] = keyMatch[2];
  }
  if (arrayKey && arrayItems.length > 0) result[arrayKey] = [...arrayItems];
  return result;
}

export const agentMatchers = {
  /** Verify parsed YAML frontmatter fields of a compiled agent */
  async toHaveAgentFrontmatter(
    received: { dir: string },
    agentName: string,
    expectations: {
      name?: string;
      description?: string;
      model?: string;
      tools?: string[];
      skills?: string[];
      hasSkills?: boolean;
      noSkills?: boolean;
    },
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
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      return {
        pass: false,
        message: () => `Expected agent "${agentName}" to have YAML frontmatter but none was found`,
      };
    }

    const fm = parseYamlFrontmatter(fmMatch[1]);

    if (expectations.name && fm.name !== expectations.name) {
      return {
        pass: false,
        message: () =>
          `Expected agent frontmatter name to be "${expectations.name}" but got "${fm.name}"`,
      };
    }

    if (expectations.description && fm.description !== expectations.description) {
      return {
        pass: false,
        message: () =>
          `Expected agent frontmatter description to be "${expectations.description}" but got "${fm.description}"`,
      };
    }

    if (expectations.model && fm.model !== expectations.model) {
      return {
        pass: false,
        message: () =>
          `Expected agent frontmatter model to be "${expectations.model}" but got "${fm.model}"`,
      };
    }

    if (expectations.tools) {
      const tools = Array.isArray(fm.tools) ? fm.tools : [];
      for (const tool of expectations.tools) {
        if (!tools.includes(tool)) {
          return {
            pass: false,
            message: () =>
              `Expected agent frontmatter tools to contain "${tool}" but found: ${JSON.stringify(tools)}`,
          };
        }
      }
    }

    if (expectations.skills) {
      const skills = Array.isArray(fm.skills) ? fm.skills : [];
      for (const skill of expectations.skills) {
        if (!skills.includes(skill)) {
          return {
            pass: false,
            message: () =>
              `Expected agent frontmatter skills to contain "${skill}" but found: ${JSON.stringify(skills)}`,
          };
        }
      }
    }

    if (expectations.hasSkills) {
      const skills = Array.isArray(fm.skills) ? fm.skills : [];
      if (skills.length === 0) {
        return {
          pass: false,
          message: () => `Expected agent frontmatter to have skills but found none`,
        };
      }
    }

    if (expectations.noSkills) {
      const skills = Array.isArray(fm.skills) ? fm.skills : [];
      if (skills.length > 0) {
        return {
          pass: false,
          message: () =>
            `Expected agent frontmatter to have no skills but found: ${JSON.stringify(skills)}`,
        };
      }
    }

    return {
      pass: true,
      message: () => `Expected agent "${agentName}" frontmatter to not match expectations`,
    };
  },

  /** Verify dynamic skill activation section in agent body */
  async toHaveAgentDynamicSkills(
    received: { dir: string },
    agentName: string,
    expectations: {
      skillIds?: string[];
      noSkillIds?: string[];
      hasActivationProtocol?: boolean;
      allPreloaded?: boolean;
    },
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
    const body = content.split(/^---\n[\s\S]*?\n---\n/m)[1] ?? content;

    if (expectations.skillIds) {
      for (const id of expectations.skillIds) {
        if (!body.includes(id)) {
          return {
            pass: false,
            message: () =>
              `Expected agent body to contain skill "${id}" but it does not.\nBody excerpt:\n${body.slice(0, 500)}`,
          };
        }
      }
    }

    if (expectations.noSkillIds) {
      for (const id of expectations.noSkillIds) {
        if (body.includes(id)) {
          return {
            pass: false,
            message: () => `Expected agent body to NOT contain skill "${id}" but it does`,
          };
        }
      }
    }

    if (expectations.hasActivationProtocol) {
      const hasProtocol = body.includes("<skill_activation_protocol>");
      const hasNote = body.includes("<skills_note>");
      if (!hasProtocol && !hasNote) {
        return {
          pass: false,
          message: () =>
            `Expected agent body to have skill activation protocol or skills note but found neither`,
        };
      }
    }

    if (expectations.allPreloaded) {
      const hasDynamic = body.includes("<skill_activation_protocol>");
      if (hasDynamic) {
        return {
          pass: false,
          message: () =>
            `Expected all skills to be preloaded (no activation protocol) but found <skill_activation_protocol>`,
        };
      }
    }

    return {
      pass: true,
      message: () => `Expected agent "${agentName}" dynamic skills to not match expectations`,
    };
  },
};
