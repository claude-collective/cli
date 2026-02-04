import { BaseCommand } from "../base-command.js";

// Test imports from the existing lib
import { loadGlobalConfig, resolveSource } from "../lib/config.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { getPluginInfo } from "../lib/plugin-info.js";
import { loadSkillsMatrixFromSource } from "../lib/source-loader.js";
import { validatePluginManifest } from "../lib/plugin-validator.js";
import { compileAllAgents } from "../lib/compiler.js";
import { resolveSkillReference } from "../lib/resolver.js";
import { fileExists, readFile } from "../utils/fs.js";
import { verbose } from "../utils/logger.js";

export default class TestImports extends BaseCommand {
  static summary = "Test that lib imports work (temporary command)";
  static hidden = true; // Hide from help

  async run(): Promise<void> {
    this.log("Testing imports from cli/lib/...");

    // Test config loading from init hook
    this.log("\nConfig from init hook:");
    if (this.sourceConfig) {
      this.log(`  ✓ Config loaded successfully`);
      this.log(`  Source: ${this.sourceConfig.source}`);
      this.log(`  Origin: ${this.sourceConfig.sourceOrigin}`);
      if (this.sourceConfig.marketplace) {
        this.log(`  Marketplace: ${this.sourceConfig.marketplace}`);
      }
    } else {
      this.warn("  Config not loaded - init hook may have failed");
    }

    // Test lib/ utilities
    this.log("\nLib utilities:");
    this.log(`  EXIT_CODES.SUCCESS = ${EXIT_CODES.SUCCESS}`);
    this.log(
      `  loadGlobalConfig is a function: ${typeof loadGlobalConfig === "function"}`,
    );
    this.log(
      `  resolveSource is a function: ${typeof resolveSource === "function"}`,
    );
    this.log(
      `  getPluginInfo is a function: ${typeof getPluginInfo === "function"}`,
    );
    this.log(
      `  loadSkillsMatrixFromSource is a function: ${typeof loadSkillsMatrixFromSource === "function"}`,
    );
    this.log(
      `  validatePluginManifest is a function: ${typeof validatePluginManifest === "function"}`,
    );
    this.log(
      `  compileAllAgents is a function: ${typeof compileAllAgents === "function"}`,
    );
    this.log(
      `  resolveSkillReference is a function: ${typeof resolveSkillReference === "function"}`,
    );

    // Test utils/ utilities
    this.log("\nUtils utilities:");
    this.log(`  fileExists is a function: ${typeof fileExists === "function"}`);
    this.log(`  readFile is a function: ${typeof readFile === "function"}`);
    this.log(`  verbose is a function: ${typeof verbose === "function"}`);

    this.log("\n✓ All imports successful!");
  }
}
