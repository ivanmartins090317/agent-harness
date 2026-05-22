import { execa } from "execa";
import { z } from "zod";
import type { Tool } from "./types.js";

const inputSchema = z.object({});

type GitStatusInput = z.infer<typeof inputSchema>;

interface GitStatusEntry {
  status: string;
  path: string;
}

interface GitStatusOutput {
  clean: boolean;
  entries: GitStatusEntry[];
  raw: string;
}

export const gitStatusTool: Tool<GitStatusInput, GitStatusOutput> = {
  name: "git_status",
  description: "Executa `git status --porcelain` dentro do project_path.",
  dangerous: false,
  schema: inputSchema,
  async run(_input, ctx) {
    const result = await execa("git", ["status", "--porcelain"], {
      cwd: ctx.projectPath,
      reject: false,
    });
    if (result.exitCode !== 0) {
      throw new Error(`git status falhou: ${result.stderr}`);
    }
    const raw = result.stdout.toString();
    const entries = raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => ({
        status: line.slice(0, 2),
        path: line.slice(3),
      }));
    return { clean: entries.length === 0, entries, raw };
  },
};
