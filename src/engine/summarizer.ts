import type { Router } from "./router.js";
import type {
  ContentBlock,
  LLMResponse,
  StateEvent,
  TextBlock,
} from "./types.js";
import type { Logger } from "../utils/logger.js";

/**
 * Gera um resumo curto, em pt-BR, do que aconteceu numa execução anterior do
 * agente (lido do event log `ai/state/<taskId>.jsonl`).
 *
 * O resumo é injetado nas mensagens iniciais do loop para dar contexto ao
 * modelo sem precisar replayar todos os eventos — útil em retomadas.
 *
 * Estratégia:
 *  - 0 eventos: string vazia (sem custo).
 *  - <= MIN_EVENTS_FOR_LLM: resumo determinístico (barato, sem LLM).
 *  - acima disso: pede um resumo ao provider de plano (Opus) via Router.
 *  - Qualquer falha do LLM cai no resumo determinístico.
 */

// Limites — ajustáveis. TODO: extrair para config de ambiente se necessário.
const MIN_EVENTS_FOR_LLM = 3;
const MAX_EVENTS_FOR_LLM = 200; // janela: últimos N eventos passados ao modelo
const MAX_EVENT_CONTENT_CHARS = 500; // truncamento de input/output/message
const SUMMARY_MAX_TOKENS = 600; // teto de tokens do resumo

const SUMMARY_SYSTEM_PROMPT = `Você resume logs de sessões de um agente de engenharia de software.
Receberá um conjunto de eventos JSON da execução anterior e deve produzir um
resumo curto em português (pt-BR), em no máximo ~10 linhas, destacando:

1. Arquivos tocados (lidos, escritos ou editados) — agrupe por caminho.
2. Decisões importantes do agente (planos, hipóteses, ajustes de rumo).
3. Status de testes/lint/build (sucesso, falha, mensagens-chave de erro).
4. Estado em que a sessão parou (concluiu, atingiu max_steps, erro).

Seja objetivo, sem floreios, em tópicos. Não invente informação.`;

export async function summarizePreviousEvents(
  events: StateEvent[],
  router: Router,
  logger: Logger,
): Promise<string> {
  if (events.length === 0) return "";
  if (events.length < MIN_EVENTS_FOR_LLM) {
    return wrapAsContext(deterministicSummary(events));
  }

  try {
    const llmSummary = await callLlmSummary(events, router, logger);
    if (llmSummary.trim()) return wrapAsContext(llmSummary);
    logger.warn("Resumo LLM veio vazio, usando fallback determinístico");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Falha ao gerar resumo via LLM, usando fallback: ${message}`);
  }

  return wrapAsContext(deterministicSummary(events));
}

function wrapAsContext(body: string): string {
  return `Histórico resumido da sessão anterior (não-autoritativo):\n\n${body.trim()}`;
}

function deterministicSummary(events: StateEvent[]): string {
  const last = events[events.length - 1];
  const counts = events.reduce<Record<string, number>>((acc, evt) => {
    acc[evt.type] = (acc[evt.type] ?? 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(counts)
    .map(([type, n]) => `${type}=${n}`)
    .join(", ");
  return `- eventos: ${summary}\n- último step: ${last.step} (${last.type})`;
}

async function callLlmSummary(
  events: StateEvent[],
  router: Router,
  logger: Logger,
): Promise<string> {
  const provider = router.pick("plan");
  const slice = events.slice(-MAX_EVENTS_FOR_LLM);
  const userText = buildSummaryUserPrompt(slice);

  logger.info(
    `Gerando resumo via ${provider.name} (eventos=${slice.length}/${events.length})`,
  );

  const response: LLMResponse = await provider.generate({
    system: SUMMARY_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: [{ type: "text", text: userText }] },
    ],
    tools: [],
    phase: "plan",
    maxTokens: SUMMARY_MAX_TOKENS,
  });

  return extractText(response.content);
}

function buildSummaryUserPrompt(events: StateEvent[]): string {
  const lines = events.map((evt) => JSON.stringify(compactEvent(evt)));
  return [
    "Eventos da sessão anterior (JSONL, mais recentes ao final):",
    "```jsonl",
    ...lines,
    "```",
    "",
    "Produza o resumo conforme as instruções do system prompt.",
  ].join("\n");
}

function compactEvent(evt: StateEvent): StateEvent {
  return {
    ...evt,
    input: truncateField(evt.input),
    output: truncateField(evt.output),
    message: typeof evt.message === "string" ? truncate(evt.message) : evt.message,
  };
}

function truncateField(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return truncate(value);
  try {
    const json = JSON.stringify(value);
    if (json.length <= MAX_EVENT_CONTENT_CHARS) return value;
    return `${json.slice(0, MAX_EVENT_CONTENT_CHARS)}…(truncado)`;
  } catch {
    return "[unserializable]";
  }
}

function truncate(text: string): string {
  if (text.length <= MAX_EVENT_CONTENT_CHARS) return text;
  return `${text.slice(0, MAX_EVENT_CONTENT_CHARS)}…(truncado)`;
}

function extractText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
