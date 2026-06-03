import { Command } from "commander";
import type { ProviderName } from "../config/env.js";

export interface RunArgs {
  project: string;
  task: string;
  yes: boolean;
  maxSteps?: number;
  skipValidation: boolean;
  planProvider?: ProviderName;
  execProvider?: ProviderName;
  planModel?: string;
  execModel?: string;
  interactive?: boolean;
}

export interface ValidateArgs {
  project: string;
  task: string;
}

export interface ParsedCli {
  command: "run" | "validate";
  run?: RunArgs;
  validate?: ValidateArgs;
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("agent-harness")
    .description(
      "Harness para executar tarefas guiadas por Tech Design Docs em um repositório externo",
    )
    .version("0.1.0");

  program
    .command("run")
    .description("Executa uma tarefa definida por ai/tdd/<task_id>.md")
    .option("--project <path>", "Caminho absoluto para o project_path alvo")
    .option("--task <id>", "Identificador da task")
    .option("-i, --interactive", "Forçar modo interativo com perguntas no terminal", false)
    .option("--yes", "Auto-aprovar ferramentas perigosas (use com cuidado)", false)
    .option(
      "--max-steps <n>",
      "Limite de iterações do loop do agente",
      (v) => Number.parseInt(v, 10),
    )
    .option("--skip-validation", "Não rodar validação ao final", false)
    .option(
      "--plan-provider <provider>",
      "Provider para fase de planejamento: anthropic | openrouter",
    )
    .option(
      "--exec-provider <provider>",
      "Provider para fase de execução: anthropic | openrouter",
    )
    .option("--plan-model <model>", "Modelo para fase de planejamento (ex: claude-opus-4-20250514)")
    .option(
      "--exec-model <model>",
      "Modelo para fase de execução (ex: qwen/qwen3-235b-a22b:free)",
    );

  program
    .command("validate")
    .description("Roda apenas a etapa de validação (test/lint/build) e grava o resultado")
    .requiredOption("--project <path>", "Caminho absoluto para o project_path alvo")
    .requiredOption("--task <id>", "Identificador da task");

  return program;
}
