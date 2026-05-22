import type { ZodTypeAny } from "zod";
import type { Tool, ToolContext, ToolDescriptor, ToolInvocationResult } from "./types.js";

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register<I, O>(tool: Tool<I, O>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool já registrada: ${tool.name}`);
    }
    this.tools.set(tool.name, tool as unknown as Tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  describe(): ToolDescriptor[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      dangerous: tool.dangerous,
      inputSchema: zodToJsonSchema(tool.schema as ZodTypeAny),
    }));
  }

  async invoke(
    name: string,
    input: unknown,
    ctx: ToolContext,
  ): Promise<ToolInvocationResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, error: `Tool não encontrada: ${name}` };
    }
    const parsed = tool.schema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Input inválido para ${name}: ${parsed.error.message}`,
      };
    }
    try {
      const output = await tool.run(parsed.data, ctx);
      return { ok: true, output };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }
}

function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const def = (schema as { _def?: { typeName?: string } })._def;
  const typeName = def?.typeName;
  if (typeName === "ZodObject") {
    const shape = (schema as unknown as { shape: Record<string, ZodTypeAny> }).shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodFieldToJsonSchema(value);
      if (!isOptional(value)) required.push(key);
    }
    return { type: "object", properties, required };
  }
  return { type: "object", properties: {} };
}

function zodFieldToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const def = (schema as { _def?: { typeName?: string; innerType?: ZodTypeAny } })
    ._def;
  if (def?.typeName === "ZodOptional" && def.innerType) {
    return zodFieldToJsonSchema(def.innerType);
  }
  if (def?.typeName === "ZodDefault" && def.innerType) {
    return zodFieldToJsonSchema(def.innerType);
  }
  switch (def?.typeName) {
    case "ZodString":
      return { type: "string", description: schema.description };
    case "ZodNumber":
      return { type: "number", description: schema.description };
    case "ZodBoolean":
      return { type: "boolean", description: schema.description };
    case "ZodArray":
      return { type: "array", description: schema.description };
    default:
      return { description: schema.description ?? undefined };
  }
}

function isOptional(schema: ZodTypeAny): boolean {
  const def = (schema as { _def?: { typeName?: string } })._def;
  return def?.typeName === "ZodOptional" || def?.typeName === "ZodDefault";
}
