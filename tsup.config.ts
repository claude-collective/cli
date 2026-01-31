import { defineConfig } from "tsup";
import fs from "fs-extra";
import path from "path";

export default defineConfig({
  entry: [
    "src/cli-v2/index.ts", // oclif entry point
    "src/cli-v2/commands/**/*.{ts,tsx}", // oclif commands (some use JSX)
    "src/cli-v2/hooks/**/*.ts", // oclif hooks
    "src/cli-v2/components/**/*.tsx", // Ink components
    "src/cli-v2/stores/**/*.ts", // Zustand stores
  ],
  format: ["esm"],
  platform: "node",
  target: "node18",
  clean: true,
  sourcemap: true,
  shims: true,
  dts: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
  // Note: We need to handle multiple entry points - outDir will create structure
  outDir: "dist",
  onSuccess: async () => {
    // Copy static assets (YAML defaults) to dist
    const srcDefaults = path.join("src", "cli-v2", "defaults");
    const destDefaults = path.join("dist", "cli-v2", "defaults");

    if (await fs.pathExists(srcDefaults)) {
      await fs.copy(srcDefaults, destDefaults);
      console.log("Copied defaults/ to dist/cli-v2/defaults/");
    }
  },
});
