import path from "path";
import { mkdir } from "fs/promises";
import { cleanupTempDir, createTempDir } from "../test-fs-utils";

export type IsolatedHome = {
  tempDir: string;
  projectDir: string;
  fakeHome: string;
  cleanup: () => Promise<void>;
};

/**
 * Creates a temp directory with an isolated `projectDir` and `fakeHome`,
 * chdirs into `projectDir`, and points `process.env.HOME` at `fakeHome`.
 *
 * The returned `cleanup` restores the original cwd and HOME (or unsets HOME
 * when it was originally undefined) and removes the temp directory.
 *
 * Call in `beforeEach` and invoke `cleanup` in `afterEach`. Required for any
 * command test that hits `os.homedir()` or `~/.claude*` paths — without it,
 * tests silently depend on the developer's real home.
 */
export async function setupIsolatedHome(prefix: string): Promise<IsolatedHome> {
  const tempDir = await createTempDir(prefix);
  const projectDir = path.join(tempDir, "project");
  const fakeHome = path.join(tempDir, "fakehome");
  await mkdir(projectDir, { recursive: true });
  await mkdir(fakeHome, { recursive: true });

  const originalHome = process.env.HOME;
  const originalCwd = process.cwd();
  process.chdir(projectDir);
  process.env.HOME = fakeHome;

  const cleanup = async () => {
    process.chdir(originalCwd);
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await cleanupTempDir(tempDir);
  };

  return { tempDir, projectDir, fakeHome, cleanup };
}
