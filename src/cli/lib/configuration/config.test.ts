import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SOURCE,
  formatOrigin,
  getProjectConfigPath,
  isLocalSource,
  loadProjectSourceConfig,
  resolveSource,
  resolveAgentsSource,
  saveProjectConfig,
  SOURCE_ENV_VAR,
  validateSourceFormat,
} from "./config";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../consts";

describe("config", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-config-test-"));
    // Clear any environment variables
    delete process.env[SOURCE_ENV_VAR];
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
    // Restore environment
    delete process.env[SOURCE_ENV_VAR];
  });

  describe("DEFAULT_SOURCE", () => {
    it("should be set to the claude-collective skills repo", () => {
      expect(DEFAULT_SOURCE).toBe("github:claude-collective/skills");
    });
  });

  describe("SOURCE_ENV_VAR", () => {
    it("should be CC_SOURCE", () => {
      expect(SOURCE_ENV_VAR).toBe("CC_SOURCE");
    });
  });

  describe("getProjectConfigPath", () => {
    it("should return path in project .claude-src directory", () => {
      const configPath = getProjectConfigPath("/my/project");
      expect(configPath).toBe(`/my/project/${CLAUDE_SRC_DIR}/${STANDARD_FILES.CONFIG_YAML}`);
    });
  });

  describe("isLocalSource", () => {
    it("should return true for absolute paths", () => {
      expect(isLocalSource("/home/user/skills")).toBe(true);
      expect(isLocalSource("/var/lib/skills")).toBe(true);
    });

    it("should return true for relative paths starting with .", () => {
      expect(isLocalSource("./skills")).toBe(true);
      expect(isLocalSource("../skills")).toBe(true);
      expect(isLocalSource(".")).toBe(true);
    });

    it("should return false for github: URLs", () => {
      expect(isLocalSource("github:org/repo")).toBe(false);
      expect(isLocalSource("gh:org/repo")).toBe(false);
    });

    it("should return false for gitlab: URLs", () => {
      expect(isLocalSource("gitlab:org/repo")).toBe(false);
    });

    it("should return false for https: URLs", () => {
      expect(isLocalSource("https://github.com/org/repo")).toBe(false);
      expect(isLocalSource("http://github.com/org/repo")).toBe(false);
    });

    it("should return true for paths without protocol prefix", () => {
      // Plain directory names without / or . prefix are ambiguous
      // but we treat them as local
      expect(isLocalSource("my-skills")).toBe(true);
    });

    it("should throw error for path traversal in bare names", () => {
      // Bare names (no / or . prefix) with traversal patterns are suspicious
      expect(() => isLocalSource("my-skills/../../../etc")).toThrow(
        /Path traversal patterns like '\.\.' and '~' are not allowed for security reasons/,
      );
    });

    it("should throw error for home directory expansion in bare names", () => {
      // Bare names with ~ are suspicious since shell expansion doesn't happen
      expect(() => isLocalSource("skills~backup")).toThrow(
        /Path traversal patterns like '\.\.' and '~' are not allowed for security reasons/,
      );
    });

    it("should allow legitimate relative paths with ..", () => {
      // Paths starting with . are recognized as relative and allowed
      expect(isLocalSource("../../../other-project/skills")).toBe(true);
      expect(isLocalSource("../skills")).toBe(true);
    });
  });

  describe("validateSourceFormat", () => {
    describe("valid sources", () => {
      it("should accept valid github: shorthand", () => {
        expect(() => validateSourceFormat("github:user/repo", "--source")).not.toThrow();
        expect(() => validateSourceFormat("github:org/my-skills", "--source")).not.toThrow();
      });

      it("should accept valid gh: shorthand", () => {
        expect(() => validateSourceFormat("gh:user/repo", "--source")).not.toThrow();
      });

      it("should accept valid gitlab: shorthand", () => {
        expect(() => validateSourceFormat("gitlab:user/repo", "--source")).not.toThrow();
      });

      it("should accept valid bitbucket: shorthand", () => {
        expect(() => validateSourceFormat("bitbucket:user/repo", "--source")).not.toThrow();
      });

      it("should accept valid sourcehut: shorthand", () => {
        expect(() => validateSourceFormat("sourcehut:user/repo", "--source")).not.toThrow();
      });

      it("should accept valid https:// URLs", () => {
        expect(() =>
          validateSourceFormat("https://github.com/user/repo", "--source"),
        ).not.toThrow();
        expect(() =>
          validateSourceFormat("https://gitlab.company.com/team/skills", "--source"),
        ).not.toThrow();
      });

      it("should accept valid http:// URLs", () => {
        expect(() => validateSourceFormat("http://github.com/user/repo", "--source")).not.toThrow();
      });

      it("should accept localhost URLs", () => {
        expect(() => validateSourceFormat("https://localhost/repo", "--source")).not.toThrow();
      });

      it("should accept valid local paths", () => {
        expect(() => validateSourceFormat("./my-skills", "--source")).not.toThrow();
        expect(() => validateSourceFormat("../other-project/skills", "--source")).not.toThrow();
        expect(() => validateSourceFormat("/home/user/skills", "--source")).not.toThrow();
        expect(() => validateSourceFormat("my-skills", "--source")).not.toThrow();
      });
    });

    describe("invalid remote sources", () => {
      it("should reject incomplete github: shorthand", () => {
        expect(() => validateSourceFormat("github:", "--source")).toThrow(/incomplete URL/);
        expect(() => validateSourceFormat("github:x", "--source")).toThrow(/incomplete URL/);
      });

      it("should reject github: without owner/repo format", () => {
        expect(() => validateSourceFormat("github:just-a-name", "--source")).toThrow(
          /owner\/repo format/,
        );
      });

      it("should reject incomplete gh: shorthand", () => {
        expect(() => validateSourceFormat("gh:", "--source")).toThrow(/incomplete URL/);
      });

      it("should reject gh: without owner/repo format", () => {
        expect(() => validateSourceFormat("gh:just-a-name", "--source")).toThrow(
          /owner\/repo format/,
        );
      });

      it("should reject incomplete https:// URLs", () => {
        expect(() => validateSourceFormat("https://", "--source")).toThrow(/incomplete URL/);
        expect(() => validateSourceFormat("https://x", "--source")).toThrow(/incomplete URL/);
      });

      it("should reject https:// URLs without valid hostname", () => {
        expect(() => validateSourceFormat("https://not-a-host/repo", "--source")).toThrow(
          /invalid URL/,
        );
      });

      it("should reject http:// URLs without valid hostname", () => {
        expect(() => validateSourceFormat("http://", "--source")).toThrow(/incomplete URL/);
        expect(() => validateSourceFormat("http://x", "--source")).toThrow(/incomplete URL/);
        expect(() => validateSourceFormat("http://not-a-host/repo", "--source")).toThrow(
          /invalid URL/,
        );
      });
    });

    describe("invalid local sources", () => {
      it("should reject paths with control characters", () => {
        expect(() => validateSourceFormat("my-skills\x00", "--source")).toThrow(
          /invalid characters/,
        );
        expect(() => validateSourceFormat("my\x07skills", "--source")).toThrow(
          /invalid characters/,
        );
      });

      it("should reject UNC paths (Windows network paths)", () => {
        expect(() => validateSourceFormat("//attacker.com/payload", "--source")).toThrow(
          /UNC network path/,
        );
        expect(() => validateSourceFormat("\\\\attacker.com\\share", "--source")).toThrow(
          /UNC network path/,
        );
        expect(() => validateSourceFormat("//192.168.1.1/share", "--source")).toThrow(
          /UNC network path/,
        );
      });
    });

    describe("null byte validation", () => {
      it("should reject null bytes in any source type", () => {
        expect(() => validateSourceFormat("github:user/repo\x00", "--source")).toThrow(
          /null bytes/,
        );
        expect(() => validateSourceFormat("https://github.com/user/repo\x00", "--source")).toThrow(
          /null bytes/,
        );
        expect(() => validateSourceFormat("./my-\x00skills", "--source")).toThrow(/null bytes/);
      });
    });

    describe("path traversal in remote sources", () => {
      it("should reject .. in git shorthand paths", () => {
        expect(() => validateSourceFormat("github:user/repo/../other", "--source")).toThrow(
          /path traversal/,
        );
        expect(() => validateSourceFormat("gh:user/../../etc", "--source")).toThrow(
          /path traversal/,
        );
      });

      it("should reject .. in HTTP URL paths", () => {
        expect(() =>
          validateSourceFormat("https://github.com/user/../admin/repo", "--source"),
        ).toThrow(/path traversal/);
        expect(() =>
          validateSourceFormat("http://gitlab.com/user/repo/../../etc", "--source"),
        ).toThrow(/path traversal/);
      });

      it("should reject .. in git ref query parameters", () => {
        expect(() =>
          validateSourceFormat("github:user/repo?branch=../../etc/passwd", "--source"),
        ).toThrow(/path traversal/);
        expect(() => validateSourceFormat("gh:user/repo#../sensitive", "--source")).toThrow(
          /path traversal/,
        );
      });

      it("should accept legitimate paths without traversal", () => {
        expect(() => validateSourceFormat("github:user/repo", "--source")).not.toThrow();
        expect(() =>
          validateSourceFormat("https://github.com/user/repo/tree/main", "--source"),
        ).not.toThrow();
        expect(() => validateSourceFormat("gitlab:team/skills", "--source")).not.toThrow();
      });
    });

    describe("private IP address validation", () => {
      it("should reject loopback addresses", () => {
        expect(() => validateSourceFormat("https://127.0.0.1/repo", "--source")).toThrow(
          /private or reserved IP/,
        );
        expect(() => validateSourceFormat("http://127.0.0.1/repo", "--source")).toThrow(
          /private or reserved IP/,
        );
        expect(() => validateSourceFormat("https://127.255.255.255/repo", "--source")).toThrow(
          /private or reserved IP/,
        );
      });

      it("should reject private network addresses (10.x.x.x)", () => {
        expect(() => validateSourceFormat("https://10.0.0.1/repo", "--source")).toThrow(
          /private or reserved IP/,
        );
        expect(() => validateSourceFormat("https://10.255.255.255/repo", "--source")).toThrow(
          /private or reserved IP/,
        );
      });

      it("should reject private network addresses (172.16-31.x.x)", () => {
        expect(() => validateSourceFormat("https://172.16.0.1/repo", "--source")).toThrow(
          /private or reserved IP/,
        );
        expect(() => validateSourceFormat("https://172.31.255.255/repo", "--source")).toThrow(
          /private or reserved IP/,
        );
      });

      it("should reject private network addresses (192.168.x.x)", () => {
        expect(() => validateSourceFormat("https://192.168.0.1/repo", "--source")).toThrow(
          /private or reserved IP/,
        );
        expect(() => validateSourceFormat("https://192.168.1.100/repo", "--source")).toThrow(
          /private or reserved IP/,
        );
      });

      it("should reject 0.0.0.0", () => {
        expect(() => validateSourceFormat("https://0.0.0.0/repo", "--source")).toThrow(
          /private or reserved IP/,
        );
      });

      it("should reject link-local addresses (169.254.x.x)", () => {
        expect(() => validateSourceFormat("https://169.254.1.1/repo", "--source")).toThrow(
          /private or reserved IP/,
        );
      });

      it("should reject IPv6 loopback", () => {
        expect(() => validateSourceFormat("https://[::1]/repo", "--source")).toThrow(
          /private or reserved IP/,
        );
      });

      it("should allow public IP addresses", () => {
        expect(() => validateSourceFormat("https://8.8.8.8/repo", "--source")).not.toThrow();
        expect(() => validateSourceFormat("https://1.2.3.4/repo", "--source")).not.toThrow();
      });

      it("should allow non-private 172.x addresses", () => {
        expect(() => validateSourceFormat("https://172.32.0.1/repo", "--source")).not.toThrow();
        expect(() => validateSourceFormat("https://172.15.0.1/repo", "--source")).not.toThrow();
      });

      it("should still allow localhost by hostname", () => {
        expect(() => validateSourceFormat("https://localhost/repo", "--source")).not.toThrow();
      });
    });

    describe("length validation", () => {
      it("should reject sources exceeding max length", () => {
        const longSource = "a".repeat(513);
        expect(() => validateSourceFormat(longSource, "--source")).toThrow(/too long/);
      });

      it("should accept sources at max length", () => {
        const maxSource = "./a".repeat(170); // 510 chars, under 512
        expect(() => validateSourceFormat(maxSource, "--source")).not.toThrow();
      });
    });

    describe("error message quality", () => {
      it("should include flag name in error messages", () => {
        expect(() => validateSourceFormat("github:", "--source")).toThrow(/--source/);
        expect(() => validateSourceFormat("github:", "--agent-source")).toThrow(/--agent-source/);
      });

      it("should include examples in error messages", () => {
        expect(() => validateSourceFormat("github:", "--source")).toThrow(/Examples/);
      });
    });
  });

  describe("formatOrigin", () => {
    it("should format source flag origin", () => {
      expect(formatOrigin("source", "flag")).toBe("--source flag");
    });

    it("should format source env origin", () => {
      expect(formatOrigin("source", "env")).toContain(SOURCE_ENV_VAR);
    });

    it("should format source project origin", () => {
      expect(formatOrigin("source", "project")).toContain("project config");
    });

    it("should format source default origin", () => {
      expect(formatOrigin("source", "default")).toBe("default");
    });

    it("should format agents flag origin", () => {
      expect(formatOrigin("agents", "flag")).toBe("--agent-source flag");
    });

    it("should format agents project origin", () => {
      expect(formatOrigin("agents", "project")).toContain("project config");
    });

    it("should format agents default origin", () => {
      expect(formatOrigin("agents", "default")).toBe("default (local CLI)");
    });

    it("should return same project label for both source and agents", () => {
      expect(formatOrigin("source", "project")).toBe(formatOrigin("agents", "project"));
    });
  });

  describe("loadProjectSourceConfig", () => {
    it("should return null if config file does not exist", async () => {
      const config = await loadProjectSourceConfig(tempDir);
      expect(config).toBeNull();
    });

    it("should load config from .claude-src/config.yaml", async () => {
      // Create config file in new location
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        "source: github:mycompany/skills\n",
      );

      const config = await loadProjectSourceConfig(tempDir);
      expect(config).toEqual({ source: "github:mycompany/skills" });
    });

    it("should fall back to .claude/config.yaml for legacy projects", async () => {
      // Create config file in legacy location
      const configDir = path.join(tempDir, CLAUDE_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        "source: github:legacy/skills\n",
      );

      const config = await loadProjectSourceConfig(tempDir);
      expect(config).toEqual({ source: "github:legacy/skills" });
    });

    it("when config.yaml contains malformed YAML syntax, should return null", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        "invalid: yaml: content: :",
      );

      const config = await loadProjectSourceConfig(tempDir);
      // Should return null or throw - implementation dependent
      // Current implementation catches errors and returns null
      expect(config).toBeNull();
    });

    it("should load marketplace from project config", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        "marketplace: https://custom-marketplace.io\n",
      );

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.marketplace).toBe("https://custom-marketplace.io");
    });
  });

  describe("saveProjectConfig", () => {
    it("should create config directory if it does not exist", async () => {
      await saveProjectConfig(tempDir, { source: "github:test/repo" });

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);
      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("source: github:test/repo");
    });

    it("should overwrite existing config", async () => {
      // Save initial config
      await saveProjectConfig(tempDir, { source: "github:first/repo" });

      // Save new config
      await saveProjectConfig(tempDir, { source: "github:second/repo" });

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);
      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("github:second/repo");
      expect(content).not.toContain("github:first/repo");
    });

    it("should save marketplace to project config", async () => {
      await saveProjectConfig(tempDir, {
        marketplace: "https://my-marketplace.com/plugins",
      });

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);
      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("marketplace: https://my-marketplace.com/plugins");
    });

    it("should save both source and marketplace", async () => {
      await saveProjectConfig(tempDir, {
        source: "github:myorg/skills",
        marketplace: "https://enterprise.example.com",
      });

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);
      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("source: github:myorg/skills");
      expect(content).toContain("marketplace: https://enterprise.example.com");
    });
  });

  describe("resolveSource", () => {
    it("should return flag value with highest priority", async () => {
      // Set environment variable
      process.env[SOURCE_ENV_VAR] = "github:env/repo";

      const result = await resolveSource("github:flag/repo", tempDir);

      expect(result.source).toBe("github:flag/repo");
      expect(result.sourceOrigin).toBe("flag");
    });

    it("should return env value when no flag is provided", async () => {
      process.env[SOURCE_ENV_VAR] = "github:env/repo";

      const result = await resolveSource(undefined, tempDir);

      expect(result.source).toBe("github:env/repo");
      expect(result.sourceOrigin).toBe("env");
    });

    it("should return project config when no flag or env", async () => {
      // Create project config
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        "source: github:project/repo\n",
      );

      const result = await resolveSource(undefined, tempDir);

      expect(result.source).toBe("github:project/repo");
      expect(result.sourceOrigin).toBe("project");
    });

    it("should return default when no config is set", async () => {
      const result = await resolveSource(undefined, tempDir);

      expect(result.sourceOrigin).toBe("default");
      expect(result.source).toBe(DEFAULT_SOURCE);
    });

    it("when projectDir is undefined and no flag provided, should fall back to default source", async () => {
      const result = await resolveSource(undefined, undefined);

      expect(result.sourceOrigin).toBe("default");
      expect(result.source).toBe(DEFAULT_SOURCE);
    });

    it("should prioritize flag over all other sources", async () => {
      // Set everything
      process.env[SOURCE_ENV_VAR] = "github:env/repo";
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        "source: github:project/repo\n",
      );

      const result = await resolveSource("github:flag/repo", tempDir);

      expect(result.source).toBe("github:flag/repo");
      expect(result.sourceOrigin).toBe("flag");
    });

    it("should prioritize env over project config", async () => {
      process.env[SOURCE_ENV_VAR] = "github:env/repo";
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        "source: github:project/repo\n",
      );

      const result = await resolveSource(undefined, tempDir);

      expect(result.source).toBe("github:env/repo");
      expect(result.sourceOrigin).toBe("env");
    });

    it("should throw error for empty source flag", async () => {
      await expect(resolveSource("", tempDir)).rejects.toThrow(/--source flag cannot be empty/);
    });

    it("should throw error for whitespace-only source flag", async () => {
      await expect(resolveSource("   ", tempDir)).rejects.toThrow(/--source flag cannot be empty/);
    });

    it("should throw error for incomplete github: URL in flag", async () => {
      await expect(resolveSource("github:", tempDir)).rejects.toThrow(/incomplete URL/);
    });

    it("should throw error for github: without owner/repo in flag", async () => {
      await expect(resolveSource("github:just-a-name", tempDir)).rejects.toThrow(
        /owner\/repo format/,
      );
    });

    it("should throw error for invalid https:// URL in flag", async () => {
      await expect(resolveSource("https://", tempDir)).rejects.toThrow(/incomplete URL/);
    });

    describe("env var validation", () => {
      it("should accept valid env var source", async () => {
        process.env[SOURCE_ENV_VAR] = "github:org/repo";

        const result = await resolveSource(undefined, tempDir);

        expect(result.source).toBe("github:org/repo");
        expect(result.sourceOrigin).toBe("env");
      });

      it("should warn and fall back to default for invalid env var (incomplete URL)", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        process.env[SOURCE_ENV_VAR] = "github:";

        const result = await resolveSource(undefined, tempDir);

        expect(result.sourceOrigin).toBe("default");
        expect(result.source).toBe(DEFAULT_SOURCE);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("invalid value"));
        warnSpy.mockRestore();
      });

      it("should warn and fall back to project config for invalid env var", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        process.env[SOURCE_ENV_VAR] = "github:just-a-name";

        const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
        await mkdir(configDir, { recursive: true });
        await writeFile(
          path.join(configDir, STANDARD_FILES.CONFIG_YAML),
          "source: github:project/repo\n",
        );

        const result = await resolveSource(undefined, tempDir);

        expect(result.sourceOrigin).toBe("project");
        expect(result.source).toBe("github:project/repo");
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("invalid value"));
        warnSpy.mockRestore();
      });

      it("should warn and fall back for whitespace-only env var", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        process.env[SOURCE_ENV_VAR] = "   ";

        const result = await resolveSource(undefined, tempDir);

        expect(result.sourceOrigin).toBe("default");
        expect(result.source).toBe(DEFAULT_SOURCE);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("empty"));
        warnSpy.mockRestore();
      });

      it("should warn and fall back for malformed URL in env var", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        process.env[SOURCE_ENV_VAR] = "https://";

        const result = await resolveSource(undefined, tempDir);

        expect(result.sourceOrigin).toBe("default");
        expect(result.source).toBe(DEFAULT_SOURCE);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("invalid value"));
        warnSpy.mockRestore();
      });

      it("should warn and fall back for UNC path in env var", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        process.env[SOURCE_ENV_VAR] = "//attacker.com/payload";

        const result = await resolveSource(undefined, tempDir);

        expect(result.sourceOrigin).toBe("default");
        expect(result.source).toBe(DEFAULT_SOURCE);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("invalid value"));
        warnSpy.mockRestore();
      });

      it("should trim valid env var values", async () => {
        process.env[SOURCE_ENV_VAR] = "  github:org/repo  ";

        const result = await resolveSource(undefined, tempDir);

        expect(result.source).toBe("github:org/repo");
        expect(result.sourceOrigin).toBe("env");
      });
    });

    describe("marketplace resolution", () => {
      it("should return marketplace from project config", async () => {
        const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
        await mkdir(configDir, { recursive: true });
        await writeFile(
          path.join(configDir, STANDARD_FILES.CONFIG_YAML),
          "marketplace: https://my-company.com/plugins\n",
        );

        const result = await resolveSource(undefined, tempDir);

        expect(result.marketplace).toBe("https://my-company.com/plugins");
      });

      it("should return marketplace alongside source from project config", async () => {
        const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
        await mkdir(configDir, { recursive: true });
        await writeFile(
          path.join(configDir, STANDARD_FILES.CONFIG_YAML),
          "source: github:mycompany/skills\nmarketplace: https://enterprise.example.com/plugins\n",
        );

        const result = await resolveSource(undefined, tempDir);

        expect(result.source).toBe("github:mycompany/skills");
        expect(result.sourceOrigin).toBe("project");
        expect(result.marketplace).toBe("https://enterprise.example.com/plugins");
      });

      it("should return undefined marketplace when not configured", async () => {
        const result = await resolveSource(undefined, tempDir);

        expect(result.marketplace).toBeUndefined();
      });
    });
  });

  describe("resolveAgentsSource", () => {
    it("should return flag value with highest priority", async () => {
      // Create project config with agents_source
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        "agents_source: https://project.example.com/agents\n",
      );

      const result = await resolveAgentsSource("https://flag.example.com/agents", tempDir);

      expect(result.agentsSource).toBe("https://flag.example.com/agents");
      expect(result.agentsSourceOrigin).toBe("flag");
    });

    it("should return project config when no flag is provided", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        "agents_source: https://project.example.com/agents\n",
      );

      const result = await resolveAgentsSource(undefined, tempDir);

      expect(result.agentsSource).toBe("https://project.example.com/agents");
      expect(result.agentsSourceOrigin).toBe("project");
    });

    it("should return default when no config is set", async () => {
      const result = await resolveAgentsSource(undefined, tempDir);

      expect(result.agentsSourceOrigin).toBe("default");
      expect(result.agentsSource).toBeUndefined();
    });

    it("should handle undefined projectDir", async () => {
      const result = await resolveAgentsSource(undefined, undefined);

      expect(result.agentsSourceOrigin).toBe("default");
      expect(result.agentsSource).toBeUndefined();
    });

    it("should throw error for empty agent-source flag", async () => {
      await expect(resolveAgentsSource("", tempDir)).rejects.toThrow(
        /--agent-source flag cannot be empty/,
      );
    });

    it("should throw error for whitespace-only agent-source flag", async () => {
      await expect(resolveAgentsSource("   ", tempDir)).rejects.toThrow(
        /--agent-source flag cannot be empty/,
      );
    });

    it("should throw error for incomplete github: URL in agent-source flag", async () => {
      await expect(resolveAgentsSource("github:", tempDir)).rejects.toThrow(/incomplete URL/);
    });

    it("should throw error for github: without owner/repo in agent-source flag", async () => {
      await expect(resolveAgentsSource("github:just-a-name", tempDir)).rejects.toThrow(
        /owner\/repo format/,
      );
    });

    it("should throw error for incomplete https:// URL in agent-source flag", async () => {
      await expect(resolveAgentsSource("https://x", tempDir)).rejects.toThrow(/incomplete URL/);
    });

    it("should throw error for https:// URL without valid hostname in agent-source flag", async () => {
      await expect(resolveAgentsSource("https://not-a-host/repo", tempDir)).rejects.toThrow(
        /invalid URL/,
      );
    });
  });

  describe("loadProjectSourceConfig with path overrides", () => {
    it("should load skills_dir from project config", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_YAML), "skills_dir: lib/skills\n");

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.skills_dir).toBe("lib/skills");
    });

    it("should load agents_dir from project config", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_YAML), "agents_dir: lib/agents\n");

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.agents_dir).toBe("lib/agents");
    });

    it("should load stacks_file from project config", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        "stacks_file: data/stacks.yaml\n",
      );

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.stacks_file).toBe("data/stacks.yaml");
    });

    it("should load matrix_file from project config", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        "matrix_file: data/matrix.yaml\n",
      );

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.matrix_file).toBe("data/matrix.yaml");
    });

    it("should return undefined for missing path fields (defaults applied by consumer)", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        "source: github:myorg/skills\n",
      );

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.skills_dir).toBeUndefined();
      expect(config?.agents_dir).toBeUndefined();
      expect(config?.stacks_file).toBeUndefined();
      expect(config?.matrix_file).toBeUndefined();
    });

    it("should load all path fields together", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        [
          "source: github:myorg/skills",
          "skills_dir: lib/skills",
          "agents_dir: lib/agents",
          "stacks_file: data/stacks.yaml",
          "matrix_file: data/matrix.yaml",
        ].join("\n") + "\n",
      );

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.source).toBe("github:myorg/skills");
      expect(config?.skills_dir).toBe("lib/skills");
      expect(config?.agents_dir).toBe("lib/agents");
      expect(config?.stacks_file).toBe("data/stacks.yaml");
      expect(config?.matrix_file).toBe("data/matrix.yaml");
    });
  });

  describe("loadProjectSourceConfig with agents_source", () => {
    it("should load agents_source from project config", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        "agents_source: https://my-company.com/agents\n",
      );

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.agents_source).toBe("https://my-company.com/agents");
    });

    it("should load all config fields together", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        "source: github:myorg/skills\nmarketplace: https://market.example.com\nagents_source: https://agents.example.com\n",
      );

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.source).toBe("github:myorg/skills");
      expect(config?.marketplace).toBe("https://market.example.com");
      expect(config?.agents_source).toBe("https://agents.example.com");
    });
  });

  describe("saveProjectConfig with agents_source", () => {
    it("should save agents_source to project config", async () => {
      await saveProjectConfig(tempDir, {
        agents_source: "https://my-agents.example.com",
      });

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);
      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("agents_source: https://my-agents.example.com");
    });

    it("should save all config fields together", async () => {
      await saveProjectConfig(tempDir, {
        source: "github:myorg/skills",
        marketplace: "https://enterprise.example.com",
        agents_source: "https://agents.enterprise.example.com",
      });

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);
      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("source: github:myorg/skills");
      expect(content).toContain("marketplace: https://enterprise.example.com");
      expect(content).toContain("agents_source: https://agents.enterprise.example.com");
    });
  });
});
