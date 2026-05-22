# agent-harness

Harness em TypeScript para executar tarefas guiadas por **Tech Design Docs (TDD)** sobre um repositório alvo. Rodando externo ao projeto, o harness recebe um `project_path`, lê o TDD da tarefa, dispara um loop de agente usando Claude Opus, executa ferramentas (read/write/edit/search/terminal/git) com **confirmação humana para ações perigosas** e registra estado, decisões e resultados de validação dentro de `ai/` no projeto alvo.

## Requisitos

- Node.js 20+
- `npm` 10+
- Chave da API Anthropic (`ANTHROPIC_API_KEY`)

## Instalação

```bash
npm install
cp .env.example .env
# edite .env e preencha ANTHROPIC_API_KEY
npm run build
```

## Variáveis de ambiente

| Variável | Default | Descrição |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Obrigatória para executar `run` |
| `AGENT_PLAN_MODEL` | `claude-opus-4-20250514` | Modelo usado na fase de planejamento (1ª chamada) |
| `AGENT_EXEC_MODEL` | `claude-opus-4-20250514` | Modelo usado na fase de execução (passos seguintes) |
| `AGENT_MAX_STEPS` | `30` | Limite de iterações do loop |
| `AGENT_TERMINAL_TIMEOUT_MS` | `120000` | Timeout para comandos `run_terminal` |
| `AGENT_DEBUG` | — | Quando setado, ativa logs `debug` |

## CLI

### `run` — executa uma tarefa

```bash
node dist/index.js run \
  --project /caminho/abs/para/repo-alvo \
  --task minha-task-id \
  [--yes] [--skip-validation] [--max-steps 30]
```

- `--yes`: auto-aprova ferramentas perigosas (CI/uso não interativo).
- `--skip-validation`: pula a etapa de `npm run test/lint/build` ao final.
- `--max-steps`: sobrescreve `AGENT_MAX_STEPS`.

### `validate` — só validação

```bash
node dist/index.js validate --project /caminho/abs --task minha-task-id
```

Roda apenas as etapas de validação e grava resultado em `ai/results/{success|error}`.

## Convenção de arquivos no projeto alvo

Tudo vive sob `\<project_path\>/ai/`:

```
ai/
├─ tdd/<task_id>.md                       # entrada: Tech Design Doc
├─ state/<task_id>.json                   # estado e decisões do agente
├─ implementation/<task_id>/notes.md      # notas incrementais de execução
└─ results/
   ├─ success/<task_id>-<timestamp>.json
   └─ error/<task_id>-<timestamp>.json
```

### Exemplo de TDD (`ai/tdd/refatorar-login.md`)

```markdown
# Refatorar autenticação para usar JWT

## Contexto
Hoje usamos sessão em memória...

## Mudanças propostas
1. Adicionar dependência `jsonwebtoken`.
2. Substituir middleware...

## Critérios de aceite
- `npm test` passando
- `npm run lint` sem warnings
```

## Ferramentas disponíveis ao agente

| Tool | Perigosa? | Descrição |
|---|---|---|
| `read_file` | não | Lê arquivo UTF-8 dentro do project_path |
| `search_text` | não | Busca regex em arquivos do project_path |
| `git_status` | não | `git status --porcelain` |
| `git_diff` | não | `git diff` (opcionalmente `--cached`) |
| `write_file` | **sim** | Cria/sobrescreve arquivo |
| `edit_file` | **sim** | Substituição exata (oldString → newString) |
| `run_terminal` | **sim** | Executa comando no terminal com cwd dentro do project |

Ferramentas marcadas como perigosas **pedem confirmação humana via terminal** antes de cada execução. Em ambientes não interativos (CI), use `--yes` ou configure o pipeline.

## Arquitetura

```
src/
├─ index.ts            # CLI entrypoint
├─ cli/                # comandos, parser, prompt de confirmação
├─ engine/             # loop principal, router, system prompt, tipos
├─ providers/          # LLMProvider, AnthropicProvider, Gemini stub
├─ tools/              # registry + tools (read/write/edit/search/terminal/git)
├─ memory/             # tdd-loader, state, implementation, results, paths
├─ validation/         # validator.ts (npm test/lint/build)
├─ config/             # carregamento de .env
└─ utils/              # logger, fs helpers
```

Pontos chave:

- **LLMProvider** é uma interface neutra. Hoje há a implementação `anthropic` (Claude Opus) e um stub `gemini` plugável. O `Router` escolhe o provider por fase (`plan` no 1º step, `exec` nos demais) — atualmente ambos apontam para Anthropic.
- **ToolRegistry** valida entrada via `zod`, expõe descritores JSON-Schema para o modelo e centraliza a flag `dangerous`.
- **Memória** persiste decisões em `ai/state/<task_id>.json` e notas em `ai/implementation/<task_id>/notes.md` a cada step.
- **Validação** detecta scripts de `npm` disponíveis (test/lint/build) e roda apenas os existentes via `execa`.

## Desenvolvimento

```bash
npm run dev -- run --project /tmp/repo --task t1   # tsx em modo dev
npm test                                            # vitest
npm run test:coverage                               # cobertura v8
npm run lint                                        # eslint
npm run typecheck                                   # tsc --noEmit
```

## Limitações conhecidas e próximos passos

- Provider Gemini ainda é stub. A interface está pronta para uma implementação real (Google GenAI SDK) sem alterar o engine.
- Sem isolamento de processo / sandbox: o `run_terminal` herda o ambiente do processo pai. Para uso em CI multi-tenant, considere encapsular em container.
- Sem `--watch`: cada invocação processa um TDD e termina. Multiplas tarefas podem ser orquestradas externamente (ex.: GitHub Actions ou um script shell).
