import { promises as fs } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendEvent, loadEvents } from "../../src/memory/event-store.js";
import { eventsFile } from "../../src/memory/paths.js";
import { makeTmpProject, type TmpProject } from "../helpers/tmp.js";

let proj: TmpProject;

beforeEach(() => {
  proj = makeTmpProject();
});

afterEach(async () => {
  await proj.dispose();
});

describe("event-store", () => {
  it("loadEvents retorna [] quando o arquivo não existe", async () => {
    const events = await loadEvents(proj.path, "t1");
    expect(events).toEqual([]);
  });

  it("appendEvent cria o arquivo e adiciona um evento com timestamp", async () => {
    const evt = await appendEvent(proj.path, "t1", {
      step: 1,
      type: "start",
      message: "go",
    });
    expect(evt.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const file = eventsFile(proj.path, "t1");
    const raw = await fs.readFile(file, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw.trim().split(/\r?\n/)).toHaveLength(1);
  });

  it("appendEvent respeita timestamp explícito quando fornecido", async () => {
    const ts = "2025-01-01T00:00:00.000Z";
    const evt = await appendEvent(proj.path, "t1", {
      step: 2,
      type: "model_call",
      timestamp: ts,
    });
    expect(evt.timestamp).toBe(ts);
  });

  it("loadEvents lê múltiplos eventos preservando ordem e campos", async () => {
    await appendEvent(proj.path, "t1", { step: 1, type: "start" });
    await appendEvent(proj.path, "t1", {
      step: 1,
      type: "tool_call",
      tool: "read_file",
      input: { path: "x.txt" },
    });
    await appendEvent(proj.path, "t1", {
      step: 1,
      type: "tool_result",
      tool: "read_file",
      output: { bytes: 10 },
    });

    const events = await loadEvents(proj.path, "t1");
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.type)).toEqual(["start", "tool_call", "tool_result"]);
    expect(events[1]?.input).toEqual({ path: "x.txt" });
    expect(events[2]?.output).toEqual({ bytes: 10 });
  });

  it("loadEvents ignora linhas vazias e inválidas", async () => {
    await appendEvent(proj.path, "t1", { step: 1, type: "start" });
    const file = eventsFile(proj.path, "t1");
    await fs.appendFile(file, "\n", "utf8");
    await fs.appendFile(file, "isto não é json\n", "utf8");
    await fs.appendFile(file, "   \n", "utf8");
    await appendEvent(proj.path, "t1", { step: 2, type: "finish" });

    const events = await loadEvents(proj.path, "t1");
    expect(events.map((e) => e.type)).toEqual(["start", "finish"]);
  });

  it("isola eventos por taskId", async () => {
    await appendEvent(proj.path, "a", { step: 1, type: "start" });
    await appendEvent(proj.path, "b", { step: 1, type: "start" });
    await appendEvent(proj.path, "b", { step: 2, type: "finish" });

    const a = await loadEvents(proj.path, "a");
    const b = await loadEvents(proj.path, "b");
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(2);
  });
});
