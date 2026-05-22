import { Command } from "commander";

export interface RunArgs {
  project: string;
  task: string;
  yes: boolean;
  maxSteps?: number;
  skipValidation: boolean;
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
    .requiredOption("--project <path>", "Caminho absoluto para o project_path alvo")
    .requiredOption("--task <id>", "Identificador da task")
    .option("--yes", "Auto-aprovar ferramentas perigosas (use com cuidado)", false)
    .option(
      "--max-steps <n>",
      "Limite de iterações do loop do agente",
      (v) => Number.parseInt(v, 10),
    )
    .option("--skip-validation", "Não rodar validação ao final", false);

  program
    .command("validate")
    .description("Roda apenas a etapa de validação (test/lint/build) e grava o resultado")
    .requiredOption("--project <path>", "Caminho absoluto para o project_path alvo")
    .requiredOption("--task <id>", "Identificador da task");

  return program;
}
