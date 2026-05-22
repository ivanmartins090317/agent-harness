import { resolve } from "node:path";
import pc from "picocolors";
import { loadEnv } from "../config/env.js";
import { runLoop } from "../engine/loop.js";
import { createRouter } from "../engine/router.js";
import type { AgentTask, RunResult } from "../engine/types.js";
import { appendNote } from "../memory/implementation-store.js";
import { saveResult } from "../memory/results-store.js";
import { loadState, saveState, updateStatus } from "../memory/state-store.js";
import { loadTdd } from "../memory/tdd-loader.js";
import { createAnthropicProvider } from "../providers/anthropic-provider.js";
import { createGeminiProvider } from "../providers/gemini-provider.js";
import { createDefaultRegistry } from "../tools/index.js";
import { createLogger } from "../utils/logger.js";
import { runValidation } from "../validation/validator.js";
import type { RunArgs, ValidateArgs } from "./args.js";
import { createConfirmFn } from "./confirm.js";

export async function runCommand(args: RunArgs): Promise<number> {
  const logger = createLogger("run");
  const env = loadEnv();

  if (!env.anthropicApiKey) {
    logger.error("ANTHROPIC_API_KEY ausente. Defina no .env antes de rodar `run`.");
    return 2;
  }

  const projectPath = resolve(args.project);
  const taskId = args.task;
  const maxSteps = args.maxSteps ?? env.maxSteps;

  logger.info("Iniciando tarefa", { projectPath, taskId, maxSteps });

  const tdd = await loadTdd(projectPath, taskId);
  const task: AgentTask = { taskId, projectPath, tdd };

  await updateStatus(projectPath, taskId, "running");

  const anthropic = createAnthropicProvider({
    apiKey: env.anthropicApiKey,
    planModel: env.planModel,
    execModel: env.execModel,
  });
  const gemini = createGeminiProvider();
  const router = createRouter({ plan: anthropic, exec: anthropic });
  void gemini;

  const registry = createDefaultRegistry();
  const confirm = createConfirmFn({ autoApprove: args.yes });
  const start = Date.now();

  let runResult: RunResult;
  try {
    const loopResult = await runLoop({
      task,
      registry,
      router,
      logger: logger.child("loop"),
      confirm,
      maxSteps,
    });

    let validation;
    if (!args.skipValidation) {
      logger.info("Rodando validação");
      validation = await runValidation({ projectPath });
    }

    const status = validation && !validation.ok ? "failed" : "completed";
    runResult = {
      taskId,
      status,
      steps: loopResult.steps,
      durationMs: Date.now() - start,
      summary: loopResult.finalText || "(sem texto final do agente)",
      ...(validation ? { validation } : {}),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Falha durante a execução", { message });
    runResult = {
      taskId,
      status: "failed",
      steps: 0,
      durationMs: Date.now() - start,
      summary: `Erro: ${message}`,
    };
  }

  const state = await loadState(projectPath, taskId);
  state.status = runResult.status;
  await saveState(projectPath, state);
  await appendNote(
    projectPath,
    taskId,
    `Execução finalizada com status=${runResult.status} em ${runResult.durationMs}ms.`,
  );
  const saved = await saveResult(projectPath, runResult);
  logger.info(`Resultado salvo em ${saved}`);

  console.log(pc.bold(`\nStatus final: ${formatStatus(runResult.status)}`));
  console.log(runResult.summary);
  return runResult.status === "completed" ? 0 : 1;
}

export async function validateCommand(args: ValidateArgs): Promise<number> {
  const logger = createLogger("validate");
  const projectPath = resolve(args.project);
  const taskId = args.task;
  logger.info("Iniciando validação", { projectPath, taskId });

  const start = Date.now();
  const validation = await runValidation({ projectPath });
  const status = validation.ok ? "completed" : "failed";
  const result: RunResult = {
    taskId,
    status,
    steps: 0,
    durationMs: Date.now() - start,
    summary: validation.ok ? "Validação passou." : "Validação falhou.",
    validation,
  };
  const saved = await saveResult(projectPath, result);
  logger.info(`Resultado salvo em ${saved}`);

  for (const check of validation.checks) {
    const icon = check.ran ? (check.ok ? pc.green("OK") : pc.red("FAIL")) : pc.gray("SKIP");
    console.log(`  ${icon}  ${check.name} (${check.durationMs}ms)`);
    if (check.skippedReason) console.log(pc.gray(`         ${check.skippedReason}`));
  }
  return validation.ok ? 0 : 1;
}

function formatStatus(status: string): string {
  if (status === "completed") return pc.green(status);
  if (status === "failed") return pc.red(status);
  return pc.yellow(status);
}
