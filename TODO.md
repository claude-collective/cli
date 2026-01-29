# TODO

## Task Overview

| #   | Task                                              | Priority | Status  |
| --- | ------------------------------------------------- | -------- | ------- |
| 1   | Invert source logic (agents local, skills remote) | High     | Pending |
| 2   | Add remote skill fetching from marketplace        | High     | Pending |
| 3   | Plugin mode: install agents as plugins            | Medium   | Pending |
| 4   | Plugin mode: support custom marketplace URL       | Medium   | Pending |
| 5   | Add custom URL support for agent definitions      | Low      | Pending |
| 6   | Implement plugin-to-local mode                    | Low      | Pending |

---

## Detailed Descriptions

### 1. Invert source logic (agents local, skills remote)

Current implementation has it backwards:

- **Current**: Skills discovered locally, agent definitions fetched from remote
- **Intended**: Agent definitions bundled with CLI (local `src/agents/`), skills fetched from remote marketplace

The compile command should use bundled agent partials from this repo and fetch skills from `github:claude-collective/skills`.

### 2. Add remote skill fetching from marketplace

Skills should be fetched from the remote skills repository (`github:claude-collective/skills`) instead of being discovered locally. Local `.claude/skills/` should serve as an override layer where user-defined skills take precedence over remote ones.

### 3. Plugin mode: install agents as plugins

In plugin mode, agents should be installed as native Claude plugins (not just compiled to `.claude/agents/`). This requires:

- Packaging agents in plugin format
- Using `claude plugin install` or equivalent mechanism

### 4. Plugin mode: support custom marketplace URL

Allow users to specify a custom marketplace URL for installing plugins. This enables private/enterprise marketplaces separate from the default `claude-collective` marketplace.

### 5. Add custom URL support for agent definitions

While agent definitions should default to local (bundled with CLI), support fetching from a custom URL for advanced use cases. This allows organizations to maintain their own agent definitions repository.

### 6. Implement plugin-to-local mode

Add a mode that takes installed plugins (both agents and skills) and copies them into the `.claude/` directory of the calling repository. This should be the default behavior for users who prefer local files over plugins.
