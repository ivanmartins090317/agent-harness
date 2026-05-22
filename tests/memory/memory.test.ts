import { promises as fs } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  implementationNotesFile,
  stateFile,
  tddFile,
} from "../../src/memory/paths.js";
import { appendNote, readNotes } from "../../src/memory/implementation-store.js";
import { saveResult } from "../../src/memory/results-store.js";
import { loadState, recordDecision, saveState } from "../../src/memory/state-store.js";
import { loadTdd, TddNotFoundError } from "../../src/memory/tdd-loader.js";
import { writeFileEnsured } from "../../src/utils/fs.js";
import { makeTmpProject, type TmpProject } from "../helpers/tmp.js";

let proj: TmpProject;

beforeEach(() => {
  proj = makeTmpProject();
});

afterEach(async () => {
  await proj.dispose();
});

describe("tdd-loader", () => {
  it("lê TDD existente", async () => {
    await writeFileEnsured(tddFile(proj.path, "t1"), "# titulo\n\nconteudo");
    const tdd = await loadTdd(proj.path, "t1");
    expect(tdd).toMatch(/conteudo/);
  });

  it("lança quando TDD não existe", async () => {
    await expect(loadTdd(proj.path, "nope")).rejects.toBeInstanceOf(TddNotFoundError);
  });
});

describe("state-store", () => {
  it("cria estado default quando inexistente", async () => {
    const s = await loadState(proj.path, "t1");
    expect(s.status).toBe("pending");
    expect(s.decisions).toEqual([]);
  });

  it("persiste decisões", async () => {
    await recordDecision(proj.path, "t1", 1, "decisão A");
    await recordDecision(proj.path, "t1", 2, "decisão B");
    const s = await loadState(proj.path, "t1");
    expect(s.decisions).toHaveLength(2);
    expect(s.lastStep).toBe(2);
  });

  it("saveState grava em disco", async () => {
    const s = await loadState(proj.path, "t1");
    s.status = "running";
    await saveState(proj.path, s);
    const raw = await fs.readFile(stateFile(proj.path, "t1"), "utf8");
    expect(raw).toMatch(/running/);
  });
});

describe("implementation-store", () => {
  it("appendNote cria e adiciona notas", async () => {
    await appendNote(proj.path, "t1", "primeira");
    await appendNote(proj.path, "t1", "segunda");
    const file = implementationNotesFile(proj.path, "t1");
    const content = await fs.readFile(file, "utf8");
    expect(content).toMatch(/primeira/);
    expect(content).toMatch(/segunda/);
    expect(await readNotes(proj.path, "t1")).toBe(content);
  });
});

describe("results-store", () => {
  it("salva success em pasta success", async () => {
    const file = await saveResult(proj.path, {
      taskId: "t1",
      status: "completed",
      steps: 3,
      durationMs: 10,
      summary: "ok",
    });
    expect(file).toMatch(/success/);
  });

  it("salva failed em pasta error", async () => {
    const file = await saveResult(proj.path, {
      taskId: "t1",
      status: "failed",
      steps: 1,
      durationMs: 5,
      summary: "boom",
    });
    expect(file).toMatch(/error/);
  });
});
