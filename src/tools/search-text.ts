import { promises as fs } from "node:fs";
import fg from "fast-glob";
import { z } from "zod";
import type { Tool } from "./types.js";
import { resolveSafePath } from "./guards.js";

const inputSchema = z.object({
  pattern: z.string().min(1).describe("Expressão regular (JavaScript) a buscar"),
  glob: z
    .string()
    .optional()
    .describe("Glob para filtrar arquivos. Default: **/* exceto node_modules/.git/dist"),
  caseInsensitive: z.boolean().optional(),
  maxMatches: z.number().int().positive().optional(),
});

type SearchTextInput = z.infer<typeof inputSchema>;

interface SearchMatch {
  file: string;
  line: number;
  text: string;
}

interface SearchTextOutput {
  totalMatches: number;
  truncated: boolean;
  matches: SearchMatch[];
}

const DEFAULT_IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
];

export const searchTextTool: Tool<SearchTextInput, SearchTextOutput> = {
  name: "search_text",
  description:
    "Busca um padrão regex em arquivos do project_path. Retorna arquivo, linha e texto.",
  dangerous: false,
  schema: inputSchema,
  async run(input, ctx) {
    const base = resolveSafePath(ctx.projectPath, ".");
    const glob = input.glob ?? "**/*";
    const max = input.maxMatches ?? 200;
    const flags = input.caseInsensitive ? "gi" : "g";
    const regex = new RegExp(input.pattern, flags);

    const files = await fg(glob, {
      cwd: base,
      absolute: true,
      ignore: DEFAULT_IGNORE,
      onlyFiles: true,
      dot: false,
    });

    const matches: SearchMatch[] = [];
    let total = 0;
    let truncated = false;

    for (const file of files) {
      let content: string;
      try {
        content = await fs.readFile(file, "utf8");
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        regex.lastIndex = 0;
        if (regex.test(lines[i] ?? "")) {
          total += 1;
          if (matches.length < max) {
            matches.push({
              file: file.replace(base + "\\", "").replace(base + "/", ""),
              line: i + 1,
              text: (lines[i] ?? "").slice(0, 500),
            });
          } else {
            truncated = true;
          }
        }
      }
    }

    return { totalMatches: total, truncated, matches };
  },
};
