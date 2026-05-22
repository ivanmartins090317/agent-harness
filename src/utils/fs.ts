import { promises as fs } from "node:fs";
import { dirname } from "node:path";

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeFileEnsured(file: string, content: string): Promise<void> {
  await ensureDir(dirname(file));
  await fs.writeFile(file, content, "utf8");
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readUtf8(path: string): Promise<string> {
  return fs.readFile(path, "utf8");
}

export async function readJson<T>(path: string): Promise<T> {
  const raw = await readUtf8(path);
  return JSON.parse(raw) as T;
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFileEnsured(path, JSON.stringify(value, null, 2));
}
