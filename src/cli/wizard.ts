import { confirm, input, select } from "@inquirer/prompts";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pc from "picocolors";
import type { AgentEnv, ProviderName } from "../config/env.js";
import type { RunArgs } from "./args.js";

const FREE_MODELS = [
  { value: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B Instruct (128k ctx)" },
  { value: "qwen/qwen3-235b-a22b:free", name: "Qwen3 235B A22B (40k ctx)" },
  { value: "google/gemma-3-27b-it:free", name: "Gemma 3 27B IT (8k ctx)" },
  { value: "custom", name: "Digitar manualmente..." },
];

const ANTHROPIC_MODELS = [
  { value: "claude-opus-4-20250514", name: "Claude Opus 4 (recomendado)" },
  { value: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
  { value: "claude-haiku-4-5", name: "Claude Haiku 4.5 (mais rápido)" },
  { value: "custom", name: "Digitar manualmente..." },
];

export interface WizardResult {
  project: string;
  task: string;
  planProvider: ProviderName;
  planModel: string;
  execProvider: ProviderName;
  execModel: string;
  yes: boolean;
  skipValidation: boolean;
  maxSteps?: number;
}

/**
 * Retorna true se o processo está rodando em um terminal interativo.
 * Em CI ou pipes, o wizard não deve ser invocado.
 */
export function isInteractiveTty(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Verifica se todos os campos obrigatórios já foram fornecidos via CLI,
 * dispensando o wizard.
 */
export function isWizardNeeded(args: Partial<RunArgs>, env: AgentEnv): boolean {
  const hasPlanProvider = Boolean(args.planProvider ?? env.planProvider);
  const hasExecProvider = Boolean(args.execProvider ?? env.execProvider);
  return !args.project || !args.task || !hasPlanProvider || !hasExecProvider;
}

export async function runWizard(args: Partial<RunArgs>, env: AgentEnv): Promise<WizardResult> {
  console.log(pc.bold(pc.cyan("\n🤖 Agent Harness — Configuração interativa\n")));

  const project = args.project ?? (await askProjectPath());
  const task = args.task ?? (await askTaskId(project));

  console.log(pc.gray("\n─── Fase de planejamento (step 1) ─────────────────────\n"));
  const planProvider = args.planProvider ?? (await askProvider("planejamento"));
  const planModel = args.planModel ?? (await askModel(planProvider, "planejamento", env));

  console.log(pc.gray("\n─── Fase de execução (demais steps) ───────────────────\n"));

  const reuseForExec = await confirm({
    message: "Usar o mesmo provider e modelo na fase de execução?",
    default: false,
  });

  let execProvider: ProviderName;
  let execModel: string;

  if (reuseForExec) {
    execProvider = planProvider;
    execModel = planModel;
  } else {
    execProvider = args.execProvider ?? (await askProvider("execução"));
    execModel = args.execModel ?? (await askModel(execProvider, "execução", env));
  }

  console.log(pc.gray("\n─── Opções gerais ─────────────────────────────────────\n"));

  const yes =
    args.yes ??
    (await confirm({
      message: "Auto-aprovar ferramentas perigosas (write, edit, terminal)?",
      default: false,
    }));

  const skipValidation =
    args.skipValidation ??
    (await confirm({
      message: "Pular validação (npm test/lint/build) ao final?",
      default: false,
    }));

  printSummary({ project, task, planProvider, planModel, execProvider, execModel, yes, skipValidation });

  const confirmed = await confirm({ message: "Confirmar e iniciar?", default: true });
  if (!confirmed) {
    console.log(pc.yellow("\nExecução cancelada pelo usuário."));
    process.exit(0);
  }

  return {
    project,
    task,
    planProvider,
    planModel,
    execProvider,
    execModel,
    yes,
    skipValidation,
    maxSteps: args.maxSteps,
  };
}

async function askProjectPath(): Promise<string> {
  return input({
    message: "Caminho absoluto para o repositório alvo:",
    validate: (v) => {
      const resolved = resolve(v);
      if (!existsSync(resolved)) return `Diretório não encontrado: ${resolved}`;
      return true;
    },
  });
}

async function askTaskId(project: string): Promise<string> {
  return input({
    message: "ID da tarefa (ex: refatorar-login):",
    validate: (v) => {
      if (!v.trim()) return "O ID da tarefa não pode ser vazio.";
      const tddPath = resolve(project, "ai", "tdd", `${v.trim()}.md`);
      if (!existsSync(tddPath))
        return `TDD não encontrado em: ${tddPath}`;
      return true;
    },
  });
}

async function askProvider(phase: string): Promise<ProviderName> {
  return select<ProviderName>({
    message: `Provider para a fase de ${phase}:`,
    choices: [
      {
        value: "anthropic",
        name: "Anthropic (Claude) — requer ANTHROPIC_API_KEY",
        description: "Melhor qualidade de raciocínio. Modelos pagos.",
      },
      {
        value: "openrouter",
        name: "OpenRouter — requer OPENROUTER_API_KEY",
        description: "Acesso a múltiplos modelos, incluindo opções gratuitas.",
      },
    ],
  });
}

async function askModel(provider: ProviderName, phase: string, env: AgentEnv): Promise<string> {
  const defaultModel = phase === "planejamento" ? env.planModel : env.execModel;
  const choices = provider === "openrouter" ? FREE_MODELS : ANTHROPIC_MODELS;

  const selected = await select<string>({
    message: `Modelo para ${phase}:`,
    choices: choices.map((c) => ({
      ...c,
      description: c.value === defaultModel ? `${c.name} (padrão atual)` : undefined,
    })),
    default: choices[0].value,
  });

  if (selected === "custom") {
    return input({
      message: `Digite o nome do modelo (${provider}):`,
      default: defaultModel,
      validate: (v) => (v.trim() ? true : "O nome do modelo não pode ser vazio."),
    });
  }

  return selected;
}

function printSummary(cfg: Omit<WizardResult, "maxSteps">): void {
  console.log(pc.bold(pc.gray("\n─── Resumo da configuração ────────────────────────────\n")));
  console.log(`  ${pc.cyan("Projeto:")}      ${cfg.project}`);
  console.log(`  ${pc.cyan("Tarefa:")}       ${cfg.task}`);
  console.log(`  ${pc.cyan("Plan:")}         ${pc.yellow(cfg.planProvider)} › ${cfg.planModel}`);
  console.log(`  ${pc.cyan("Exec:")}         ${pc.yellow(cfg.execProvider)} › ${cfg.execModel}`);
  console.log(`  ${pc.cyan("Auto-aprovar:")} ${cfg.yes ? pc.red("sim") : pc.green("não")}`);
  console.log(`  ${pc.cyan("Skip valid.:")} ${cfg.skipValidation ? "sim" : "não"}`);
  console.log();
}
