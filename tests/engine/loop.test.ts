import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runLoop } from "../../src/engine/loop.js";
import { createRouter } from "../../src/engine/router.js";
import type { ChatMessage, LLMResponse } from "../../src/engine/types.js";
import type { LLMProvider } from "../../src/providers/llm-provider.js";
import { loadEvents } from "../../src/memory/event-store.js";
import { tddFile } from "../../src/memory/paths.js";
import { createDefaultRegistry } from "../../src/tools/index.js";
import { writeFileEnsured } from "../../src/utils/fs.js";
import { makeTmpProject, silentLogger, type TmpProject } from "../helpers/tmp.js";

let proj: TmpProject;

beforeEach(() => {
  proj = makeTmpProject();
});

afterEach(async () => {
  await proj.dispose();
});

function fakeProvider(responses: LLMResponse[]): LLMProvider {
  let i = 0;
  return {
    name: "fake",
    async generate() {
      const next = responses[i] ?? responses[responses.length - 1];
      i += 1;
      return next!;
    },
  };
}

describe("runLoop", () => {
  it("encerra quando o agente devolve apenas texto (end_turn)", async () => {
    await writeFileEnsured(tddFile(proj.path, "t1"), "tarefa simples");
    const provider = fakeProvider([
      {
        stopReason: "end_turn",
        content: [{ type: "text", text: "tudo feito" }],
      },
    ]);
    const router = createRouter({ plan: provider, exec: provider });
    const result = await runLoop({
      task: { taskId: "t1", projectPath: proj.path, tdd: "tarefa simples" },
      registry: createDefaultRegistry(),
      router,
      logger: silentLogger(),
      confirm: async () => true,
      maxSteps: 5,
    });
    expect(result.steps).toBe(1);
    expect(result.finalText).toBe("tudo feito");
  });

  it("executa tool_use e devolve tool_result no próximo turno", async () => {
    const responses: LLMResponse[] = [
      {
        stopReason: "tool_use",
        content: [
          { type: "text", text: "vou ler" },
          { type: "tool_use", id: "u1", name: "read_file", input: { path: "x.txt" } },
        ],
      },
      {
        stopReason: "end_turn",
        content: [{ type: "text", text: "ok li" }],
      },
    ];
    await writeFileEnsured(`${proj.path}/x.txt`, "conteúdo");

    const messagesSeen: ChatMessage[][] = [];
    const provider: LLMProvider = {
      name: "fake",
      async generate(req) {
        messagesSeen.push(req.messages);
        const next = responses.shift();
        return next!;
      },
    };

    const router = createRouter({ plan: provider, exec: provider });
    const result = await runLoop({
      task: { taskId: "t1", projectPath: proj.path, tdd: "x" },
      registry: createDefaultRegistry(),
      router,
      logger: silentLogger(),
      confirm: async () => true,
      maxSteps: 5,
    });
    expect(result.steps).toBe(2);
    expect(messagesSeen[1]?.some((m) => m.content.some((b) => b.type === "tool_result"))).toBe(true);
  });

  it("rejeita ferramenta perigosa quando confirm devolve false", async () => {
    const responses: LLMResponse[] = [
      {
        stopReason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "u1",
            name: "write_file",
            input: { path: "z.txt", content: "x" },
          },
        ],
      },
      {
        stopReason: "end_turn",
        content: [{ type: "text", text: "encerrado" }],
      },
    ];
    const provider: LLMProvider = {
      name: "fake",
      async generate() {
        return responses.shift()!;
      },
    };
    const router = createRouter({ plan: provider, exec: provider });
    const result = await runLoop({
      task: { taskId: "t1", projectPath: proj.path, tdd: "x" },
      registry: createDefaultRegistry(),
      router,
      logger: silentLogger(),
      confirm: async () => false,
      maxSteps: 5,
    });
    expect(result.steps).toBe(2);
  });

  it("bate no limite de maxSteps quando o agente nunca encerra", async () => {
    await writeFileEnsured(`${proj.path}/x.txt`, "conteúdo");

    const provider: LLMProvider = {
      name: "fake",
      async generate() {
        return {
          stopReason: "tool_use",
          content: [
            { type: "text", text: "lendo..." },
            {
              type: "tool_use",
              id: `u-${Math.random()}`,
              name: "read_file",
              input: { path: "x.txt" },
            },
          ],
        };
      },
    };
    const router = createRouter({ plan: provider, exec: provider });

    const result = await runLoop({
      task: { taskId: "t-loop", projectPath: proj.path, tdd: "infinito" },
      registry: createDefaultRegistry(),
      router,
      logger: silentLogger(),
      confirm: async () => true,
      maxSteps: 3,
    });

    expect(result.steps).toBe(3);
    expect(result.terminationReason).toBe("max_steps");
  });

  it("persiste eventos padronizados no .jsonl em ai/state/", async () => {
    await writeFileEnsured(`${proj.path}/x.txt`, "conteúdo");

    const responses: LLMResponse[] = [
      {
        stopReason: "tool_use",
        content: [
          { type: "text", text: "vou ler" },
          {
            type: "tool_use",
            id: "u1",
            name: "read_file",
            input: { path: "x.txt" },
          },
        ],
      },
      {
        stopReason: "end_turn",
        content: [{ type: "text", text: "feito" }],
      },
    ];
    const provider: LLMProvider = {
      name: "fake",
      async generate() {
        return responses.shift()!;
      },
    };
    const router = createRouter({ plan: provider, exec: provider });

    const result = await runLoop({
      task: { taskId: "t-events", projectPath: proj.path, tdd: "x" },
      registry: createDefaultRegistry(),
      router,
      logger: silentLogger(),
      confirm: async () => true,
      maxSteps: 5,
    });

    expect(result.terminationReason).toBe("finished");

    const events = await loadEvents(proj.path, "t-events");
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("start");
    expect(types).toContain("model_call");
    expect(types).toContain("model_text");
    expect(types).toContain("tool_call");
    expect(types).toContain("tool_result");
    expect(types[types.length - 1]).toBe("finish");

    for (const evt of events) {
      expect(evt.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(typeof evt.step).toBe("number");
    }
  });
});
