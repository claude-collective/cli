# TODO

## Task Overview

| #   | Task                                              | Priority | Status   |
| --- | ------------------------------------------------- | -------- | -------- |
| 1   | Invert source logic (agents local, skills remote) | High     | Pending  |
| 2   | Add remote skill fetching from marketplace        | High     | Pending  |
| 3   | Plugin mode: install stacks as plugins            | High     | Complete |
| 4   | Plugin mode: support custom marketplace URL       | Medium   | Pending  |
| 5   | Add custom URL support for agent definitions      | Low      | Pending  |
| 6   | Implement plugin-to-local mode                    | Low      | Pending  |
| 7   | Individual skill plugin installation              | Low      | Deferred |
| 8   | Remote stack installation from marketplace        | Low      | Deferred |

---

## Detailed Descriptions

### 1. Invert source logic (agents local, skills remote)

Current implementation has it backwards:

- **Current**: Skills discovered locally, agent definitions fetched from remote
- **Intended**: Agent definitions bundled with CLI (local `src/agents/`), skills fetched from remote marketplace

The compile command should use bundled agent partials from this repo and fetch skills from `github:claude-collective/skills`.

### 2. Add remote skill fetching from marketplace

Skills should be fetched from the remote skills repository (`github:claude-collective/skills`) instead of being discovered locally. Local `.claude/skills/` should serve as an override layer where user-defined skills take precedence over remote ones.

### 3. Plugin mode: install stacks as plugins (COMPLETE)

**Status**: Complete - stacks are now installed as ONE native plugin using `claude plugin install`.

Implementation:

- Added `stack-installer.ts` module for stack installation
- Added `exec.ts` utility for running native CLI commands
- Modified `init.ts` Plugin Mode to compile stack and install via `claude plugin install ./compiled-stack --scope project`
- Stacks include all agents and skills bundled together
- Individual skill installation deferred to task #7

### 4. Plugin mode: support custom marketplace URL

Allow users to specify a custom marketplace URL for installing plugins. This enables private/enterprise marketplaces separate from the default `claude-collective` marketplace.

### 5. Add custom URL support for agent definitions

While agent definitions should default to local (bundled with CLI), support fetching from a custom URL for advanced use cases. This allows organizations to maintain their own agent definitions repository.

### 6. Implement plugin-to-local mode

Add a mode that takes installed plugins (both agents and skills) and copies them into the `.claude/` directory of the calling repository. This should be the default behavior for users who prefer local files over plugins.

### 7. Individual skill plugin installation (DEFERRED)

**Status**: Deferred - currently, Plugin Mode only supports installing entire stacks as ONE plugin.

When user selects individual skills (not from a pre-built stack) in Plugin Mode, support installing each skill as its own plugin:

```bash
claude plugin install skill-react@claude-collective --scope project
claude plugin install skill-zustand@claude-collective --scope project
```

**Current behavior**: Falls back to Local Mode with a warning.

**Requirements for implementation**:

- Compile individual skills to plugin format (similar to `compile-plugins` command)
- Support remote marketplace when available
- Consider bundling related skills together (e.g., methodology skills)
- Handle agent compilation separately (agents reference skills)

### 8. Remote stack installation from marketplace (DEFERRED)

**Status**: Deferred - currently, stacks are compiled locally before installation.

Support installing pre-compiled stacks directly from a remote marketplace:

```bash
claude plugin install stack-modern-react@claude-collective --scope project
```

**Current behavior**: Compiles stack locally to temp directory, then installs.

**Requirements for implementation**:

- Publish compiled stacks to marketplace (GitHub releases or npm)
- Stack versioning and update mechanism
- Dependency resolution for skills bundled in stacks
