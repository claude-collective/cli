import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock file system operations
vi.mock("../utils/fs", () => ({
  readFile: vi.fn(),
  glob: vi.fn().mockResolvedValue([]),
  directoryExists: vi.fn().mockResolvedValue(false),
}));

// Mock logger
vi.mock("../utils/logger", () => ({
  verbose: vi.fn(),
  warn: vi.fn(),
}));

import { parseFrontmatter, loadAllAgents, loadProjectAgents, loadSkillsByIds } from "./loader";
import { readFile, glob, directoryExists } from "../utils/fs";
import { warn } from "../utils/logger";
import type { SkillId } from "../types-matrix";

// =============================================================================
// Helpers
// =============================================================================

function makeSkillMd(name: string, description: string): string {
  return `---
name: ${name}
description: ${description}
---

# ${name}

Content`;
}

function makeAgentYaml(id: string): string {
  return `id: ${id}
title: ${id} Agent
description: Test ${id} agent
tools:
  - Read
  - Write`;
}

// =============================================================================
// parseFrontmatter
// =============================================================================

describe("parseFrontmatter", () => {
  it("should parse valid frontmatter with name and description", () => {
    const content = `---
name: ${"web-framework-react"}
description: React component patterns and hooks
---

# React Skill

Content here...`;

    const result = parseFrontmatter(content);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("web-framework-react");
    expect(result?.description).toBe("React component patterns and hooks");
  });

  it("should return null for content without frontmatter", () => {
    const content = `# Just a markdown file

No frontmatter here.`;

    const result = parseFrontmatter(content);

    expect(result).toBeNull();
  });

  it("should return null for invalid frontmatter (missing name)", () => {
    const content = `---
description: Missing name field
---

Content`;

    const result = parseFrontmatter(content);

    expect(result).toBeNull();
  });

  it("should return null for invalid frontmatter (missing description)", () => {
    const content = `---
name: skill-name
---

Content`;

    const result = parseFrontmatter(content);

    expect(result).toBeNull();
  });

  it("should handle frontmatter with additional fields", () => {
    const content = `---
name: ${"api-framework-hono"}
description: API patterns
version: 1
author: "@test"
tags:
  - api
  - api
---

Content`;

    const result = parseFrontmatter(content);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("api-framework-hono");
    expect(result?.description).toBe("API patterns");
  });

  it("should handle multiline description", () => {
    const content = `---
name: complex-skill
description: >
  This is a multiline
  description that spans
  multiple lines
---

Content`;

    const result = parseFrontmatter(content);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("complex-skill");
    expect(result?.description).toContain("multiline");
  });

  it("should handle frontmatter at the very start", () => {
    const content = `---
name: skill
description: desc
---`;

    const result = parseFrontmatter(content);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("skill");
  });

  it("should not parse frontmatter that is not at the start", () => {
    const content = `Some text before

---
name: skill
description: desc
---`;

    const result = parseFrontmatter(content);

    expect(result).toBeNull();
  });

  it("should handle empty content between frontmatter delimiters", () => {
    const content = `---
---

Content`;

    const result = parseFrontmatter(content);

    expect(result).toBeNull();
  });

  it("should not handle frontmatter with Windows line endings (current limitation)", () => {
    const content = "---\r\nname: skill\r\ndescription: desc\r\n---\r\n\r\nContent";

    const result = parseFrontmatter(content);

    // The current regex expects \n only, not \r\n
    // This is a known limitation - SKILL.md files should use Unix line endings
    expect(result).toBeNull();
  });
});

// =============================================================================
// loadAllAgents — error handling
// =============================================================================

describe("loadAllAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should warn and skip when agent.yaml has invalid YAML", async () => {
    vi.mocked(glob).mockResolvedValue(["bad-agent/agent.yaml"]);
    vi.mocked(readFile).mockResolvedValue("not: valid: yaml: [[[");

    const result = await loadAllAgents("/project");

    expect(result).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid agent.yaml"));
  });

  it("should warn and skip when agent.yaml fails schema validation", async () => {
    // Valid YAML but missing required fields (no id, title, description, tools)
    vi.mocked(glob).mockResolvedValue(["incomplete/agent.yaml"]);
    vi.mocked(readFile).mockResolvedValue("some_field: value\n");

    const result = await loadAllAgents("/project");

    expect(result).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid agent.yaml"));
  });

  it("should load valid agents and skip invalid ones", async () => {
    vi.mocked(glob).mockResolvedValue(["web-developer/agent.yaml", "bad-agent/agent.yaml"]);
    vi.mocked(readFile)
      .mockResolvedValueOnce(makeAgentYaml("web-developer"))
      .mockResolvedValueOnce("not valid yaml [[[");

    const result = await loadAllAgents("/project");

    expect(Object.keys(result)).toEqual(["web-developer"]);
    expect(result["web-developer"]?.title).toBe("web-developer Agent");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// loadProjectAgents — error handling
// =============================================================================

describe("loadProjectAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty object when project agents directory does not exist", async () => {
    vi.mocked(directoryExists).mockResolvedValue(false);

    const result = await loadProjectAgents("/project");

    expect(result).toEqual({});
  });

  it("should warn and skip when project agent.yaml parsing fails", async () => {
    vi.mocked(directoryExists).mockResolvedValue(true);
    vi.mocked(glob).mockResolvedValue(["broken/agent.yaml"]);
    vi.mocked(readFile).mockResolvedValue("invalid: yaml: [[[");

    const result = await loadProjectAgents("/project");

    expect(result).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid agent.yaml"));
  });

  it("should warn and skip when project agent.yaml fails schema validation", async () => {
    vi.mocked(directoryExists).mockResolvedValue(true);
    vi.mocked(glob).mockResolvedValue(["incomplete/agent.yaml"]);
    vi.mocked(readFile).mockResolvedValue("some_field: value\n");

    const result = await loadProjectAgents("/project");

    expect(result).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid agent.yaml"));
  });

  it("should load valid project agents and skip invalid ones", async () => {
    vi.mocked(directoryExists).mockResolvedValue(true);
    vi.mocked(glob).mockResolvedValue(["api-developer/agent.yaml", "broken/agent.yaml"]);
    vi.mocked(readFile)
      .mockResolvedValueOnce(makeAgentYaml("api-developer"))
      .mockResolvedValueOnce("totally invalid");

    const result = await loadProjectAgents("/project");

    expect(Object.keys(result)).toEqual(["api-developer"]);
    expect(result["api-developer"]?.title).toBe("api-developer Agent");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// loadSkillsByIds — error handling
// =============================================================================

describe("loadSkillsByIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should warn for unknown skill references", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // buildIdToDirectoryPathMap returns empty — no SKILL.md files found
    vi.mocked(glob).mockResolvedValue([]);

    const result = await loadSkillsByIds([{ id: "nonexistent-skill" as SkillId }], "/project");

    expect(result).toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unknown skill reference 'nonexistent-skill'"),
    );

    consoleWarnSpy.mockRestore();
  });

  it("should warn when skill not found in directory map after expansion", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // buildIdToDirectoryPathMap: skill "my-skill" maps to "my-skill" directory
    vi.mocked(glob).mockResolvedValue(["my-skill/SKILL.md"]);
    vi.mocked(readFile)
      // First call: buildIdToDirectoryPathMap reads the SKILL.md
      .mockResolvedValueOnce(makeSkillMd("my-skill", "A skill"))
      // Second call: loadSkillsByIds reads the SKILL.md again, but this time readFile throws
      .mockRejectedValueOnce(new Error("ENOENT"));

    const result = await loadSkillsByIds([{ id: "my-skill" as SkillId }], "/project");

    // The skill should be skipped due to the readFile error
    expect(result).toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Could not load skill my-skill"),
    );

    consoleWarnSpy.mockRestore();
  });

  it("should warn and skip skill with invalid frontmatter", async () => {
    // buildIdToDirectoryPathMap: SKILL.md found with valid frontmatter
    vi.mocked(glob).mockResolvedValue(["bad-skill/SKILL.md"]);
    // Second call: loadSkillsByIds reads SKILL.md — this time invalid frontmatter
    vi
      .mocked(readFile)
      // First call: buildIdToDirectoryPathMap reads SKILL.md — valid frontmatter
      .mockResolvedValueOnce(makeSkillMd("bad-skill", "A skill")).mockResolvedValueOnce(`---
description: missing name field
---

Content`);

    const result = await loadSkillsByIds([{ id: "bad-skill" as SkillId }], "/project");

    expect(result).toEqual({});
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Skipping bad-skill: Missing or invalid frontmatter"),
    );
  });

  it("should warn and skip skill when readFile throws", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // buildIdToDirectoryPathMap: SKILL.md found
    vi.mocked(glob).mockResolvedValue(["error-skill/SKILL.md"]);
    vi.mocked(readFile)
      // First call: buildIdToDirectoryPathMap reads SKILL.md — valid
      .mockResolvedValueOnce(makeSkillMd("error-skill", "A skill"))
      // Second call: loadSkillsByIds reads SKILL.md — throws (permission error, etc.)
      .mockRejectedValueOnce(new Error("EACCES: permission denied"));

    const result = await loadSkillsByIds([{ id: "error-skill" as SkillId }], "/project");

    expect(result).toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Could not load skill error-skill"),
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("EACCES: permission denied"),
    );

    consoleWarnSpy.mockRestore();
  });

  it("should load valid skills and skip ones with errors", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.mocked(glob).mockResolvedValue(["good-skill/SKILL.md", "bad-skill/SKILL.md"]);
    vi.mocked(readFile)
      // buildIdToDirectoryPathMap: reads both SKILL.md files
      .mockResolvedValueOnce(makeSkillMd("good-skill", "Good skill"))
      .mockResolvedValueOnce(makeSkillMd("bad-skill", "Bad skill"))
      // loadSkillsByIds: reads them again
      .mockResolvedValueOnce(makeSkillMd("good-skill", "Good skill"))
      .mockRejectedValueOnce(new Error("Disk failure"));

    const result = await loadSkillsByIds(
      [{ id: "good-skill" as SkillId }, { id: "bad-skill" as SkillId }],
      "/project",
    );

    expect(result["good-skill"]).toBeDefined();
    expect(result["good-skill"]?.id).toBe("good-skill");
    expect(result["bad-skill"]).toBeUndefined();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Could not load skill bad-skill"),
    );

    consoleWarnSpy.mockRestore();
  });
});
