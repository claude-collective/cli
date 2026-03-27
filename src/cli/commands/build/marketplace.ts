import { Flags } from "@oclif/core";
import path from "path";
import { sortBy } from "remeda";

import { BaseCommand } from "../../base-command";
import { setVerbose } from "../../utils/logger";
import {
  generateMarketplace,
  writeMarketplace,
  getMarketplaceStats,
} from "../../lib/marketplace-generator";
import {
  DEFAULT_BRANDING,
  DEFAULT_PLUGIN_NAME,
  DEFAULT_VERSION,
  PLUGIN_MANIFEST_DIR,
} from "../../consts";
import type { Marketplace } from "../../types/plugins";

const DEFAULT_PLUGINS_DIR = "dist/plugins";
const DEFAULT_OUTPUT_FILE = `${PLUGIN_MANIFEST_DIR}/marketplace.json`;
const DEFAULT_DESCRIPTION = "Community skills and stacks for Claude Code";
const DEFAULT_OWNER_NAME = DEFAULT_BRANDING.NAME;
const DEFAULT_OWNER_EMAIL = `hello@${DEFAULT_PLUGIN_NAME}.com`;

export default class BuildMarketplace extends BaseCommand {
  static summary = "Generate marketplace.json from built plugins (requires skills repo)";

  static description =
    "Generate marketplace.json from built plugins. This command scans the plugins directory and generates a marketplace manifest file.";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --plugins-dir dist/stacks",
    "<%= config.bin %> <%= command.id %> --output .claude-plugin/market.json",
    "<%= config.bin %> <%= command.id %> --name my-marketplace --version 2.0.0",
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    "plugins-dir": Flags.string({
      char: "p",
      description: "Plugins directory",
      default: DEFAULT_PLUGINS_DIR,
    }),
    output: Flags.string({
      char: "o",
      description: "Output file",
      default: DEFAULT_OUTPUT_FILE,
    }),
    name: Flags.string({
      description: "Marketplace name",
      default: DEFAULT_PLUGIN_NAME,
    }),
    version: Flags.string({
      description: "Marketplace version",
      default: DEFAULT_VERSION,
    }),
    description: Flags.string({
      description: "Marketplace description",
      default: DEFAULT_DESCRIPTION,
    }),
    "owner-name": Flags.string({
      description: "Owner name",
      default: DEFAULT_OWNER_NAME,
    }),
    "owner-email": Flags.string({
      description: "Owner email",
      default: DEFAULT_OWNER_EMAIL,
    }),
    verbose: Flags.boolean({
      char: "v",
      description: "Enable verbose logging",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(BuildMarketplace);
    setVerbose(flags.verbose);

    const projectRoot = process.cwd();
    const pluginsDir = path.resolve(projectRoot, flags["plugins-dir"]);
    const outputPath = path.resolve(projectRoot, flags.output);

    this.printHeader(pluginsDir, outputPath);

    try {
      const marketplace = await this.generateAndWrite(pluginsDir, outputPath, flags);
      this.printStats(marketplace);
      this.printSample(marketplace);

      this.log("");
      this.logSuccess(
        `Marketplace generated with ${getMarketplaceStats(marketplace).total} plugins!`,
      );
      this.log("");
    } catch (error) {
      this.log("Generation failed");
      this.handleError(error);
    }
  }

  private printHeader(pluginsDir: string, outputPath: string): void {
    this.log("");
    this.log("Generating marketplace.json");
    this.log(`  Plugins directory: ${pluginsDir}`);
    this.log(`  Output file: ${outputPath}`);
    this.log("");
  }

  private async generateAndWrite(
    pluginsDir: string,
    outputPath: string,
    flags: {
      name: string;
      version: string;
      description: string;
      "owner-name": string;
      "owner-email": string;
      "plugins-dir": string;
    },
  ): Promise<Marketplace> {
    this.log("Scanning plugins...");

    const marketplace = await generateMarketplace(pluginsDir, {
      name: flags.name,
      version: flags.version,
      description: flags.description,
      ownerName: flags["owner-name"],
      ownerEmail: flags["owner-email"],
      pluginRoot: `./${flags["plugins-dir"]}`,
    });

    const stats = getMarketplaceStats(marketplace);
    this.log(`Found ${stats.total} plugins`);

    this.log("Writing marketplace.json...");
    await writeMarketplace(outputPath, marketplace);
    this.log(`Wrote ${outputPath}`);

    return marketplace;
  }

  private printStats(marketplace: Marketplace): void {
    this.log("");
    this.log("Category breakdown:");
    const sortedCategories = sortBy(
      Object.entries(getMarketplaceStats(marketplace).byCategory),
      ([, count]) => -count,
    );
    for (const [category, count] of sortedCategories) {
      this.log(`  ${category}: ${count}`);
    }
  }

  private printSample(marketplace: Marketplace): void {
    this.log("");
    this.log("Sample plugins:");
    const sampleSize = 5;
    for (const plugin of marketplace.plugins.slice(0, sampleSize)) {
      const version = plugin.version ? `v${plugin.version}` : "";
      const category = plugin.category ? `[${plugin.category}]` : "";
      this.log(`  ${plugin.name} ${version} ${category}`);
      if (plugin.description) {
        this.log(`    ${plugin.description}`);
      }
    }
    if (marketplace.plugins.length > sampleSize) {
      this.log(`  ... and ${marketplace.plugins.length - sampleSize} more`);
    }
  }
}
