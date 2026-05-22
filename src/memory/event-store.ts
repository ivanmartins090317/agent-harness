import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import type { StateEvent } from "../engine/types.js";
import { ensureDir, pathExists, readUtf8 } from "../utils/fs.js";
import { eventsFile } from "./paths.js";

/**
 * Stream append-only de eventos do loop em `ai/state/<taskId>.jsonl`.
 *
 * Cada linha é um {@link StateEvent} serializado em JSON. Funciona em conjunto
 * com `state-store.ts` (que mantém o estado agregado em `<taskId>.json`).
 */
export async function appendEvent(
  projectPath: string,
  taskId: string,
  event: Omit<StateEvent, "timestamp"> & { timestamp?: string },
): Promise<StateEvent> {
  const file = eventsFile(projectPath, taskId);
  const full: StateEvent = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
  await ensureDir(dirname(file));
  await fs.appendFile(file, `${JSON.stringify(full)}\n`, "utf8");
  return full;
}

export async function loadEvents(
  projectPath: string,
  taskId: string,
): Promise<StateEvent[]> {
  const file = eventsFile(projectPath, taskId);
  if (!(await pathExists(file))) return [];
  const raw = await readUtf8(file);
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseLine(line))
    .filter((evt): evt is StateEvent => evt !== null);
}

function parseLine(line: string): StateEvent | null {
  try {
    return JSON.parse(line) as StateEvent;
  } catch {
    return null;
  }
}
