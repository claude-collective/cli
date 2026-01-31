## Conversion Reference Tables

<conversion_mappings>

### Commander.js -> oclif

| Commander.js Pattern                | oclif Equivalent                                                                      | Notes                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `new Command("name")`               | `class Name extends Command`                                                          | Class name is PascalCase                            |
| `.description("...")`               | `static summary = "..."`                                                              | Use `summary` for brief, `description` for detailed |
| `.option("-f, --foo <value>")`      | `static flags = { foo: Flags.string({ char: "f" }) }`                                 | Use `Flags.string()`, `Flags.boolean()`, etc.       |
| `.option("--bar", "desc", false)`   | `static flags = { bar: Flags.boolean({ default: false }) }`                           | Booleans default to false                           |
| `.argument("<file>")`               | `static args = { file: Args.string({ required: true }) }`                             | Use `Args.string()`, `Args.integer()`, etc.         |
| `.argument("[file]")`               | `static args = { file: Args.string({ required: false }) }`                            | Optional args have `required: false`                |
| `.action(async (args, opts) => {})` | `async run(): Promise<void> { const { args, flags } = await this.parse(ClassName); }` | Always await `this.parse()`                         |
| `program.parse(process.argv)`       | N/A - handled by oclif                                                                | Remove completely                                   |
| `program.parseAsync(process.argv)`  | N/A - handled by oclif                                                                | Remove completely                                   |
| `command.optsWithGlobals()`         | Access via `this.config` or pass flags                                                | Global config available via `this.config`           |

### @clack/prompts -> Ink + @inkjs/ui

| @clack/prompts                     | Ink Equivalent                                           | Notes                           |
| ---------------------------------- | -------------------------------------------------------- | ------------------------------- |
| `p.intro("text")`                  | `<Text bold>text</Text>`                                 | Or use `<Alert variant="info">` |
| `p.outro("text")`                  | `<Text bold color="green">text</Text>`                   | Render before exit              |
| `p.text({ message, placeholder })` | `<TextInput placeholder={placeholder} onSubmit={...} />` | From @inkjs/ui                  |
| `p.select({ options })`            | `<Select options={options} onChange={...} />`            | From @inkjs/ui                  |
| `p.multiselect({ options })`       | `<MultiSelect options={options} onChange={...} />`       | From @inkjs/ui                  |
| `p.confirm({ message })`           | `<ConfirmInput onSubmit={...} />`                        | From @inkjs/ui                  |
| `p.spinner()`                      | `<Spinner label="..." />`                                | From @inkjs/ui                  |
| `p.log.info(msg)`                  | `this.log(msg)`                                          | In command context              |
| `p.log.error(msg)`                 | `this.error(msg)`                                        | In command context, also exits  |
| `p.log.warn(msg)`                  | `this.warn(msg)`                                         | In command context              |
| `p.log.success(msg)`               | `this.log(chalk.green(msg))`                             | Or `<Text color="green">`       |
| `p.cancel("msg")`                  | `this.exit(1)` with message                              | Render message first            |
| `p.isCancel(value)`                | Check for undefined/null or use component state          | Handle in component logic       |

### picocolors -> Ink `<Text>` Props

| picocolors                          | Ink `<Text>` Props          | Example                              |
| ----------------------------------- | --------------------------- | ------------------------------------ |
| `pc.green(text)`                    | `<Text color="green">`      | `<Text color="green">{text}</Text>`  |
| `pc.red(text)`                      | `<Text color="red">`        | `<Text color="red">{text}</Text>`    |
| `pc.yellow(text)`                   | `<Text color="yellow">`     | `<Text color="yellow">{text}</Text>` |
| `pc.blue(text)`                     | `<Text color="blue">`       | `<Text color="blue">{text}</Text>`   |
| `pc.cyan(text)`                     | `<Text color="cyan">`       | `<Text color="cyan">{text}</Text>`   |
| `pc.bold(text)`                     | `<Text bold>`               | `<Text bold>{text}</Text>`           |
| `pc.dim(text)`                      | `<Text dimColor>`           | `<Text dimColor>{text}</Text>`       |
| `pc.italic(text)`                   | `<Text italic>`             | `<Text italic>{text}</Text>`         |
| `pc.underline(text)`                | `<Text underline>`          | `<Text underline>{text}</Text>`      |
| `pc.strikethrough(text)`            | `<Text strikethrough>`      | `<Text strikethrough>{text}</Text>`  |
| Combined: `pc.bold(pc.green(text))` | `<Text bold color="green">` | Combine props                        |

### Exit Codes

| Commander Pattern                    | oclif Equivalent                      | Notes                                            |
| ------------------------------------ | ------------------------------------- | ------------------------------------------------ |
| `process.exit(0)`                    | `this.exit(0)`                        | Or just return from `run()`                      |
| `process.exit(1)`                    | `this.exit(1)` or `this.error("msg")` | `this.error()` exits with code 1                 |
| `process.exit(EXIT_CODES.CANCELLED)` | `this.exit(1)`                        | oclif uses 1 for errors, 2 for command not found |
| Signal handlers                      | Use oclif hooks                       | `init` and `finally` hooks                       |

</conversion_mappings>
