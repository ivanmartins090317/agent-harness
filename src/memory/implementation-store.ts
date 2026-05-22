import { promises as fs } from "node:fs";
import { ensureDir, pathExists, writeFileEnsured } from "../utils/fs.js";
import { implementationNotesFile, implementationDir } from "./paths.js";

const HEADER = "# Notas de implementação\n\n";

export async function appendNote(
  projectPath: string,
  taskId: string,
  note: string,
): Promise<void> {
  await ensureDir(implementationDir(projectPath, taskId));
  const file = implementationNotesFile(projectPath, taskId);
  const stamp = new Date().toISOString();
  const entry = `## ${stamp}\n\n${note.trim()}\n\n`;
  if (await pathExists(file)) {
    await fs.appendFile(file, entry, "utf8");
    return;
  }
  await writeFileEnsured(file, `${HEADER}${entry}`);
}

export async function readNotes(
  projectPath: string,
  taskId: string,
): Promise<string> {
  const file = implementationNotesFile(projectPath, taskId);
  if (!(await pathExists(file))) return "";
  return fs.readFile(file, "utf8");
}
