export * from "../types";

/** Compilation context passed through the compile pipeline */
export type CompileContext = {
  stackId: string;
  verbose: boolean;
  projectRoot: string;
  outputDir: string;
};
