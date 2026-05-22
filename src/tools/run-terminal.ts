import { execa } from "execa";
import { z } from "zod";
import type { Tool } from "./types.js";
import { loadEnv } from "../config/env.js";

const inputSchema = z.object({
  command: z.string().min(1).describe("Comando a executar"),
  args: z.array(z.string()).optional().describe("Argumentos do comando"),
  cwd: z
    .string()
    .optional()
    .describe("Diretório relativo ao project_path (default: project_path)"),
  timeoutMs: z.number().int().positive().optional(),
});

type RunTerminalInput = z.infer<typeof inputSchema>;

interface RunTerminalOutput {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

const STDOUT_LIMIT = 16_000;

export const runTerminalTool: Tool<RunTerminalInput, RunTerminalOutput> = {
  name: "run_terminal",
  description:
    "Executa um comando no terminal com cwd dentro do project_path. Usado para testes, lint, build.",
  dangerous: true,
  schema: inputSchema,
  async run(input, ctx) {
    const env = loadEnv();
    const timeout = input.timeoutMs ?? env.terminalTimeoutMs;
    const cwd = input.cwd
      ? resolveCwd(ctx.projectPath, input.cwd)
      : ctx.projectPath;
    const start = Date.now();
    const result = await execa(input.command, input.args ?? [], {
      cwd,
      timeout,
      reject: false,
      all: false,
      shell: false,
      env: process.env,
    });
    const durationMs = Date.now() - start;
    return {
      command: [input.command, ...(input.args ?? [])].join(" "),
      exitCode: typeof result.exitCode === "number" ? result.exitCode : -1,
      stdout: truncate(result.stdout?.toString() ?? "", STDOUT_LIMIT),
      stderr: truncate(result.stderr?.toString() ?? "", STDOUT_LIMIT),
      timedOut: Boolean(result.timedOut),
      durationMs,
    };
  },
};

function resolveCwd(projectPath: string, rel: string): string {
  const safe = rel.replace(/\\/g, "/");
  if (safe.startsWith("..") || safe.includes("/../")) {
    throw new Error(`cwd inválido: ${rel}`);
  }
  return `${projectPath}/${safe}`;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max)}\n...[truncado ${str.length - max} chars]`;
}
