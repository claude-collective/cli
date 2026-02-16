// Keyboard escape sequences
export const ARROW_UP = "\x1B[A";
export const ARROW_DOWN = "\x1B[B";
export const ARROW_LEFT = "\x1B[D";
export const ARROW_RIGHT = "\x1B[C";
export const ENTER = "\r";
export const ESCAPE = "\x1B";
export const CTRL_C = "\x03";
export const TAB = "\t";
export const SPACE = " ";
export const BACKSPACE = "\x7F";
export const KEY_Y = "y";
export const KEY_N = "n";

// Timing constants (ms)
export const INPUT_DELAY_MS = 50;
export const RENDER_DELAY_MS = 100;
export const SELECT_NAV_DELAY_MS = 100;
export const CONFIRM_INPUT_DELAY_MS = 100;
export const OPERATION_DELAY_MS = 150;
export const STEP_TRANSITION_DELAY_MS = 150;

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Realistic pool of available skills across domains for agent-skill mapping tests
export const TEST_AVAILABLE_SKILLS = [
  "web-framework-react",
  "web-framework-vue",
  "web-styling-scss-modules",
  "web-state-zustand",
  "web-testing-vitest",
  "web-mocks-msw",
  "api-framework-hono",
  "api-database-drizzle",
  "api-auth-better-auth",
  "api-testing-api-testing",
  "cli-framework-cli-commander",
  "cli-framework-oclif",
  "mobile-framework-react-native",
  "mobile-framework-expo",
  "infra-monorepo-turborepo",
  "infra-env-setup",
  "security-web-security",
  "meta-methodology-investigation-requirements",
  "meta-methodology-anti-over-engineering",
  "meta-reviewing-reviewing",
  "meta-research-research-methodology",
] as const;
