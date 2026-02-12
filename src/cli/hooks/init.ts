import { Hook } from "@oclif/core";
import { resolveSource } from "../lib/configuration/index.js";

const hook: Hook<"init"> = async function (options) {
  const projectDir = process.cwd();

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
    // Available to commands via this.sourceConfig getter in BaseCommand
    (options.config as any).sourceConfig = resolvedConfig;
  } catch (error) {
    // Let the command handle config failures - commands can check if sourceConfig is undefined
  }
};

export default hook;
