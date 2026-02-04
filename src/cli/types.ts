export * from "../types";

import type { CompileMode } from "./lib/loader";

/** Compilation context passed through the compile pipeline */
export interface CompileContext {
  stackId: string;
  verbose: boolean;
  projectRoot: string;
  outputDir: string;
  mode: CompileMode;
}
