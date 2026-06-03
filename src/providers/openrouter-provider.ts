import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions.js";
import type {
  ChatMessage,
  ContentBlock,
  LLMRequest,
  LLMResponse,
  StopReason,
  TextBlock,
  ToolResultBlock,
  ToolUseBlock,
} from "../engine/types.js";
import type { LLMProvider } from "./llm-provider.js";

export interface OpenRouterProviderOptions {
  apiKey: string;
  planModel: string;
  execModel: string;
  maxTokens?: number;
  siteUrl?: string;
  siteName?: string;
}

export function createOpenRouterProvider(opts: OpenRouterProviderOptions): LLMProvider {
  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: opts.apiKey,
    defaultHeaders: {
      ...(opts.siteUrl ? { "HTTP-Referer": opts.siteUrl } : {}),
      ...(opts.siteName ? { "X-Title": opts.siteName } : {}),
    },
  });
  const defaultMaxTokens = opts.maxTokens ?? 4096;

  return {
    name: "openrouter",
    async generate(req: LLMRequest): Promise<LLMResponse> {
      const model = req.phase === "plan" ? opts.planModel : opts.execModel;
      const messages = toOpenAIMessages(req.system, req.messages);
      const tools = toOpenAITools(req);

      const response = await client.chat.completions.create({
        model,
        max_tokens: req.maxTokens ?? defaultMaxTokens,
        messages,
        ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
      });

      const choice = response.choices[0];
      if (!choice) {
        return { stopReason: "error", content: [] };
      }

      return {
        stopReason: mapFinishReason(choice.finish_reason),
        content: fromOpenAIMessage(choice.message),
        raw: response,
      };
    },
  };
}

function toOpenAIMessages(
  system: string,
  messages: ChatMessage[],
): ChatCompletionMessageParam[] {
  const result: ChatCompletionMessageParam[] = [{ role: "system", content: system }];

  for (const msg of messages) {
    if (msg.role === "user") {
      result.push(...toOpenAIUserMessages(msg.content));
    } else {
      result.push(...toOpenAIAssistantMessages(msg.content));
    }
  }

  return result;
}

function toOpenAIUserMessages(blocks: ContentBlock[]): ChatCompletionMessageParam[] {
  const textParts: string[] = [];
  const toolResults: ChatCompletionMessageParam[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      textParts.push(block.text);
    } else if (block.type === "tool_result") {
      toolResults.push({
        role: "tool",
        tool_call_id: block.toolUseId,
        content: block.content,
      });
    }
  }

  const result: ChatCompletionMessageParam[] = [];
  if (textParts.length > 0) {
    result.push({ role: "user", content: textParts.join("\n") });
  }
  result.push(...toolResults);
  return result;
}

function toOpenAIAssistantMessages(blocks: ContentBlock[]): ChatCompletionMessageParam[] {
  const textParts: string[] = [];
  const toolCalls: ChatCompletionMessageToolCall[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      textParts.push(block.text);
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input),
        },
      });
    }
  }

  const msg: ChatCompletionMessageParam = {
    role: "assistant",
    content: textParts.join("\n") || null,
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  };

  return [msg];
}

function toOpenAITools(req: LLMRequest): ChatCompletionTool[] {
  return req.tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

function fromOpenAIMessage(message: OpenAI.Chat.Completions.ChatCompletionMessage): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  if (message.content) {
    const textBlock: TextBlock = { type: "text", text: message.content };
    blocks.push(textBlock);
  }

  if (message.tool_calls && message.tool_calls.length > 0) {
    for (const call of message.tool_calls) {
      if (call.type !== "function") continue;

      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(call.function.arguments) as Record<string, unknown>;
      } catch {
        const fallback: ToolResultBlock = {
          type: "tool_result",
          toolUseId: call.id,
          content: `Erro ao parsear argumentos da tool: ${call.function.arguments}`,
          isError: true,
        };
        blocks.push(fallback);
        continue;
      }
      const toolUse: ToolUseBlock = {
        type: "tool_use",
        id: call.id,
        name: call.function.name,
        input,
      };
      blocks.push(toolUse);
    }
  }

  return blocks;
}

function mapFinishReason(reason: string | null): StopReason {
  switch (reason) {
    case "stop":
      return "end_turn";
    case "tool_calls":
      return "tool_use";
    case "length":
      return "max_tokens";
    default:
      return "end_turn";
  }
}
