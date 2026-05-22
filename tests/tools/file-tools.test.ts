import { promises as fs } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editFileTool } from "../../src/tools/edit-file.js";
import { readFileTool } from "../../src/tools/read-file.js";
import { searchTextTool } from "../../src/tools/search-text.js";
import type { ToolContext } from "../../src/tools/types.js";
import { writeFileTool } from "../../src/tools/write-file.js";
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

describe("file tools", () => {
  it("write_file cria arquivo dentro do project", async () => {
    const out = await writeFileTool.run({ path: "a.txt", content: "olá" }, ctx());
    expect(out.bytes).toBeGreaterThan(0);
    const content = await fs.readFile(join(proj.path, "a.txt"), "utf8");
    expect(content).toBe("olá");
  });

  it("read_file lê conteúdo", async () => {
    await fs.writeFile(join(proj.path, "b.txt"), "hello world", "utf8");
    const out = await readFileTool.run({ path: "b.txt" }, ctx());
    expect(out.content).toBe("hello world");
    expect(out.truncated).toBe(false);
  });

  it("edit_file substitui trecho único", async () => {
    await fs.writeFile(join(proj.path, "c.txt"), "alpha BETA gamma", "utf8");
    const out = await editFileTool.run(
      { path: "c.txt", oldString: "BETA", newString: "beta" },
      ctx(),
    );
    expect(out.replacements).toBe(1);
    const content = await fs.readFile(join(proj.path, "c.txt"), "utf8");
    expect(content).toBe("alpha beta gamma");
  });

  it("edit_file falha quando trecho aparece múltiplas vezes sem replaceAll", async () => {
    await fs.writeFile(join(proj.path, "d.txt"), "x x x", "utf8");
    await expect(
      editFileTool.run({ path: "d.txt", oldString: "x", newString: "y" }, ctx()),
    ).rejects.toThrow(/3 vezes/);
  });

  it("edit_file aplica replaceAll", async () => {
    await fs.writeFile(join(proj.path, "e.txt"), "x x x", "utf8");
    const out = await editFileTool.run(
      { path: "e.txt", oldString: "x", newString: "y", replaceAll: true },
      ctx(),
    );
    expect(out.replacements).toBe(3);
    expect(await fs.readFile(join(proj.path, "e.txt"), "utf8")).toBe("y y y");
  });

  it("search_text encontra ocorrências", async () => {
    await fs.mkdir(join(proj.path, "src"), { recursive: true });
    await fs.writeFile(
      join(proj.path, "src", "f.ts"),
      "const foo = 1;\nconst bar = 2;",
      "utf8",
    );
    const out = await searchTextTool.run({ pattern: "foo" }, ctx());
    expect(out.totalMatches).toBe(1);
    expect(out.matches[0]?.line).toBe(1);
  });

  it("rejeita caminhos fora do project", async () => {
    await expect(
      writeFileTool.run({ path: "../oops.txt", content: "x" }, ctx()),
    ).rejects.toThrow();
  });
});
