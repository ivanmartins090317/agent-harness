import type {
  AgentTask,
  ChatMessage,
  ContentBlock,
  LLMResponse,
  ToolResultBlock,
  ToolUseBlock,
} from "./types.js";
import type { Router } from "./router.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { ToolContext } from "../tools/types.js";
import type { Logger } from "../utils/logger.js";
import { buildInitialUserMessage, buildSystemPrompt } from "./system-prompt.js";
import { appendNote } from "../memory/implementation-store.js";
import { recordDecision } from "../memory/state-store.js";

export interface ConfirmFn {
  (tool: string, input: unknown): Promise<boolean>;
}

export interface RunLoopOptions {
  task: AgentTask;
  registry: ToolRegistry;
  router: Router;
  logger: Logger;
  confirm: ConfirmFn;
  maxSteps: number;
}

export interface RunLoopResult {
  steps: number;
  finalText: string;
  stopReason: string;
}

export async function runLoop(opts: RunLoopOptions): Promise<RunLoopResult> {
  const { task, registry, router, logger, confirm, maxSteps } = opts;
  const system = buildSystemPrompt(task);
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: [{ type: "text", text: buildInitialUserMessage(task.tdd) }],
    },
  ];

  const toolCtx: ToolContext = {
    projectPath: task.projectPath,
    taskId: task.taskId,
    logger: {
      info: (m, meta) => logger.info(m, meta),
      warn: (m, meta) => logger.warn(m, meta),
      error: (m, meta) => logger.error(m, meta),
    },
  };

  const toolDescriptors = registry.describe();
  let finalText = "";
  let step = 0;
  let stopReason = "end_turn";

  while (step < maxSteps) {
    step += 1;
    const phase = step === 1 ? "plan" : "exec";
    const provider = router.pick(phase);
    logger.info(`Step ${step}: chamando provider ${provider.name} (fase=${phase})`);

    const response: LLMResponse = await provider.generate({
      system,
      messages,
      tools: toolDescriptors,
      phase,
    });

    stopReason = response.stopReason;
    messages.push({ role: "assistant", content: response.content });

    const text = extractText(response.content);
    if (text) {
      finalText = text;
      await appendNote(task.projectPath, task.taskId, `Step ${step}: ${text}`);
      await recordDecision(task.projectPath, task.taskId, step, text);
    }

    const toolUses = response.content.filter(isToolUse);
    if (toolUses.length === 0) {
      logger.info(`Step ${step}: agente encerrou (stopReason=${stopReason})`);
      break;
    }

    const toolResults: ToolResultBlock[] = [];
    for (const use of toolUses) {
      const result = await runSingleTool(use, registry, toolCtx, confirm, logger);
      toolResults.push(result);
    }

    messages.push({ role: "user", content: toolResults });
  }

  if (step >= maxSteps) {
    logger.warn(`Limite de steps (${maxSteps}) atingido`);
  }

  return { steps: step, finalText, stopReason };
}

function extractText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function isToolUse(block: ContentBlock): block is ToolUseBlock {
  return block.type === "tool_use";
}

async function runSingleTool(
  use: ToolUseBlock,
  registry: ToolRegistry,
  ctx: ToolContext,
  confirm: ConfirmFn,
  logger: Logger,
): Promise<ToolResultBlock> {
  const tool = registry.get(use.name);
  if (!tool) {
    logger.error(`Tool desconhecida solicitada: ${use.name}`);
    return {
      type: "tool_result",
      toolUseId: use.id,
      content: `Tool não encontrada: ${use.name}`,
      isError: true,
    };
  }

  if (tool.dangerous) {
    const approved = await confirm(tool.name, use.input);
    if (!approved) {
      logger.warn(`Ferramenta perigosa rejeitada pelo humano: ${tool.name}`);
      return {
        type: "tool_result",
        toolUseId: use.id,
        content: "Execução rejeitada pelo usuário humano.",
        isError: true,
      };
    }
  }

  logger.info(`Executando tool ${use.name}`, { input: use.input });
  const invocation = await registry.invoke(use.name, use.input, ctx);
  if (!invocation.ok) {
    logger.error(`Falha em ${use.name}: ${invocation.error}`);
    return {
      type: "tool_result",
      toolUseId: use.id,
      content: invocation.error ?? "erro desconhecido",
      isError: true,
    };
  }

  return {
    type: "tool_result",
    toolUseId: use.id,
    content: JSON.stringify(invocation.output),
  };
}
