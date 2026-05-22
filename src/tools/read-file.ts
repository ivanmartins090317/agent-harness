import { promises as fs } from "node:fs";
import { z } from "zod";
import type { Tool } from "./types.js";
import { resolveSafePath } from "./guards.js";

const inputSchema = z.object({
  path: z.string().describe("Caminho do arquivo relativo ao project_path"),
  maxBytes: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Limite opcional de bytes a ler"),
});

type ReadFileInput = z.infer<typeof inputSchema>;

interface ReadFileOutput {
  path: string;
  bytes: number;
  truncated: boolean;
  content: string;
}

export const readFileTool: Tool<ReadFileInput, ReadFileOutput> = {
  name: "read_file",
  description: "Lê o conteúdo de um arquivo dentro do project_path em UTF-8.",
  dangerous: false,
  schema: inputSchema,
  async run(input, ctx) {
    const abs = resolveSafePath(ctx.projectPath, input.path);
    const buf = await fs.readFile(abs);
    const limit = input.maxBytes ?? buf.byteLength;
    const truncated = buf.byteLength > limit;
    const slice = truncated ? buf.subarray(0, limit) : buf;
    return {
      path: input.path,
      bytes: buf.byteLength,
      truncated,
      content: slice.toString("utf8"),
    };
  },
};
