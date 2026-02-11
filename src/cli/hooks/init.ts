// Init hook - runs before each command
import { Hook } from "@oclif/core";
import { resolveSource } from "../lib/configuration/index.js";

const hook: Hook<"init"> = async function (options) {
  // Detect project directory (current working directory)
  const projectDir = process.cwd();

  // Get the --source flag value if provided
  // The flag value will be available in the command's flags after parse()
  // but during init hook we need to check argv manually
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

  // Resolve configuration
  try {
    const resolvedConfig = await resolveSource(sourceFlag, projectDir);

    // Store resolved config in the oclif Config object
    // This will be available to commands via this.sourceConfig getter in BaseCommand
    (options.config as any).sourceConfig = resolvedConfig;
  } catch (error) {
    // If config loading fails, we let the command handle it
    // This ensures commands can still run even if config is invalid
    // The command can check if config.sourceConfig is undefined and handle accordingly
  }
};

export default hook;
