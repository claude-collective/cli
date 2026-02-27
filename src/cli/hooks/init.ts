import { Hook } from "@oclif/core";
import { resolveSource } from "../lib/configuration/index.js";
import { detectInstallation } from "../lib/installation/installation.js";
import { hasIndividualPlugins } from "../lib/plugins/index.js";
import { showDashboard } from "../commands/init.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import type { ConfigWithSource } from "../base-command.js";

const hook: Hook<"init"> = async function (options) {
  const projectDir = process.cwd();

  // When no command is given and project is already initialized, show dashboard
  if (options.id === undefined) {
    const [installation, individualPlugins] = await Promise.all([
      detectInstallation(projectDir),
      hasIndividualPlugins(projectDir),
    ]);

    if (installation || individualPlugins) {
      const selectedCommand = await showDashboard(projectDir);
      if (selectedCommand) {
        await options.config.runCommand(selectedCommand);
      }
      this.exit(EXIT_CODES.SUCCESS);
    }
  }

  // Extract --source flag from argv (not yet parsed by oclif at this point)
  let sourceFlag: string | undefined;
  const sourceArgIndex = options.argv.indexOf("--source");
  if (sourceArgIndex !== -1 && sourceArgIndex + 1 < options.argv.length) {
    sourceFlag = options.argv[sourceArgIndex + 1];
  } else {
    const sourceFlagWithEquals = options.argv.find((arg) => arg.startsWith("--source="));
    if (sourceFlagWithEquals) {
      sourceFlag = sourceFlagWithEquals.split("=")[1];
    }
  }

  // Short form -s
  const sArgIndex = options.argv.indexOf("-s");
  if (sArgIndex !== -1 && sArgIndex + 1 < options.argv.length) {
    sourceFlag = options.argv[sArgIndex + 1];
  }

  try {
    const resolvedConfig = await resolveSource(sourceFlag, projectDir);
    // Boundary cast: oclif Config doesn't declare sourceConfig; read in BaseCommand.sourceConfig
    (options.config as unknown as ConfigWithSource).sourceConfig = resolvedConfig;
  } catch (error) {
    // Let the command handle config failures - commands can check if sourceConfig is undefined
  }
};

export default hook;
