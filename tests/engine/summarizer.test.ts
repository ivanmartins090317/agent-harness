import { describe, expect, it, vi } from "vitest";
import { summarizePreviousEvents } from "../../src/engine/summarizer.js";
import { createRouter } from "../../src/engine/router.js";
import type {
  LLMRequest,
  LLMResponse,
  StateEvent,
} from "../../src/engine/types.js";
import type { LLMProvider } from "../../src/providers/llm-provider.js";
import { silentLogger } from "../helpers/tmp.js";

function fakeProvider(
  impl: (req: LLMRequest) => Promise<LLMResponse>,
  name = "fake-plan",
): LLMProvider {
  return { name, generate: impl };
}

function makeEvents(n: number, base: Partial<StateEvent> = {}): StateEvent[] {
  return Array.from({ length: n }, (_, i) => ({
    step: i + 1,
    type: i === n - 1 ? "finish" : "model_text",
    timestamp: new Date(2025, 0, 1, 0, 0, i).toISOString(),
    message: `msg ${i + 1}`,
    ...base,
  }));
}

describe("summarizePreviousEvents", () => {
  it("retorna string vazia quando não há eventos", async () => {
    const generate = vi.fn();
    const provider = fakeProvider(generate);
    const router = createRouter({ plan: provider, exec: provider });
    const out = await summarizePreviousEvents([], router, silentLogger());
    expect(out).toBe("");
    expect(generate).not.toHaveBeenCalled();
  });

  it("usa fallback determinístico quando há poucos eventos (< 3) e não chama o LLM", async () => {
    const generate = vi.fn();
    const provider = fakeProvider(generate);
    const router = createRouter({ plan: provider, exec: provider });

    const out = await summarizePreviousEvents(
      makeEvents(2),
      router,
      silentLogger(),
    );

    expect(generate).not.toHaveBeenCalled();
    expect(out).toMatch(/Histórico resumido da sessão anterior/);
    expect(out).toMatch(/último step: 2/);
  });

  it("chama o LLM (fase=plan) e devolve o texto retornado, embrulhado em cabeçalho", async () => {
    let captured: LLMRequest | undefined;
    const provider = fakeProvider(async (req) => {
      captured = req;
      return {
        stopReason: "end_turn",
        content: [{ type: "text", text: "- arquivo X tocado\n- testes passaram" }],
      };
    });
    const router = createRouter({ plan: provider, exec: provider });

    const out = await summarizePreviousEvents(
      makeEvents(10),
      router,
      silentLogger(),
    );

    expect(captured).toBeDefined();
    expect(captured?.phase).toBe("plan");
    expect(captured?.tools).toEqual([]);
    expect(captured?.maxTokens).toBeGreaterThan(0);
    expect(out).toMatch(/Histórico resumido da sessão anterior/);
    expect(out).toMatch(/arquivo X tocado/);
    expect(out).toMatch(/testes passaram/);
  });

  it("cai no fallback determinístico quando o LLM lança erro", async () => {
    const provider = fakeProvider(async () => {
      throw new Error("boom");
    });
    const router = createRouter({ plan: provider, exec: provider });

    const warn = vi.fn();
    const logger = { ...silentLogger(), warn };

    const out = await summarizePreviousEvents(makeEvents(5), router, logger);

    expect(warn).toHaveBeenCalled();
    expect(out).toMatch(/Histórico resumido da sessão anterior/);
    expect(out).toMatch(/eventos:/);
    expect(out).toMatch(/último step:/);
  });

  it("cai no fallback determinístico quando o LLM retorna texto vazio", async () => {
    const provider = fakeProvider(async () => ({
      stopReason: "end_turn",
      content: [{ type: "text", text: "   " }],
    }));
    const router = createRouter({ plan: provider, exec: provider });

    const warn = vi.fn();
    const logger = { ...silentLogger(), warn };

    const out = await summarizePreviousEvents(makeEvents(5), router, logger);

    expect(warn).toHaveBeenCalled();
    expect(out).toMatch(/eventos:/);
  });

  it("trunca campos grandes antes de enviar ao LLM", async () => {
    let captured: LLMRequest | undefined;
    const provider = fakeProvider(async (req) => {
      captured = req;
      return {
        stopReason: "end_turn",
        content: [{ type: "text", text: "ok" }],
      };
    });
    const router = createRouter({ plan: provider, exec: provider });

    const huge = "X".repeat(5_000);
    const events: StateEvent[] = [
      ...makeEvents(2),
      {
        step: 3,
        type: "tool_result",
        timestamp: new Date().toISOString(),
        tool: "read_file",
        output: { content: huge },
      },
    ];

    await summarizePreviousEvents(events, router, silentLogger());

    const userBlock = captured?.messages[0]?.content[0];
    const promptText =
      userBlock && userBlock.type === "text" ? userBlock.text : "";
    expect(promptText).not.toContain(huge);
    expect(promptText).toMatch(/truncado/);
  });
});
