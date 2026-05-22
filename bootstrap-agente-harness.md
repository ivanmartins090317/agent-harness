Você é um desenvolvedor sênior.
Quero criar um projeto chamado agent-harness que implementa um harness simples para trabalhar sobre um repositório de código externo.

Requisitos de alto nível:

Linguagem: TypeScript.

O harness roda separado do projeto alvo e recebe um project_path apontando para o repositório onde as tarefas serão executadas.

Modelo: Opus, focado em gerar Tech Design Docs e planejar tarefas complexas, para realizar tarefas pode usar Gemini 3.1 ou Gemini 2.5 Flash

Ferramentas mínimas:
ler arquivo

escrever arquivo

editar arquivo

buscar texto em arquivos

rodar comandos de terminal (ex: testes, lint)

ler git status e git diff

Memória: manter estado e decisões em pastas locais dentro do projeto alvo, como ai/state/ e ai/implementation/, usando arquivos Markdown ou JSON.

Validação: rodar testes/lint/build via ferramenta de terminal, e registrar o resultado em ai/results/success/ ou ai/results/error/.

Primeiro tipo de tarefa suportada: execução de tarefas guiadas por Tech Design Docs (TDD = Tech Design Doc).

Crie:

uma estrutura de pastas inicial do harness;

arquivos base (código e configuração) para: engine/loop, registry de ferramentas, camada de memória, e um ponto de entrada CLI que receba project_path e uma task_id ou descrição de tarefa.

use uma arquitetura simples mas bem organizada.
Explique o que está criando antes de gerar o código.
