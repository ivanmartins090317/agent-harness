import { promises as fs } from "node:fs";
import { z } from "zod";
import type { Tool } from "./types.js";
import { resolveSafePath } from "./guards.js";

const inputSchema = z.object({
  path: z.string().describe("Caminho do arquivo relativo ao project_path"),
  oldString: z
    .string()
    .min(1)
    .describe("Trecho exato a ser substituído (deve ser único no arquivo)"),
  newString: z.string().describe("Texto que substituirá oldString"),
  replaceAll: z
    .boolean()
    .optional()
    .describe("Se true, substitui todas as ocorrências; senão exige unicidade"),
});

type EditFileInput = z.infer<typeof inputSchema>;

interface EditFileOutput {
  path: string;
  replacements: number;
}

export const editFileTool: Tool<EditFileInput, EditFileOutput> = {
  name: "edit_file",
  description:
    "Substitui um trecho exato em um arquivo. Por padrão exige que oldString seja único.",
  dangerous: true,
  schema: inputSchema,
  async run(input, ctx) {
    const abs = resolveSafePath(ctx.projectPath, input.path);
    const current = await fs.readFile(abs, "utf8");
    const replaceAll = input.replaceAll ?? false;
    const occurrences = countOccurrences(current, input.oldString);

    if (occurrences === 0) {
      throw new Error(`Trecho não encontrado em ${input.path}`);
    }
    if (!replaceAll && occurrences > 1) {
      throw new Error(
        `oldString encontrado ${occurrences} vezes em ${input.path}; refine o trecho ou use replaceAll`,
      );
    }
    const next = replaceAll
      ? current.split(input.oldString).join(input.newString)
      : current.replace(input.oldString, input.newString);
    await fs.writeFile(abs, next, "utf8");
    return {
      path: input.path,
      replacements: replaceAll ? occurrences : 1,
    };
  },
};

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count += 1;
    idx += needle.length;
  }
  return count;
}
