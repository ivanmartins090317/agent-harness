import pc from "picocolors";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface Logger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  child: (scope: string) => Logger;
}

function format(scope: string, msg: string, meta?: Record<string, unknown>): string {
  const base = scope ? `[${scope}] ${msg}` : msg;
  if (!meta || Object.keys(meta).length === 0) return base;
  return `${base} ${JSON.stringify(meta)}`;
}

export function createLogger(scope = "harness"): Logger {
  return {
    info: (msg, meta) => console.log(pc.cyan(format(scope, msg, meta))),
    warn: (msg, meta) => console.warn(pc.yellow(format(scope, msg, meta))),
    error: (msg, meta) => console.error(pc.red(format(scope, msg, meta))),
    debug: (msg, meta) => {
      if (process.env.AGENT_DEBUG) console.log(pc.gray(format(scope, msg, meta)));
    },
    child: (childScope: string) => createLogger(`${scope}:${childScope}`),
  };
}
