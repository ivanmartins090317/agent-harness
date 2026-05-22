import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const messagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class FakeAnthropic {
      messages = { create: messagesCreate };
    },
  };
});

import { createAnthropicProvider } from "../../src/providers/anthropic-provider.js";
import type { LLMRequest } from "../../src/engine/types.js";

beforeEach(() => {
  messagesCreate.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

function baseReq(over: Partial<LLMRequest> = {}): LLMRequest {
  return {
    system: "sys",
    messages: [{ role: "user", content: [{ type: "text", text: "oi" }] }],
    tools: [
      {
        name: "read_file",
        description: "lê",
        dangerous: false,
        inputSchema: { type: "object", properties: { path: { type: "string" } } },
      },
    ],
    phase: "plan",
    ...over,
  };
}

describe("anthropic-provider", () => {
  it("usa planModel na fase plan e parseia tool_use", async () => {
    messagesCreate.mockResolvedValueOnce({
      stop_reason: "tool_use",
      content: [
        { type: "text", text: "vou ler" },
        { type: "tool_use", id: "u1", name: "read_file", input: { path: "a" } },
      ],
    });
    const provider = createAnthropicProvider({
      apiKey: "fake",
      planModel: "claude-plan",
      execModel: "claude-exec",
    });
    const resp = await provider.generate(baseReq());
    expect(messagesCreate).toHaveBeenCalledOnce();
    expect(messagesCreate.mock.calls[0]?.[0].model).toBe("claude-plan");
    expect(resp.stopReason).toBe("tool_use");
    expect(resp.content).toHaveLength(2);
  });

  it("usa execModel na fase exec e mapeia end_turn", async () => {
    messagesCreate.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "feito" }],
    });
    const provider = createAnthropicProvider({
      apiKey: "fake",
      planModel: "claude-plan",
      execModel: "claude-exec",
    });
    const resp = await provider.generate(baseReq({ phase: "exec" }));
    expect(messagesCreate.mock.calls[0]?.[0].model).toBe("claude-exec");
    expect(resp.stopReason).toBe("end_turn");
  });

  it("envia tool_result quando mensagem contém um", async () => {
    messagesCreate.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "ok" }],
    });
    const provider = createAnthropicProvider({
      apiKey: "fake",
      planModel: "x",
      execModel: "y",
    });
    await provider.generate(
      baseReq({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                toolUseId: "u1",
                content: "resultado",
              },
            ],
          },
        ],
      }),
    );
    const sentMessages = messagesCreate.mock.calls[0]?.[0].messages;
    expect(sentMessages[0].content[0].type).toBe("tool_result");
    expect(sentMessages[0].content[0].tool_use_id).toBe("u1");
  });
});
