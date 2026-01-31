## Migration Workflow

<migration_workflow>

### Step 1: Analyze Source File

```markdown
**Before converting, answer these questions:**

1. What Commander.js patterns are used?
   - [ ] `new Command()` definitions
   - [ ] `.option()` declarations
   - [ ] `.argument()` declarations
   - [ ] `.action()` handlers
   - [ ] Subcommands via `.addCommand()`
   - [ ] Global options

2. What @clack/prompts are used?
   - [ ] `p.intro()` / `p.outro()`
   - [ ] `p.text()` - text input
   - [ ] `p.select()` - single select
   - [ ] `p.multiselect()` - multi select
   - [ ] `p.confirm()` - yes/no
   - [ ] `p.spinner()` - loading states
   - [ ] `p.log.*()` - logging
   - [ ] `p.isCancel()` - cancellation handling

3. What state management exists?
   - [ ] Wizard state machine
   - [ ] History for back navigation
   - [ ] Accumulated selections

4. What file system operations?
   - [ ] fs-extra usage
   - [ ] fast-glob patterns
   - [ ] Config file loading
```

### Step 2: Create oclif Command Class

Convert the command definition first:

```typescript
// BEFORE: Commander.js
import { Command } from "commander";

export const initCommand = new Command("init")
  .description("Initialize project")
  .option("-s, --source <url>", "Source URL")
  .option("--refresh", "Force refresh", false)
  .action(async (options) => {
    // implementation
  });

// AFTER: oclif
import { Command, Flags } from "@oclif/core";

export class Init extends Command {
  static summary = "Initialize project";

  static flags = {
    source: Flags.string({ char: "s", description: "Source URL" }),
    refresh: Flags.boolean({ description: "Force refresh", default: false }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    // implementation
  }
}
```

### Step 3: Convert Interactive Prompts to Ink Components

```tsx
// BEFORE: @clack/prompts
import * as p from "@clack/prompts";

async function runWizard() {
  p.intro("Setup Wizard");

  const name = await p.text({ message: "Project name:" });
  if (p.isCancel(name)) {
    p.cancel("Cancelled");
    process.exit(1);
  }

  const framework = await p.select({
    message: "Select framework:",
    options: [
      { value: "react", label: "React" },
      { value: "vue", label: "Vue" },
    ],
  });

  p.outro("Done!");
}

// AFTER: Ink + @inkjs/ui
import React, { useState } from "react";
import { render, Box, Text, useApp } from "ink";
import { TextInput, Select } from "@inkjs/ui";

interface WizardProps {
  onComplete: (result: { name: string; framework: string }) => void;
}

const Wizard: React.FC<WizardProps> = ({ onComplete }) => {
  const { exit } = useApp();
  const [step, setStep] = useState<"name" | "framework" | "done">("name");
  const [name, setName] = useState("");
  const [framework, setFramework] = useState("");

  if (step === "name") {
    return (
      <Box flexDirection="column">
        <Text bold>Setup Wizard</Text>
        <Text>Project name:</Text>
        <TextInput
          placeholder="my-project"
          onSubmit={(value) => {
            setName(value);
            setStep("framework");
          }}
        />
      </Box>
    );
  }

  if (step === "framework") {
    return (
      <Box flexDirection="column">
        <Text>Select framework:</Text>
        <Select
          options={[
            { value: "react", label: "React" },
            { value: "vue", label: "Vue" },
          ]}
          onChange={(value) => {
            setFramework(value);
            onComplete({ name, framework: value });
          }}
        />
      </Box>
    );
  }

  return <Text bold color="green">Done!</Text>;
};

// In oclif command:
async run(): Promise<void> {
  const { waitUntilExit } = render(
    <Wizard onComplete={(result) => {
      this.log(`Created ${result.name} with ${result.framework}`);
    }} />
  );
  await waitUntilExit();
}
```

### Step 4: Convert State Machines to Zustand

```typescript
// BEFORE: Manual state machine
interface WizardState {
  currentStep: "approach" | "selection" | "confirm";
  selectedItems: string[];
  history: WizardStep[];
}

// AFTER: Zustand store
import { create } from "zustand";

interface WizardState {
  step: "approach" | "selection" | "confirm";
  selectedItems: string[];
  history: string[];
  setStep: (step: WizardState["step"]) => void;
  toggleItem: (item: string) => void;
  goBack: () => void;
}

export const useWizardStore = create<WizardState>((set, get) => ({
  step: "approach",
  selectedItems: [],
  history: [],

  setStep: (step) =>
    set((state) => ({
      step,
      history: [...state.history, state.step],
    })),

  toggleItem: (item) =>
    set((state) => ({
      selectedItems: state.selectedItems.includes(item)
        ? state.selectedItems.filter((i) => i !== item)
        : [...state.selectedItems, item],
    })),

  goBack: () =>
    set((state) => {
      const history = [...state.history];
      const previousStep = history.pop();
      return {
        step: previousStep || "approach",
        history,
      };
    }),
}));
```

### Step 5: Verify Migration Completeness

```markdown
**Post-Migration Checklist:**

- [ ] No `import { Command } from "commander"` anywhere
- [ ] No `import * as p from "@clack/prompts"` anywhere
- [ ] No `import pc from "picocolors"` in Ink components
- [ ] No `process.exit()` - using `this.exit()` or `useApp().exit()`
- [ ] No `console.log()` - using `this.log()` or `<Text>`
- [ ] All Ink renders have `await waitUntilExit()`
- [ ] All text wrapped in `<Text>` components
- [ ] oclif package.json configuration added
- [ ] Command discovery configured in package.json
```

</migration_workflow>
