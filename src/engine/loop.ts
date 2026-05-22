import type {
  AgentTask,
  ChatMessage,
  ContentBlock,
  LLMResponse,
  LoopTerminationReason,
  StateEvent,
  StopReason,
  TextBlock,
  ToolResultBlock,
  ToolUseBlock,
} from "./types.js";
import type { Router } from "./router.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { ToolContext } from "../tools/types.js";
import type { Logger } from "../utils/logger.js";
import { buildInitialUserMessage, buildSystemPrompt } from "./system-prompt.js";
import { summarizePreviousEvents } from "./summarizer.js";
import { appendNote } from "../memory/implementation-store.js";
import { recordDecision } from "../memory/state-store.js";
import { appendEvent, loadEvents } from "../memory/event-store.js";

/**
 * Loop principal do agente.
 *
 * Ciclo (em alto nível):
 *   1. Carregar memória anterior (eventos em ai/state/<taskId>.jsonl).
 *   2. Montar system prompt + mensagem inicial com o TDD.
 *      (TDD chega em `task.tdd`, pré-carregado pelo caller via
 *       `memory/tdd-loader.ts` — ver `cli/commands.ts`.)
 *   3. Iterar até maxSteps:
 *        chamar modelo -> interpretar resposta ->
 *        se houver tool_use: executar via registry e seguir;
 *        se não houver tool_use: encerrar com `finish`.
 *   4. Registrar evento `finish` ou `max_steps` no stream de estado.
 *   5. Retornar resultado estruturado para o caller decidir success/error.
 */

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
  stopReason: StopReason;
  terminationReason: LoopTerminationReason;
}

interface IterationContext {
  task: AgentTask;
  registry: ToolRegistry;
  router: Router;
  logger: Logger;
  confirm: ConfirmFn;
  toolCtx: ToolContext;
  system: string;
  messages: ChatMessage[];
  toolDescriptors: ReturnType<ToolRegistry["describe"]>;
}

interface IterationOutcome {
  shouldContinue: boolean;
  stopReason: StopReason;
  finalText: string;
}

export async function runLoop(opts: RunLoopOptions): Promise<RunLoopResult> {
  const { task, registry, router, logger, confirm, maxSteps } = opts;

  const previousEvents = await loadEvents(task.projectPath, task.taskId);
  if (previousEvents.length > 0) {
    logger.info(
      `Carregados ${previousEvents.length} eventos anteriores para ${task.taskId}`,
    );
  }

  const system = buildSystemPrompt(task);
  const messages = await prepareInitialMessages(task, previousEvents, router, logger);
  const toolCtx = buildToolContext(task, logger);

  await appendEvent(task.projectPath, task.taskId, {
    step: 0,
    type: "start",
    message: `maxSteps=${maxSteps}, previousEvents=${previousEvents.length}`,
  });

  const ctx: IterationContext = {
    task,
    registry,
    router,
    logger,
    confirm,
    toolCtx,
    system,
    messages,
    toolDescriptors: registry.describe(),
  };

  let step = 0;
  let finalText = "";
  let stopReason: StopReason = "end_turn";
  let terminationReason: LoopTerminationReason = "max_steps";

  while (step < maxSteps) {
    step += 1;
    const outcome = await runIteration(ctx, step);
    stopReason = outcome.stopReason;
    if (outcome.finalText) finalText = outcome.finalText;
    if (!outcome.shouldContinue) {
      terminationReason = "finished";
      break;
    }
  }

  await finalizeRun(task, step, finalText, stopReason, terminationReason, logger);

  return { steps: step, finalText, stopReason, terminationReason };
}

async function prepareInitialMessages(
  task: AgentTask,
  previousEvents: StateEvent[],
  router: Router,
  logger: Logger,
): Promise<ChatMessage[]> {
  const blocks: TextBlock[] = [
    { type: "text", text: buildInitialUserMessage(task.tdd) },
  ];

  const recap = await summarizePreviousEvents(previousEvents, router, logger);
  if (recap) blocks.push({ type: "text", text: recap });

  return [{ role: "user", content: blocks }];
}

function buildToolContext(task: AgentTask, logger: Logger): ToolContext {
  return {
    projectPath: task.projectPath,
    taskId: task.taskId,
    logger: {
      info: (m, meta) => logger.info(m, meta),
      warn: (m, meta) => logger.warn(m, meta),
      error: (m, meta) => logger.error(m, meta),
    },
  };
}

async function runIteration(
  ctx: IterationContext,
  step: number,
): Promise<IterationOutcome> {
  const { task, router, logger, system, messages, toolDescriptors } = ctx;

  const phase = step === 1 ? "plan" : "exec";
  const provider = router.pick(phase);
  logger.info(`Step ${step}: chamando provider ${provider.name} (fase=${phase})`);

  await appendEvent(task.projectPath, task.taskId, {
    step,
    type: "model_call",
    tool: provider.name,
    input: { phase },
  });

  const response: LLMResponse = await provider.generate({
    system,
    messages,
    tools: toolDescriptors,
    phase,
  });

  messages.push({ role: "assistant", content: response.content });

  const text = extractText(response.content);
  if (text) {
    await onAssistantText(task, step, text);
  }

  const toolUses = response.content.filter(isToolUse);
  if (toolUses.length === 0) {
    logger.info(`Step ${step}: agente encerrou (stopReason=${response.stopReason})`);
    return { shouldContinue: false, stopReason: response.stopReason, finalText: text };
  }

  const toolResults = await executeToolCalls(ctx, step, toolUses);
  messages.push({ role: "user", content: toolResults });

  return { shouldContinue: true, stopReason: response.stopReason, finalText: text };
}

async function onAssistantText(
  task: AgentTask,
  step: number,
  text: string,
): Promise<void> {
  await appendEvent(task.projectPath, task.taskId, {
    step,
    type: "model_text",
    message: text,
  });
  await appendNote(task.projectPath, task.taskId, `Step ${step}: ${text}`);
  await recordDecision(task.projectPath, task.taskId, step, text);
}

async function executeToolCalls(
  ctx: IterationContext,
  step: number,
  uses: ToolUseBlock[],
): Promise<ToolResultBlock[]> {
  const results: ToolResultBlock[] = [];
  for (const use of uses) {
    const result = await runSingleTool(ctx, step, use);
    results.push(result);
  }
  return results;
}

async function runSingleTool(
  ctx: IterationContext,
  step: number,
  use: ToolUseBlock,
): Promise<ToolResultBlock> {
  const { task, registry, toolCtx, confirm, logger } = ctx;

  await appendEvent(task.projectPath, task.taskId, {
    step,
    type: "tool_call",
    tool: use.name,
    input: use.input,
  });

  const tool = registry.get(use.name);
  if (!tool) {
    logger.error(`Tool desconhecida solicitada: ${use.name}`);
    return errorResult(task, step, use, `Tool não encontrada: ${use.name}`);
  }

  if (tool.dangerous) {
    const approved = await confirm(tool.name, use.input);
    if (!approved) {
      logger.warn(`Ferramenta perigosa rejeitada pelo humano: ${tool.name}`);
      await appendEvent(task.projectPath, task.taskId, {
        step,
        type: "tool_rejected",
        tool: use.name,
        input: use.input,
      });
      return {
        type: "tool_result",
        toolUseId: use.id,
        content: "Execução rejeitada pelo usuário humano.",
        isError: true,
      };
    }
  }

  logger.info(`Executando tool ${use.name}`, { input: use.input });
  const invocation = await registry.invoke(use.name, use.input, toolCtx);
  if (!invocation.ok) {
    logger.error(`Falha em ${use.name}: ${invocation.error}`);
    return errorResult(task, step, use, invocation.error ?? "erro desconhecido");
  }

  await appendEvent(task.projectPath, task.taskId, {
    step,
    type: "tool_result",
    tool: use.name,
    output: invocation.output,
  });

  return {
    type: "tool_result",
    toolUseId: use.id,
    content: JSON.stringify(invocation.output),
  };
}

async function errorResult(
  task: AgentTask,
  step: number,
  use: ToolUseBlock,
  message: string,
): Promise<ToolResultBlock> {
  await appendEvent(task.projectPath, task.taskId, {
    step,
    type: "error",
    tool: use.name,
    input: use.input,
    message,
  });
  return {
    type: "tool_result",
    toolUseId: use.id,
    content: message,
    isError: true,
  };
}

async function finalizeRun(
  task: AgentTask,
  step: number,
  finalText: string,
  stopReason: StopReason,
  terminationReason: LoopTerminationReason,
  logger: Logger,
): Promise<void> {
  if (terminationReason === "max_steps") {
    logger.warn(`Limite de steps atingido em ${step}`);
  }
  await appendEvent(task.projectPath, task.taskId, {
    step,
    type: terminationReason === "finished" ? "finish" : "max_steps",
    message: finalText,
    output: { stopReason },
  });
}

function extractText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function isToolUse(block: ContentBlock): block is ToolUseBlock {
  return block.type === "tool_use";
}
