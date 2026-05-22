import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runTerminalTool } from "../../src/tools/run-terminal.js";
import type { ToolContext } from "../../src/tools/types.js";
import { makeTmpProject, silentLogger, type TmpProject } from "../helpers/tmp.js";

let proj: TmpProject;

function ctx(): ToolContext {
  return {
    projectPath: proj.path,
    taskId: "t1",
    logger: silentLogger(),
  };
}

beforeEach(() => {
  proj = makeTmpProject();
});

afterEach(async () => {
  await proj.dispose();
});

describe("run_terminal", () => {
  it("executa comando node e captura stdout", async () => {
    const out = await runTerminalTool.run(
      {
        command: process.execPath,
        args: ["-e", "console.log('hello-harness')"],
      },
      ctx(),
    );
    expect(out.exitCode).toBe(0);
    expect(out.stdout).toMatch(/hello-harness/);
    expect(out.timedOut).toBe(false);
  });

  it("retorna exitCode != 0 em falha", async () => {
    const out = await runTerminalTool.run(
      {
        command: process.execPath,
        args: ["-e", "process.exit(2)"],
      },
      ctx(),
    );
    expect(out.exitCode).toBe(2);
  });

  it("rejeita cwd com ..", async () => {
    await expect(
      runTerminalTool.run(
        { command: process.execPath, args: ["-e", "1"], cwd: "../fora" },
        ctx(),
      ),
    ).rejects.toThrow();
  });
});
