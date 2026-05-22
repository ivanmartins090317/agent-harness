import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TmpProject {
  path: string;
  dispose: () => Promise<void>;
}

export function makeTmpProject(prefix = "agent-harness-"): TmpProject {
  const path = mkdtempSync(join(tmpdir(), prefix));
  return {
    path,
    async dispose() {
      await rm(path, { recursive: true, force: true });
    },
  };
}

export function silentLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child() {
      return this;
    },
  };
}
