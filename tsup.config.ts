import { defineConfig } from "tsup";
import fs from "fs-extra";
import path from "path";

export default defineConfig({
  entry: ["src/cli/index.ts"],
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
  outDir: "dist/cli",
  onSuccess: async () => {
    // Copy static assets (YAML defaults) to dist
    const srcDefaults = path.join("src", "cli", "defaults");
    const destDefaults = path.join("dist", "cli", "defaults");

    if (await fs.pathExists(srcDefaults)) {
      await fs.copy(srcDefaults, destDefaults);
      console.log("Copied defaults/ to dist/cli/defaults/");
    }
  },
});
