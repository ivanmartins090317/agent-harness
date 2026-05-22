import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "../../src/tools/registry.js";
import type { Tool, ToolContext } from "../../src/tools/types.js";
import { silentLogger } from "../helpers/tmp.js";

const echoTool: Tool<{ msg: string }, { echoed: string }> = {
  name: "echo",
  description: "echo msg",
  dangerous: false,
  schema: z.object({ msg: z.string() }),
  async run(input) {
    return { echoed: input.msg };
  },
};

function ctx(): ToolContext {
  return {
    projectPath: process.cwd(),
    taskId: "t1",
    logger: silentLogger(),
  };
}

describe("ToolRegistry", () => {
  it("registra e invoca uma tool", async () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    const res = await reg.invoke("echo", { msg: "oi" }, ctx());
    expect(res.ok).toBe(true);
    expect(res.output).toEqual({ echoed: "oi" });
  });

  it("retorna erro quando schema inválido", async () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    const res = await reg.invoke("echo", { msg: 42 }, ctx());
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Input inválido/);
  });

  it("retorna erro quando tool não existe", async () => {
    const reg = new ToolRegistry();
    const res = await reg.invoke("nope", {}, ctx());
    expect(res.ok).toBe(false);
  });

  it("describe gera descritores com schema", () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    const desc = reg.describe();
    expect(desc).toHaveLength(1);
    expect(desc[0]?.name).toBe("echo");
    expect(desc[0]?.inputSchema).toMatchObject({ type: "object" });
  });

  it("rejeita registro duplicado", () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    expect(() => reg.register(echoTool)).toThrow();
  });
});
