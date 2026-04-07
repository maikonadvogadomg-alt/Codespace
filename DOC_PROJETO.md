# CodeLens — Documentação Completa do Projeto

> Editor de código pessoal com inteligência artificial, terminal integrado e integração com GitHub.

---

## Índice (clique para ir direto à seção)

1. [Visão Geral](#visao-geral)
2. [Telas do Sistema](#telas-do-sistema)
   - [Tela Inicial (Dashboard)](#tela-inicial-dashboard)
   - [Explorador de Projeto (IDE)](#explorador-de-projeto-ide)
   - [Configurações](#configuracoes)
3. [Funcionalidades Principais](#funcionalidades-principais)
   - [Criar Projetos](#criar-projetos)
   - [Editar Código](#editar-codigo)
   - [Terminal Integrado](#terminal-integrado)
   - [Assistente de IA](#assistente-de-ia)
   - [Preview ao Vivo](#preview-ao-vivo)
   - [GitHub (Importar e Exportar)](#github-importar-e-exportar)
   - [Multi-Perfis de Configuração](#multi-perfis-de-configuracao)
4. [Estrutura de Pastas e Arquivos](#estrutura-de-pastas-e-arquivos)
   - [Pasta artifacts/code-editor (Frontend)](#pasta-artifactscode-editor-frontend)
   - [Pasta artifacts/api-server (Backend)](#pasta-artifactsapi-server-backend)
   - [Pasta lib (Bibliotecas Compartilhadas)](#pasta-lib-bibliotecas-compartilhadas)
5. [Rotas da API (Backend)](#rotas-da-api-backend)
6. [Banco de Dados](#banco-de-dados)
7. [Problemas Conhecidos](#problemas-conhecidos)

---

<a id="visao-geral"></a>
## 1. Visão Geral

O **CodeLens** é um editor de código que roda no navegador, parecido com o VS Code. Ele permite que você:

- **Crie projetos** a partir de templates prontos (HTML, Node.js, React, Express) ou importando do GitHub
- **Edite código** com cores de sintaxe (as palavras do código ficam coloridas para facilitar a leitura)
- **Rode comandos** no terminal integrado (como `npm install`, `node app.js`)
- **Peça ajuda para a IA** — ela analisa seu código, sugere melhorias e até cria arquivos novos
- **Visualize o resultado** do seu projeto ao vivo, sem precisar abrir outra janela
- **Envie para o GitHub** — salva seu projeto online para não perder

O sistema tem duas partes:
- **Frontend** (a parte visual que você vê no navegador) — feito com React
- **Backend** (o "motor" que roda por trás) — feito com Express/Node.js

Os dois se comunicam pela internet. O frontend manda pedidos, o backend responde com dados.

---

<a id="telas-do-sistema"></a>
## 2. Telas do Sistema

<a id="tela-inicial-dashboard"></a>
### Tela Inicial (Dashboard)

**Endereço:** `/` (página principal)

Esta é a primeira tela que aparece quando você abre o CodeLens. Aqui você vê:

- **Lista de todos os seus projetos** — cada projeto mostra o nome, quando foi criado, quantos arquivos tem e o tamanho
- **Botão para criar novo projeto** — abre opções:
  - Criar do zero (em branco)
  - Usar um template pronto (HTML/CSS/JS, Node.js, Express, React+Vite)
  - Importar do GitHub (colando o link do repositório)
  - Subir um arquivo ZIP do seu computador (até 250MB)
- **Botão para apagar projeto** — pede confirmação antes de apagar

<a id="explorador-de-projeto-ide"></a>
### Explorador de Projeto (IDE)

**Endereço:** `/projects/:id` (onde `:id` é o número do projeto)

Esta é a tela principal de trabalho. Ela é dividida em painéis:

- **Painel esquerdo — Arquivos:** Mostra todas as pastas e arquivos do projeto, como no Windows Explorer. Você pode:
  - Criar arquivo ou pasta nova
  - Renomear
  - Copiar
  - Apagar
  - Navegar entre pastas

- **Painel central — Editor de Código:** Onde você escreve o código. Tem:
  - Cores de sintaxe (cada tipo de palavra tem uma cor diferente)
  - Botões de voltar/avançar (como no navegador)
  - Salvamento automático

- **Painel inferior — Terminal:** Funciona como o Prompt de Comando do Windows. Você digita comandos e vê o resultado na hora. Exemplos:
  - `npm install` — instala as dependências do projeto
  - `node app.js` — roda o programa
  - `npm run dev` — inicia o servidor de desenvolvimento

- **Painel direito — IA:** Um chat onde você conversa com a inteligência artificial sobre o código. Ela pode:
  - Explicar o que um arquivo faz
  - Sugerir correções
  - Criar arquivos novos
  - Rodar comandos

- **Painel de Preview:** Mostra o resultado visual do seu projeto (se for um site, por exemplo)

- **Painel de Pacotes:** Mostra as bibliotecas que o projeto usa e os scripts disponíveis

<a id="configuracoes"></a>
### Configurações

**Endereço:** `/settings`

Aqui você configura:

- **Chave de API da IA** — a senha que permite usar a inteligência artificial (Gemini, OpenAI, Anthropic, etc.)
- **Modelo da IA** — qual versão usar (pode deixar em "Automático")
- **Token do GitHub** — a senha para enviar projetos ao GitHub
- **Perfis** — você pode ter até 3 configurações diferentes e trocar entre elas
- **Botão de resetar** — limpa todas as configurações de um perfil

---

<a id="funcionalidades-principais"></a>
## 3. Funcionalidades Principais

<a id="criar-projetos"></a>
### Criar Projetos

Você tem 4 formas de criar um projeto:

| Método | O que faz |
|--------|-----------|
| **Template** | Cria um projeto pronto com arquivos básicos. Opções: HTML puro, Node.js, Express, React |
| **GitHub** | Cola o link de um repositório do GitHub e ele baixa todo o código |
| **ZIP** | Sobe um arquivo .zip do seu computador com o projeto dentro |
| **Em branco** | Cria um projeto vazio para você começar do zero |

<a id="editar-codigo"></a>
### Editar Código

O editor tem cores de sintaxe para mais de 20 linguagens (JavaScript, Python, HTML, CSS, TypeScript, etc.). Quando você edita um arquivo, ele salva automaticamente no banco de dados.

<a id="terminal-integrado"></a>
### Terminal Integrado

O terminal roda comandos de verdade no servidor. Ele:
- Mostra a saída em tempo real (você vê o resultado aparecendo linha por linha)
- Detecta quando um servidor web é iniciado (ex: "Rodando na porta 3000")
- Permite abrir o preview automaticamente

<a id="assistente-de-ia"></a>
### Assistente de IA

O chat de IA é o diferencial do CodeLens. Ele:
- **Entende o contexto** — envia o arquivo aberto ou a estrutura do projeto para a IA
- **Cria arquivos** — a IA pode gerar código e salvar diretamente no projeto
- **Edita arquivos** — pode modificar arquivos existentes
- **Apaga arquivos** — pode remover arquivos desnecessários
- **Sugere comandos** — pode executar comandos no terminal

Provedores de IA suportados:
- Google Gemini
- OpenAI (ChatGPT)
- Anthropic (Claude)
- Groq
- Perplexity
- xAI (Grok)
- OpenRouter

A detecção é automática — basta colar sua chave de API e o sistema identifica qual provedor é.

<a id="preview-ao-vivo"></a>
### Preview ao Vivo

Quando seu projeto é um site, o CodeLens mostra o resultado visual em tempo real. Ele:
- Serve arquivos HTML/CSS/JS estáticos
- Detecta se tem um servidor rodando e faz proxy (redirecionamento) para ele
- Suporta React, Vite e outros frameworks

<a id="github-importar-e-exportar"></a>
### GitHub (Importar e Exportar)

- **Importar:** Cole o link de qualquer repositório público do GitHub e o CodeLens baixa todo o código
- **Exportar:** Envie seu projeto de volta para o GitHub, criando um repositório novo ou atualizando um existente
- Precisa configurar o token do GitHub nas Configurações

<a id="multi-perfis-de-configuracao"></a>
### Multi-Perfis de Configuração

Você pode ter até 3 perfis diferentes de configuração (Slot 1, 2 e 3). Cada um pode ter:
- Uma chave de API diferente
- Um provedor de IA diferente
- Um token do GitHub diferente

Útil se você tem contas diferentes ou quer testar provedores diferentes.

---

<a id="estrutura-de-pastas-e-arquivos"></a>
## 4. Estrutura de Pastas e Arquivos

<a id="pasta-artifactscode-editor-frontend"></a>
### Pasta `artifacts/code-editor/` (Frontend)

Esta pasta contém tudo que aparece na tela do usuário.

```
artifacts/code-editor/
├── index.html            → Página HTML principal (ponto de entrada)
├── vite.config.ts        → Configuração do Vite (ferramenta que compila o código)
├── package.json          → Lista de dependências e scripts
├── src/                  → Código fonte do frontend
│   ├── main.tsx          → Arquivo inicial que carrega o React
│   ├── App.tsx           → Define as rotas (qual tela aparece em qual endereço)
│   ├── index.css         → Estilos globais (cores, fontes)
│   ├── pages/            → Páginas/telas do sistema
│   │   ├── home.tsx      → Tela inicial com lista de projetos
│   │   ├── project-explorer.tsx → Tela do editor (IDE principal)
│   │   ├── settings.tsx  → Tela de configurações
│   │   └── not-found.tsx → Tela de erro 404 (página não encontrada)
│   ├── components/       → Componentes reutilizáveis (pedaços de tela)
│   │   ├── ai-panel.tsx  → Painel de chat com IA
│   │   ├── code-viewer.tsx → Editor de código com syntax highlighting
│   │   ├── file-tree.tsx → Árvore de arquivos (painel esquerdo)
│   │   ├── github-deploy-modal.tsx → Janela de envio ao GitHub
│   │   └── packages-panel.tsx → Painel de pacotes/dependências
│   ├── hooks/            → Funções auxiliares do React
│   └── lib/              → Utilitários gerais
```

<a id="pasta-artifactsapi-server-backend"></a>
### Pasta `artifacts/api-server/` (Backend)

Esta pasta contém o "motor" que processa os pedidos.

```
artifacts/api-server/
├── package.json          → Dependências do servidor
├── build.mjs             → Script que compila o servidor para produção
├── src/                  → Código fonte do servidor
│   ├── index.ts          → Ponto de entrada (inicia o servidor)
│   ├── app.ts            → Configuração do Express (define como o servidor funciona)
│   ├── routes/           → Rotas da API (cada arquivo = um grupo de funcionalidades)
│   │   ├── ai.ts         → Rotas de inteligência artificial (chat, análise)
│   │   ├── files.ts      → Rotas de arquivos (criar, ler, editar, apagar)
│   │   ├── projects.ts   → Rotas de projetos (listar, criar, apagar)
│   │   ├── github.ts     → Rotas do GitHub (exportar)
│   │   ├── import-github.ts → Rota de importação do GitHub
│   │   ├── exec.ts       → Rota do terminal (executar comandos)
│   │   ├── preview.ts    → Rota de preview (visualizar o projeto)
│   │   ├── settings.ts   → Rotas de configurações
│   │   ├── dev-server.ts → Gerenciamento do servidor de desenvolvimento
│   │   └── health.ts     → Verificação de saúde do sistema
│   ├── lib/              → Bibliotecas internas
│   │   ├── storage.ts    → Funções de armazenamento de arquivos
│   │   ├── persistFiles.ts → Salva/carrega arquivos do banco de dados
│   │   ├── devServerRegistry.ts → Gerencia servidores em execução
│   │   └── logger.ts     → Sistema de logs (registros de atividade)
│   └── middlewares/      → Funções que rodam antes de cada pedido
```

<a id="pasta-lib-bibliotecas-compartilhadas"></a>
### Pasta `lib/` (Bibliotecas Compartilhadas)

Código usado tanto pelo frontend quanto pelo backend.

```
lib/
├── db/                   → Conexão com o banco de dados
│   └── src/
│       ├── index.ts      → Cria a conexão com PostgreSQL
│       └── schema/       → Define as tabelas do banco
│           ├── projects.ts   → Tabela de projetos e arquivos
│           └── settings.ts   → Tabela de configurações
├── api-zod/              → Validação de dados (garante que os dados estão corretos)
├── api-client-react/     → Funções prontas para o frontend chamar a API
└── api-spec/             → Documentação técnica da API (OpenAPI)
```

---

<a id="rotas-da-api-backend"></a>
## 5. Rotas da API (Backend)

"Rotas" são os endereços que o frontend usa para pedir dados ao servidor. Funciona como um telefone: o frontend liga para um número (rota) e o servidor responde.

| Rota | Método | O que faz |
|------|--------|-----------|
| `/api/health` | GET | Verifica se o servidor está funcionando |
| `/api/projects` | GET | Lista todos os projetos |
| `/api/projects` | POST | Cria um novo projeto |
| `/api/projects/:id` | GET | Busca detalhes de um projeto específico |
| `/api/projects/:id` | DELETE | Apaga um projeto |
| `/api/projects/:id/files` | GET | Lista os arquivos de um projeto |
| `/api/projects/:id/files/content` | GET | Lê o conteúdo de um arquivo |
| `/api/projects/:id/files` | POST | Cria ou edita um arquivo |
| `/api/projects/:id/files` | DELETE | Apaga um arquivo |
| `/api/projects/:id/exec-stream` | POST | Executa um comando no terminal (tempo real) |
| `/api/ai/chat` | POST | Conversa com a IA |
| `/api/ai/analyze-file` | POST | Pede para a IA analisar um arquivo |
| `/api/ai/analyze-folder` | POST | Pede para a IA analisar uma pasta inteira |
| `/api/import-github` | POST | Importa um projeto do GitHub |
| `/api/github/deploy` | POST | Exporta/envia para o GitHub |
| `/api/settings` | GET | Busca as configurações |
| `/api/settings` | PUT | Salva as configurações |
| `/api/projects/:id/preview/*` | GET | Visualiza arquivos do projeto |

**Explicação dos métodos:**
- **GET** = buscar/ler dados (como abrir um documento)
- **POST** = criar/enviar dados (como salvar um arquivo novo)
- **PUT** = atualizar dados existentes (como editar e salvar)
- **DELETE** = apagar dados

---

<a id="banco-de-dados"></a>
## 6. Banco de Dados

O sistema usa **PostgreSQL** (um banco de dados gratuito e profissional). As tabelas principais são:

| Tabela | O que guarda |
|--------|-------------|
| `projects` | Nome, data de criação, tamanho, e metadados dos projetos |
| `project_files` | O conteúdo de cada arquivo de cada projeto |
| `settings` | Chaves de API, tokens, preferências do usuário |

---

<a id="problemas-conhecidos"></a>
## 7. Problemas Conhecidos

1. **Terminal na Vercel:** O terminal integrado e o preview ao vivo usam funcionalidades de servidor real (processos do sistema operacional). Na versão Vercel (serverless), essas funcionalidades não funcionam. Funcionam normalmente no Replit.

2. **Limite de upload:** Arquivos ZIP podem ter até 50MB no corpo da requisição (limite do Express). Arquivos maiores podem falhar.

3. **Chaves de API expiram:** Se a IA parar de funcionar, verifique se sua chave de API ainda é válida no site do provedor (OpenAI, Google, etc.).

4. **Modelos antigos podem parar:** O sistema tenta automaticamente modelos mais novos se o antigo parar de funcionar (fallback automático), mas se todos falharem, pode ser necessário atualizar a chave.
