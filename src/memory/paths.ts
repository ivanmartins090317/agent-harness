import { join } from "node:path";

export interface AiPaths {
  root: string;
  tddDir: string;
  stateDir: string;
  implementationDir: string;
  resultsDir: string;
  resultsSuccessDir: string;
  resultsErrorDir: string;
}

export function aiPaths(projectPath: string): AiPaths {
  const root = join(projectPath, "ai");
  const resultsDir = join(root, "results");
  return {
    root,
    tddDir: join(root, "tdd"),
    stateDir: join(root, "state"),
    implementationDir: join(root, "implementation"),
    resultsDir,
    resultsSuccessDir: join(resultsDir, "success"),
    resultsErrorDir: join(resultsDir, "error"),
  };
}

export function tddFile(projectPath: string, taskId: string): string {
  return join(aiPaths(projectPath).tddDir, `${taskId}.md`);
}

export function stateFile(projectPath: string, taskId: string): string {
  return join(aiPaths(projectPath).stateDir, `${taskId}.json`);
}

export function eventsFile(projectPath: string, taskId: string): string {
  return join(aiPaths(projectPath).stateDir, `${taskId}.jsonl`);
}

export function implementationDir(projectPath: string, taskId: string): string {
  return join(aiPaths(projectPath).implementationDir, taskId);
}

export function implementationNotesFile(projectPath: string, taskId: string): string {
  return join(implementationDir(projectPath, taskId), "notes.md");
}
