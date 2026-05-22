import { execa } from "execa";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gitDiffTool } from "../../src/tools/git-diff.js";
import { gitStatusTool } from "../../src/tools/git-status.js";
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

beforeEach(async () => {
  proj = makeTmpProject();
  await execa("git", ["init", "-q"], { cwd: proj.path });
  await execa("git", ["config", "user.email", "test@test.dev"], { cwd: proj.path });
  await execa("git", ["config", "user.name", "test"], { cwd: proj.path });
  await execa("git", ["config", "commit.gpgsign", "false"], { cwd: proj.path });
});

afterEach(async () => {
  await proj.dispose();
});

describe("git tools", () => {
  it("git_status retorna clean em repo vazio", async () => {
    const out = await gitStatusTool.run({}, ctx());
    expect(out.clean).toBe(true);
    expect(out.entries).toEqual([]);
  });

  it("git_status detecta arquivo não rastreado", async () => {
    await fs.writeFile(join(proj.path, "novo.txt"), "x", "utf8");
    const out = await gitStatusTool.run({}, ctx());
    expect(out.clean).toBe(false);
    expect(out.entries.some((e) => e.path === "novo.txt")).toBe(true);
  });

  it("git_diff retorna empty quando não há mudanças", async () => {
    const out = await gitDiffTool.run({}, ctx());
    expect(out.empty).toBe(true);
  });

  it("git_diff captura modificações", async () => {
    const file = join(proj.path, "a.txt");
    await fs.writeFile(file, "v1\n", "utf8");
    await execa("git", ["add", "."], { cwd: proj.path });
    await execa("git", ["commit", "-q", "-m", "init"], { cwd: proj.path });
    await fs.writeFile(file, "v2\n", "utf8");
    const out = await gitDiffTool.run({}, ctx());
    expect(out.empty).toBe(false);
    expect(out.diff).toMatch(/v2/);
  });
});
