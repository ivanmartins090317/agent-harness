import { pathExists, readUtf8 } from "../utils/fs.js";
import { tddFile } from "./paths.js";

export class TddNotFoundError extends Error {
  constructor(path: string) {
    super(`Tech Design Doc não encontrado em: ${path}`);
    this.name = "TddNotFoundError";
  }
}

export async function loadTdd(projectPath: string, taskId: string): Promise<string> {
  const file = tddFile(projectPath, taskId);
  if (!(await pathExists(file))) {
    throw new TddNotFoundError(file);
  }
  const content = await readUtf8(file);
  if (!content.trim()) {
    throw new Error(`Tech Design Doc está vazio: ${file}`);
  }
  return content;
}
