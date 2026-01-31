import { Command } from "commander";
import pc from "picocolors";
import { compileCommand } from "./commands/compile";
import { compilePluginsCommand } from "./commands/compile-plugins";
import { compileStackCommand } from "./commands/compile-stack";
import { generateMarketplaceCommand } from "./commands/generate-marketplace";
import { initCommand } from "./commands/init";
import { editCommand } from "./commands/edit";
import { validateCommand } from "./commands/validate";
import { listCommand } from "./commands/list";
import { configCommand } from "./commands/config";
import { ejectCommand } from "./commands/eject";
import { uninstallCommand } from "./commands/uninstall";
import { versionCommand } from "./commands/version";
import { newCommand } from "./commands/new-agent";
import { searchCommand } from "./commands/search";
import { infoCommand } from "./commands/info";
import { outdatedCommand } from "./commands/outdated";
import { updateCommand } from "./commands/update";
import { diffCommand } from "./commands/diff";
import { doctorCommand } from "./commands/doctor";
import { EXIT_CODES } from "./lib/exit-codes";

process.on("SIGINT", () => {
  console.log(pc.yellow("\nCancelled"));
  process.exit(EXIT_CODES.CANCELLED);
});

async function main() {
  const program = new Command();

  program
    .name("cc")
    .description("Claude Collective CLI - Manage skills, plugins, and agents")
    .version("0.1.0")
    .option("--dry-run", "Preview operations without executing")
    .configureOutput({
      writeErr: (str) => console.error(pc.red(str)),
    })
    .showHelpAfterError(true);

  program.addCommand(initCommand);
  program.addCommand(editCommand);
  program.addCommand(compileCommand);
  program.addCommand(compilePluginsCommand);
  program.addCommand(compileStackCommand);
  program.addCommand(generateMarketplaceCommand);
  program.addCommand(validateCommand);
  program.addCommand(listCommand);
  program.addCommand(configCommand);
  program.addCommand(ejectCommand);
  program.addCommand(uninstallCommand);
  program.addCommand(versionCommand);
  program.addCommand(newCommand);
  program.addCommand(searchCommand);
  program.addCommand(infoCommand);
  program.addCommand(outdatedCommand);
  program.addCommand(updateCommand);
  program.addCommand(diffCommand);
  program.addCommand(doctorCommand);

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(pc.red("Error:"), err.message);
  process.exit(EXIT_CODES.ERROR);
});
