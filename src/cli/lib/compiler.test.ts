import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentConfig, AgentName, CompileContext, Skill, SkillId } from "../types";

// Mock file system (manual mock from __mocks__ directory)
vi.mock("../utils/fs");

// Mock resolver
vi.mock("./resolver", () => ({
  resolveClaudeMd: vi.fn().mockResolvedValue("/project/src/stacks/default/CLAUDE.md"),
}));

// Mock output-validator
vi.mock("./output-validator", () => ({
  validateCompiledAgent: vi.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
  printOutputValidationResult: vi.fn(),
}));

// Mock logger (manual mock from __mocks__ directory)
vi.mock("../utils/logger");

import {
  compileAllAgents,
  compileAllSkills,
  copyClaude,
  compileAllCommands,
  createLiquidEngine,
  cleanOutputDir,
} from "./compiler";
import {
  readFile,
  readFileOptional,
  writeFile,
  ensureDir,
  remove,
  glob,
  fileExists,
  copy,
} from "../utils/fs";
import { validateCompiledAgent } from "./output-validator";

function createMockAgent(name: string, skills: Skill[] = []): AgentConfig {
  return {
    name,
    title: `${name} agent`,
    description: `Test ${name}`,
    tools: ["Read", "Write"],
    skills,
    path: name,
  };
}

function createMockSkillEntry(id: SkillId, preloaded = false): Skill {
  return {
    id,
    path: `skills/${id}/`,
    description: `${id} skill`,
    usage: `when working with ${id}`,
    preloaded,
  };
}

function createCompileContext(overrides?: Partial<CompileContext>): CompileContext {
  return {
    stackId: "test-stack",
    verbose: false,
    projectRoot: "/project",
    outputDir: "/project/.claude/plugins/claude-collective",
    ...overrides,
  };
}

describe("compiler", () => {
  describe("compileAllAgents", () => {
    it("creates output directory and writes compiled agents", async () => {
      // Setup: readFile returns agent file content, engine renders template
      vi.mocked(readFile).mockResolvedValue("# intro content");
      vi.mocked(readFileOptional).mockResolvedValue("");

      const engine = {
        renderFile: vi.fn().mockResolvedValue("---\nname: test\n---\n# Compiled output"),
      };

      const agents: Record<string, AgentConfig> = {
        "web-developer": createMockAgent("web-developer", [
          createMockSkillEntry("web-framework-react", true),
        ]),
      };

      const ctx = createCompileContext();

      // Use type assertion since Liquid is complex to fully mock
      await compileAllAgents(agents, ctx, engine as never);

      expect(ensureDir).toHaveBeenCalledWith("/project/.claude/plugins/claude-collective/agents");
      expect(writeFile).toHaveBeenCalledWith(
        "/project/.claude/plugins/claude-collective/agents/web-developer.md",
        expect.any(String),
      );
    });

    it("reads agent intro, workflow, and optional files", async () => {
      vi.mocked(readFile).mockResolvedValue("# content");
      vi.mocked(readFileOptional).mockResolvedValue("");

      const engine = {
        renderFile: vi.fn().mockResolvedValue("---\nname: test\n---\n# output"),
      };

      const agents: Record<string, AgentConfig> = {
        "api-developer": createMockAgent("api-developer"),
      };

      await compileAllAgents(agents, createCompileContext(), engine as never);

      // intro.md and workflow.md are required reads
      expect(readFile).toHaveBeenCalledWith(expect.stringContaining("api-developer/intro.md"));
      expect(readFile).toHaveBeenCalledWith(expect.stringContaining("api-developer/workflow.md"));
      // examples.md, critical-requirements.md, critical-reminders.md are optional
      expect(readFileOptional).toHaveBeenCalledWith(
        expect.stringContaining("api-developer/examples.md"),
        expect.any(String),
      );
    });

    it("throws descriptive error when agent compilation fails", async () => {
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT: file not found"));

      const engine = { renderFile: vi.fn() };
      const agents: Record<string, AgentConfig> = {
        "web-developer": createMockAgent("web-developer"),
      };

      await expect(
        compileAllAgents(agents, createCompileContext(), engine as never),
      ).rejects.toThrow(/Failed to compile agent 'web-developer'/);
    });

    it("validates compiled output and calls printOutputValidationResult on issues", async () => {
      vi.mocked(readFile).mockResolvedValue("# content");
      vi.mocked(readFileOptional).mockResolvedValue("");
      vi.mocked(validateCompiledAgent).mockReturnValue({
        valid: true,
        errors: [],
        warnings: ["Missing <role> section"],
      });

      const engine = {
        renderFile: vi.fn().mockResolvedValue("---\nname: test\n---\n# output"),
      };

      const agents: Record<string, AgentConfig> = {
        "web-developer": createMockAgent("web-developer"),
      };

      await compileAllAgents(agents, createCompileContext(), engine as never);

      expect(validateCompiledAgent).toHaveBeenCalled();
      const { printOutputValidationResult } = await import("./output-validator");
      expect(printOutputValidationResult).toHaveBeenCalledWith(
        "web-developer",
        expect.objectContaining({ warnings: ["Missing <role> section"] }),
      );
    });
  });

  describe("compileAllSkills", () => {
    it("copies folder-based skills with SKILL.md", async () => {
      vi.mocked(readFile).mockResolvedValue("# Skill content");
      vi.mocked(readFileOptional).mockResolvedValue(undefined as never);
      vi.mocked(fileExists).mockResolvedValue(false);

      const agents: Record<string, AgentConfig> = {
        "web-developer": createMockAgent("web-developer", [
          createMockSkillEntry("web-framework-react"),
        ]),
      };
      // Skill has a folder path (ends with /)
      agents["web-developer"].skills[0].path = "skills/web-framework-react/";

      const ctx = createCompileContext();
      await compileAllSkills(agents, ctx);

      expect(ensureDir).toHaveBeenCalledWith(expect.stringContaining("skills/web-framework-react"));
      expect(readFile).toHaveBeenCalledWith("/project/skills/web-framework-react/SKILL.md");
    });

    it("copies single-file skills", async () => {
      vi.mocked(readFile).mockResolvedValue("# Single file skill");

      const agents: Record<string, AgentConfig> = {
        "web-developer": createMockAgent("web-developer", [
          { ...createMockSkillEntry("web-testing-vitest"), path: "skills/web-testing-vitest.md" },
        ]),
      };

      const ctx = createCompileContext();
      await compileAllSkills(agents, ctx);

      expect(readFile).toHaveBeenCalledWith("/project/skills/web-testing-vitest.md");
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("SKILL.md"),
        "# Single file skill",
      );
    });

    it("deduplicates skills across agents", async () => {
      vi.mocked(readFile).mockResolvedValue("# content");

      const sharedSkill: Skill = {
        ...createMockSkillEntry("web-framework-react"),
        path: "skills/react.md",
      };

      const agents: Record<string, AgentConfig> = {
        "web-developer": createMockAgent("web-developer", [sharedSkill]),
        "web-reviewer": createMockAgent("web-reviewer", [sharedSkill]),
      };

      const ctx = createCompileContext();
      await compileAllSkills(agents, ctx);

      // Should only read the skill file once (uniqueBy deduplication)
      const readCalls = vi
        .mocked(readFile)
        .mock.calls.filter((call) => call[0] === "/project/skills/react.md");
      expect(readCalls).toHaveLength(1);
    });

    it("throws descriptive error when skill file is missing", async () => {
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const agents: Record<string, AgentConfig> = {
        "web-developer": createMockAgent("web-developer", [
          { ...createMockSkillEntry("web-missing-skill"), path: "skills/missing.md" },
        ]),
      };

      await expect(compileAllSkills(agents, createCompileContext())).rejects.toThrow(
        /Failed to compile skill 'web-missing-skill'/,
      );
    });
  });

  describe("copyClaude", () => {
    it("reads resolved CLAUDE.md and writes to output", async () => {
      vi.mocked(readFile).mockResolvedValue("# CLAUDE.md content");

      const ctx = createCompileContext();
      await copyClaude(ctx);

      expect(readFile).toHaveBeenCalledWith("/project/src/stacks/default/CLAUDE.md");
      expect(writeFile).toHaveBeenCalledWith(
        "/project/.claude/plugins/CLAUDE.md",
        "# CLAUDE.md content",
      );
    });
  });

  describe("compileAllCommands", () => {
    it("skips when commands directory does not exist", async () => {
      vi.mocked(fileExists).mockResolvedValue(false);

      await compileAllCommands(createCompileContext());

      expect(glob).not.toHaveBeenCalled();
      expect(writeFile).not.toHaveBeenCalled();
    });

    it("copies command files to output directory", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(glob).mockResolvedValue(["deploy.md", "test.md"]);
      vi.mocked(readFile).mockResolvedValue("# Command content");

      await compileAllCommands(createCompileContext());

      expect(ensureDir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledTimes(2);
    });

    it("skips when no command files found", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(glob).mockResolvedValue([]);

      await compileAllCommands(createCompileContext());

      expect(writeFile).not.toHaveBeenCalled();
    });

    it("throws descriptive error when command file read fails", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(glob).mockResolvedValue(["deploy.md"]);
      vi.mocked(readFile).mockRejectedValue(new Error("EACCES: permission denied"));

      await expect(compileAllCommands(createCompileContext())).rejects.toThrow(
        /Failed to compile command 'deploy\.md'.*EACCES/,
      );
    });
  });

  describe("cleanOutputDir", () => {
    it("removes agents, skills, and commands directories", async () => {
      await cleanOutputDir("/output");

      expect(remove).toHaveBeenCalledWith("/output/agents");
      expect(remove).toHaveBeenCalledWith("/output/skills");
      expect(remove).toHaveBeenCalledWith("/output/commands");
    });
  });

  describe("createLiquidEngine", () => {
    it("creates engine with default template root", async () => {
      const engine = await createLiquidEngine();

      expect(engine).toBeDefined();
      // Engine should be a Liquid instance with renderFile method
      expect(typeof engine.renderFile).toBe("function");
    });

    it("checks for local template overrides when projectDir provided", async () => {
      const { directoryExists } = await import("../utils/fs");
      vi.mocked(directoryExists).mockResolvedValue(false);

      const engine = await createLiquidEngine("/my-project");

      expect(directoryExists).toHaveBeenCalledWith(
        expect.stringContaining(".claude-src/agents/_templates"),
      );
      expect(engine).toBeDefined();
    });
  });
});
