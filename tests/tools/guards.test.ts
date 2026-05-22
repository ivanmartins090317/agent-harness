import { describe, expect, it } from "vitest";
import { PathOutsideProjectError, resolveSafePath } from "../../src/tools/guards.js";

describe("resolveSafePath", () => {
  const project = process.platform === "win32" ? "C:\\proj" : "/proj";

  it("resolve caminhos relativos dentro do project", () => {
    const out = resolveSafePath(project, "src/a.ts");
    expect(out.startsWith(project)).toBe(true);
  });

  it("rejeita ..", () => {
    expect(() => resolveSafePath(project, "../fora.ts")).toThrow(PathOutsideProjectError);
  });

  it("rejeita absoluto fora do project", () => {
    const outside = process.platform === "win32" ? "C:\\outro\\x.ts" : "/outro/x.ts";
    expect(() => resolveSafePath(project, outside)).toThrow(PathOutsideProjectError);
  });

  it("aceita absoluto dentro do project", () => {
    const inside =
      process.platform === "win32" ? "C:\\proj\\src\\x.ts" : "/proj/src/x.ts";
    const out = resolveSafePath(project, inside);
    expect(out).toBe(inside);
  });
});
