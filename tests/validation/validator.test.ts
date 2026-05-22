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

describe("validator", () => {
  it("retorna ok quando não há package.json", async () => {
    const rep = await runValidation({ projectPath: proj.path });
    expect(rep.ok).toBe(true);
    expect(rep.checks.every((c) => !c.ran)).toBe(true);
  });

  it("pula scripts ausentes", async () => {
    await writeFileEnsured(
      `${proj.path}/package.json`,
      JSON.stringify({ name: "x", scripts: {} }),
    );
    const rep = await runValidation({ projectPath: proj.path });
    expect(rep.ok).toBe(true);
    for (const c of rep.checks) {
      expect(c.ran).toBe(false);
      expect(c.skippedReason).toBeDefined();
    }
  });
});
