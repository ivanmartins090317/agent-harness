import { isAbsolute, relative, resolve } from "node:path";

export class PathOutsideProjectError extends Error {
  constructor(projectPath: string, requested: string) {
    super(
      `Caminho fora do project_path. project_path=${projectPath} requested=${requested}`,
    );
    this.name = "PathOutsideProjectError";
  }
}

export function resolveSafePath(projectPath: string, requested: string): string {
  const absProject = resolve(projectPath);
  const absRequested = isAbsolute(requested)
    ? resolve(requested)
    : resolve(absProject, requested);
  const rel = relative(absProject, absRequested);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new PathOutsideProjectError(absProject, requested);
  }
  return absRequested;
}
