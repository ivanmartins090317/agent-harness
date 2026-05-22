import { execa } from "execa";
import { z } from "zod";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  staged: z.boolean().optional().describe("Se true, retorna diff staged (--cached)"),
  path: z.string().optional().describe("Caminho específico para limitar o diff"),
});

type GitDiffInput = z.infer<typeof inputSchema>;

interface GitDiffOutput {
  empty: boolean;
  diff: string;
}

const DIFF_LIMIT = 32_000;

export const gitDiffTool: Tool<GitDiffInput, GitDiffOutput> = {
  name: "git_diff",
  description: "Executa `git diff` (opcionalmente staged) dentro do project_path.",
  dangerous: false,
  schema: inputSchema,
  async run(input, ctx) {
    const args = ["diff", "--no-color"];
    if (input.staged) args.push("--cached");
    if (input.path) args.push("--", input.path);
    const result = await execa("git", args, {
      cwd: ctx.projectPath,
      reject: false,
    });
    if (result.exitCode !== 0) {
      throw new Error(`git diff falhou: ${result.stderr}`);
    }
    const diff = result.stdout.toString();
    const truncated =
      diff.length > DIFF_LIMIT
        ? `${diff.slice(0, DIFF_LIMIT)}\n...[truncado ${diff.length - DIFF_LIMIT} chars]`
        : diff;
    return { empty: diff.trim().length === 0, diff: truncated };
  },
};
