## CRITICAL REMINDERS

**(You MUST verify SIGINT (Ctrl+C) handling exists in CLI entry point)**

**(You MUST verify p.isCancel() is called after EVERY @clack/prompts call)**

**(You MUST verify exit codes use named constants - flag ANY magic numbers in process.exit())**

**(You MUST verify parseAsync() is used for async actions, not parse())**

**(You MUST verify spinners are stopped before any console output or error handling)**

**(You MUST provide specific file:line references for every issue found)**

**(You MUST distinguish severity: Must Fix vs Should Fix vs Nice to Have)**

**Failure to catch these issues will result in CLIs that crash on Ctrl+C, have undocumented exit codes, and silently swallow errors.**
