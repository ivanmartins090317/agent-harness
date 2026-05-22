import { join } from "node:path";
import type { RunResult } from "../engine/types.js";
import { writeJson } from "../utils/fs.js";
import { aiPaths } from "./paths.js";

export async function saveResult(
  projectPath: string,
  result: RunResult,
): Promise<string> {
  const paths = aiPaths(projectPath);
  const dir = result.status === "completed" ? paths.resultsSuccessDir : paths.resultsErrorDir;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(dir, `${result.taskId}-${stamp}.json`);
  await writeJson(file, result);
  return file;
}
