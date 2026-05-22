import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeFileEnsured } from "../../src/utils/fs.js";
import { runValidation } from "../../src/validation/validator.js";
import { makeTmpProject, type TmpProject } from "../helpers/tmp.js";

let proj: TmpProject;

beforeEach(() => {
  proj = makeTmpProject();
});

afterEach(async () => {
  await proj.dispose();
});

describe("validator com scripts reais", () => {
  it("roda scripts ok e relata sucesso", async () => {
    await writeFileEnsured(
      `${proj.path}/package.json`,
      JSON.stringify({
        name: "tmp",
        scripts: {
          lint: 'node -e "console.log(\\"lint-ok\\")"',
          test: 'node -e "console.log(\\"test-ok\\")"',
        },
      }),
    );
    const rep = await runValidation({ projectPath: proj.path });
    expect(rep.ok).toBe(true);
    const lint = rep.checks.find((c) => c.name === "lint");
    expect(lint?.ran).toBe(true);
    expect(lint?.ok).toBe(true);
  }, 30_000);

  it("relata falha quando script retorna != 0", async () => {
    await writeFileEnsured(
      `${proj.path}/package.json`,
      JSON.stringify({
        name: "tmp",
        scripts: {
          test: "node -e \"process.exit(3)\"",
        },
      }),
    );
    const rep = await runValidation({ projectPath: proj.path });
    expect(rep.ok).toBe(false);
    const t = rep.checks.find((c) => c.name === "test");
    expect(t?.ok).toBe(false);
  }, 30_000);
});
