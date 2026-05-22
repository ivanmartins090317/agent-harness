import { execa } from "execa";
import { join } from "node:path";
import type { ValidationCheckResult, ValidationReport } from "../engine/types.js";
import { pathExists, readJson } from "../utils/fs.js";

interface PackageJsonShape {
  scripts?: Record<string, string>;
}

const CHECKS: { name: string; script: string }[] = [
  { name: "lint", script: "lint" },
  { name: "test", script: "test" },
  { name: "build", script: "build" },
];

export interface ValidatorOptions {
  projectPath: string;
  timeoutMs?: number;
}

export async function runValidation(opts: ValidatorOptions): Promise<ValidationReport> {
  const pkgPath = join(opts.projectPath, "package.json");
  const hasPkg = await pathExists(pkgPath);
  if (!hasPkg) {
    return {
      ok: true,
      checks: CHECKS.map((c) => ({
        name: c.name,
        ran: false,
        ok: true,
        durationMs: 0,
        skippedReason: "package.json não encontrado",
      })),
    };
  }

  const pkg = await readJson<PackageJsonShape>(pkgPath);
  const scripts = pkg.scripts ?? {};
  const results: ValidationCheckResult[] = [];

  for (const check of CHECKS) {
    if (!scripts[check.script]) {
      results.push({
        name: check.name,
        ran: false,
        ok: true,
        durationMs: 0,
        skippedReason: `script "${check.script}" não definido em package.json`,
      });
      continue;
    }
    results.push(await runScript(opts.projectPath, check.name, check.script, opts.timeoutMs));
  }

  return { ok: results.every((r) => r.ok), checks: results };
}

async function runScript(
  cwd: string,
  name: string,
  script: string,
  timeoutMs?: number,
): Promise<ValidationCheckResult> {
  const start = Date.now();
  const result = await execa("npm", ["run", "--silent", script], {
    cwd,
    reject: false,
    timeout: timeoutMs,
    env: process.env,
  });
  const durationMs = Date.now() - start;
  const exitCode = typeof result.exitCode === "number" ? result.exitCode : -1;
  return {
    name,
    ran: true,
    ok: exitCode === 0,
    durationMs,
    exitCode,
    stdout: tail(result.stdout?.toString() ?? "", 4000),
    stderr: tail(result.stderr?.toString() ?? "", 4000),
  };
}

function tail(str: string, max: number): string {
  if (str.length <= max) return str;
  return `...[truncado ${str.length - max} chars]\n${str.slice(-max)}`;
}
