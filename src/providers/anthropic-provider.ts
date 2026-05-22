import Anthropic from "@anthropic-ai/sdk";
import type {
  ChatMessage,
  ContentBlock,
  LLMRequest,
  LLMResponse,
  StopReason,
  ToolResultBlock,
  ToolUseBlock,
} from "../engine/types.js";
import type { LLMProvider } from "./llm-provider.js";

type AnthropicBlockParam =
  | Anthropic.TextBlockParam
  | Anthropic.ImageBlockParam
  | Anthropic.ToolUseBlockParam
  | Anthropic.ToolResultBlockParam;

export interface AnthropicProviderOptions {
  apiKey: string;
  planModel: string;
  execModel: string;
  maxTokens?: number;
}

export function createAnthropicProvider(opts: AnthropicProviderOptions): LLMProvider {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const defaultMaxTokens = opts.maxTokens ?? 4096;

  return {
    name: "anthropic",
    async generate(req: LLMRequest): Promise<LLMResponse> {
      const model = req.phase === "plan" ? opts.planModel : opts.execModel;
      const response = await client.messages.create({
        model,
        max_tokens: req.maxTokens ?? defaultMaxTokens,
        system: req.system,
        tools: req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: ensureObjectSchema(t.inputSchema),
        })),
        messages: req.messages.map(toAnthropicMessage),
      });

      return {
        stopReason: mapStopReason(response.stop_reason),
        content: response.content.map(fromAnthropicBlock),
        raw: response,
      };
    },
  };
}

function toAnthropicMessage(msg: ChatMessage): Anthropic.MessageParam {
  return {
    role: msg.role,
    content: msg.content.map(toAnthropicBlock),
  };
}

function toAnthropicBlock(block: ContentBlock): AnthropicBlockParam {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "tool_use":
      return {
        type: "tool_use",
        id: block.id,
        name: block.name,
        input: block.input,
      };
    case "tool_result":
      return {
        type: "tool_result",
        tool_use_id: block.toolUseId,
        content: block.content,
        is_error: block.isError,
      };
  }
}

function ensureObjectSchema(schema: Record<string, unknown>): Anthropic.Tool.InputSchema {
  if (schema.type === "object") {
    return schema as Anthropic.Tool.InputSchema;
  }
  return { type: "object", ...schema } as Anthropic.Tool.InputSchema;
}

function fromAnthropicBlock(block: Anthropic.ContentBlock): ContentBlock {
  if (block.type === "text") {
    return { type: "text", text: block.text };
  }
  if (block.type === "tool_use") {
    const tu: ToolUseBlock = {
      type: "tool_use",
      id: block.id,
      name: block.name,
      input: (block.input as Record<string, unknown>) ?? {},
    };
    return tu;
  }
  const fallback: ToolResultBlock = {
    type: "tool_result",
    toolUseId: "unknown",
    content: JSON.stringify(block),
    isError: true,
  };
  return fallback;
}

function mapStopReason(reason: Anthropic.Message["stop_reason"]): StopReason {
  switch (reason) {
    case "end_turn":
      return "end_turn";
    case "tool_use":
      return "tool_use";
    case "max_tokens":
      return "max_tokens";
    default:
      return "end_turn";
  }
}
