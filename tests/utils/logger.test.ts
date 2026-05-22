import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../../src/utils/logger.js";

describe("logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    delete process.env.AGENT_DEBUG;
  });

  it("info/warn/error escrevem na saída esperada", () => {
    const logger = createLogger("test");
    logger.info("oi", { a: 1 });
    logger.warn("aviso");
    logger.error("erro");
    expect(logSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("child gera escopo aninhado", () => {
    const logger = createLogger("a").child("b");
    logger.info("x");
    const call = logSpy.mock.calls[0]?.[0] as string;
    expect(call).toMatch(/\[a:b\]/);
  });

  it("debug só loga quando AGENT_DEBUG está setado", () => {
    const logger = createLogger("d");
    logger.debug("escondido");
    expect(logSpy).not.toHaveBeenCalled();
    process.env.AGENT_DEBUG = "1";
    logger.debug("agora vai");
    expect(logSpy).toHaveBeenCalled();
  });
});
