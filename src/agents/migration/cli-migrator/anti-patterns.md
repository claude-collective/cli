## Anti-Patterns to Avoid

<anti_patterns>

### NEVER Mix Frameworks

```typescript
// BAD: Mixing Commander and oclif
import { Command as OclifCommand } from "@oclif/core";
import { Command as CommanderCommand } from "commander";  // NEVER

export class Init extends OclifCommand {
  async run() {
    const program = new CommanderCommand();  // NEVER DO THIS
  }
}

// BAD: Mixing @clack/prompts with Ink
import * as p from "@clack/prompts";  // NEVER in oclif commands
import { render } from "ink";

export class Init extends Command {
  async run() {
    p.intro("Hello");  // NEVER - use Ink components
    render(<MyComponent />);
  }
}
```

### NEVER Use console.log in oclif Commands

```typescript
// BAD
export class Init extends Command {
  async run() {
    console.log("Processing..."); // NEVER
  }
}

// GOOD
export class Init extends Command {
  async run() {
    this.log("Processing..."); // Correct
  }
}
```

### NEVER Use process.exit() Directly

```typescript
// BAD
export class Init extends Command {
  async run() {
    if (error) {
      process.exit(1); // NEVER
    }
  }
}

// GOOD
export class Init extends Command {
  async run() {
    if (error) {
      this.error("Something went wrong"); // Exits with code 1
      // OR
      this.exit(1); // Explicit exit
    }
  }
}
```

### NEVER Forget waitUntilExit()

```typescript
// BAD: Command exits before Ink component finishes
export class Init extends Command {
  async run() {
    render(<Wizard />);  // Command exits immediately!
  }
}

// GOOD
export class Init extends Command {
  async run() {
    const { waitUntilExit } = render(<Wizard />);
    await waitUntilExit();  // Wait for component to unmount
  }
}
```

### NEVER Put Raw Text Outside `<Text>`

```tsx
// BAD
const Component = () => (
  <Box>Hello World {/* Error: text outside Text component */}</Box>
);

// GOOD
const Component = () => (
  <Box>
    <Text>Hello World</Text>
  </Box>
);
```

### NEVER Nest `<Box>` Inside `<Text>`

```tsx
// BAD
const Component = () => (
  <Text>
    Hello <Box>World</Box> {/* Error: Box inside Text */}
  </Text>
);

// GOOD
const Component = () => (
  <Box>
    <Text>Hello </Text>
    <Text>World</Text>
  </Box>
);
```

</anti_patterns>

---

## Self-Correction Checkpoints

<self_correction_triggers>
**During Migration, If You Notice Yourself:**

- **Writing Commander.js patterns in oclif files**
  -> STOP. Use class-based commands with static properties.

- **Using @clack/prompts in oclif commands**
  -> STOP. Use Ink components from @inkjs/ui instead.

- **Using console.log instead of this.log**
  -> STOP. oclif commands have built-in logging methods.

- **Using process.exit instead of this.exit**
  -> STOP. Let oclif handle process termination.

- **Forgetting await waitUntilExit()**
  -> STOP. Ink components need this to prevent premature exit.

- **Mixing picocolors with Ink**
  -> STOP. Use `<Text>` props for styling in Ink components.

- **Not reading the source file completely**
  -> STOP. Understand all patterns before converting.

- **Converting and "improving" at the same time**
  -> STOP. Migration first, improvements in a separate task.

**These checkpoints prevent the most common migration failures.**
</self_correction_triggers>
