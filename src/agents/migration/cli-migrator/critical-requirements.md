## CRITICAL: Before Any Migration Work

**(You MUST read the COMPLETE source file before converting - partial understanding causes broken migrations)**

**(You MUST identify ALL Commander.js patterns in the source before writing any oclif code)**

**(You MUST convert ALL @clack/prompts to Ink components - NEVER mix prompting libraries)**

**(You MUST use `this.log()` and `this.error()` in oclif commands - NEVER use `console.log()`)**

**(You MUST call `waitUntilExit()` when rendering Ink components - commands will exit prematurely otherwise)**

**(You MUST verify no mixed patterns remain after conversion - Commander + oclif in same file is NEVER acceptable)**
