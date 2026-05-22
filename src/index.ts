import { buildProgram } from "./cli/args.js";
import { runCommand, validateCommand } from "./cli/commands.js";
import { createLogger } from "./utils/logger.js";

async function main(): Promise<void> {
  const program = buildProgram();
  const logger = createLogger("cli");

  program
    .commands.find((c) => c.name() === "run")
    ?.action(async (opts) => {
      const code = await runCommand({
        project: opts.project,
        task: opts.task,
        yes: Boolean(opts.yes),
        maxSteps: opts.maxSteps,
        skipValidation: Boolean(opts.skipValidation),
      });
      process.exit(code);
    });

  program
    .commands.find((c) => c.name() === "validate")
    ?.action(async (opts) => {
      const code = await validateCommand({
        project: opts.project,
        task: opts.task,
      });
      process.exit(code);
    });

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Erro fatal: ${msg}`);
    process.exit(1);
  }
}

void main();
