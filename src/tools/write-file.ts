import { z } from "zod";
import type { Tool } from "./types.js";
import { resolveSafePath } from "./guards.js";
import { writeFileEnsured } from "../utils/fs.js";

const inputSchema = z.object({
  path: z.string().describe("Caminho do arquivo relativo ao project_path"),
  content: z.string().describe("Conteúdo completo a ser gravado (UTF-8)"),
});

type WriteFileInput = z.infer<typeof inputSchema>;

interface WriteFileOutput {
  path: string;
  bytes: number;
}

export const writeFileTool: Tool<WriteFileInput, WriteFileOutput> = {
  name: "write_file",
  description:
    "Cria ou sobrescreve um arquivo dentro do project_path com o conteúdo fornecido.",
  dangerous: true,
  schema: inputSchema,
  async run(input, ctx) {
    const abs = resolveSafePath(ctx.projectPath, input.path);
    await writeFileEnsured(abs, input.content);
    return {
      path: input.path,
      bytes: Buffer.byteLength(input.content, "utf8"),
    };
  },
};
