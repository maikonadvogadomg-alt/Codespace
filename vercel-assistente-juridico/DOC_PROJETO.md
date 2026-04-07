# Assistente Jurídico — Documentação Completa do Projeto

> Plataforma jurídica com inteligência artificial para advogados e profissionais do direito.

---

## Índice (clique para ir direto à seção)

1. [Visão Geral](#visao-geral)
2. [Telas do Sistema](#telas-do-sistema)
   - [Login](#login)
   - [Assistente Principal](#assistente-principal)
   - [Jurisprudência](#jurisprudencia)
   - [Consulta Processual](#consulta-processual)
   - [Painel de Processos](#painel-de-processos)
   - [Auditoria Financeira](#auditoria-financeira)
   - [Comparador Jurídico](#comparador-juridico)
   - [Consulta PDPJ](#consulta-pdpj)
   - [Tramitação](#tramitacao)
   - [Filtrador Jurídico](#filtrador-juridico)
   - [Previdenciário](#previdenciario)
   - [Robô DJEN](#robo-djen)
   - [Gerador de Token](#gerador-de-token)
   - [Assistente de Código](#assistente-de-codigo)
   - [Playground](#playground)
   - [Consulta Corporativo](#consulta-corporativo)
3. [Funcionalidades Principais](#funcionalidades-principais)
   - [Geração de Documentos com IA](#geracao-de-documentos-com-ia)
   - [Pesquisa de Jurisprudência](#pesquisa-de-jurisprudencia)
   - [Consulta Processual (DataJud)](#consulta-processual-datajud)
   - [Exportação Word/PDF](#exportacao-word-pdf)
   - [Voz (Ditado e Leitura)](#voz-ditado-e-leitura)
   - [Auditoria Financeira](#auditoria-financeira-func)
   - [Monitoramento de Processos](#monitoramento-de-processos)
4. [Estrutura de Pastas e Arquivos](#estrutura-de-pastas-e-arquivos)
   - [Pasta client (Frontend)](#pasta-client-frontend)
   - [Pasta server (Backend)](#pasta-server-backend)
   - [Pasta shared (Compartilhado)](#pasta-shared-compartilhado)
5. [Rotas da API (Backend)](#rotas-da-api-backend)
6. [Banco de Dados](#banco-de-dados)
7. [Problemas Conhecidos](#problemas-conhecidos)

---

<a id="visao-geral"></a>
## 1. Visão Geral

O **Assistente Jurídico** é uma plataforma completa para advogados que funciona no navegador (pode até instalar no celular como app). Ele permite:

- **Gerar documentos jurídicos** — petições, pareceres, minutas, contestações, usando inteligência artificial
- **Pesquisar jurisprudência** — buscar decisões do STF, STJ e Tribunais Regionais
- **Consultar processos** — verificar andamento processual via DataJud e PDPJ
- **Fazer auditoria financeira** — gerar relatórios financeiros de processos
- **Monitorar processos** — acompanhar prazos e movimentações
- **Comparar textos jurídicos** — colocar dois textos lado a lado para encontrar diferenças
- **Ditar por voz** — falar em vez de digitar
- **Exportar para Word** — baixar os documentos em formato .docx

O sistema funciona como PWA (Progressive Web App), ou seja, pode ser instalado no celular ou computador como se fosse um aplicativo nativo.

---

<a id="telas-do-sistema"></a>
## 2. Telas do Sistema

<a id="login"></a>
### Login

**Endereço:** `/login`

Tela de autenticação. Você digita uma senha para acessar o sistema. A sessão fica salva por 30 dias (não precisa digitar a senha toda vez).

<a id="assistente-principal"></a>
### Assistente Principal

**Endereço:** `/` (página inicial)

A tela principal do sistema. Aqui você:
- Digita o que precisa (ex: "faça uma petição inicial de divórcio consensual")
- A IA gera o documento completo
- Você pode editar o resultado no editor de texto rico
- Pode trocar o "modo" da IA:
  - **Modo Estrito** — foca em gramática e formatação
  - **Modo Redação** — melhora a estrutura do texto
  - **Modo Criativo** — gera textos mais elaborados
- Pode salvar e reutilizar modelos de prompt (templates)
- Exportar para Word com um clique

<a id="jurisprudencia"></a>
### Jurisprudência

**Endereço:** `/jurisprudencia`

Pesquise decisões judiciais:
- Busca no STF, STJ e Tribunais Regionais Federais (TRFs)
- Salve ementas importantes para usar depois como referência
- Organize por tribunal e data

<a id="consulta-processual"></a>
### Consulta Processual

**Endereço:** `/consulta`

Consulte o andamento de processos:
- Pesquise pelo número do processo (formato CNJ)
- Veja movimentações, partes envolvidas
- Integração com o DataJud (base de dados do Judiciário)

<a id="painel-de-processos"></a>
### Painel de Processos

**Endereço:** `/painel`

Dashboard para gerenciar múltiplos processos:
- Visão geral de todos os processos que você está acompanhando
- Status e últimas movimentações
- Organização por cliente ou área

<a id="auditoria-financeira"></a>
### Auditoria Financeira

**Endereço:** `/auditoria`

Gere relatórios financeiros:
- Crie pareceres de auditoria financeira
- Calcule valores atualizados
- Compartilhe via link público (cada parecer ganha um link único)

<a id="comparador-juridico"></a>
### Comparador Jurídico

**Endereço:** `/comparador`

Compare dois textos jurídicos:
- Coloque os textos lado a lado
- O sistema destaca as diferenças
- Útil para comparar versões de contratos ou leis

<a id="consulta-pdpj"></a>
### Consulta PDPJ

**Endereço:** `/pdpj`

Integração com a Plataforma Digital do Poder Judiciário:
- Consulte comunicações processuais
- Pesquise pessoas nos sistemas judiciais
- Precisa de token JWT para autenticação

<a id="tramitacao"></a>
### Tramitação

**Endereço:** `/tramitacao`

Acompanhe a movimentação de processos:
- Veja todas as movimentações em ordem cronológica
- Receba alertas de novas movimentações

<a id="filtrador-juridico"></a>
### Filtrador Jurídico

**Endereço:** `/filtrador`

Filtre e processe grandes volumes de dados jurídicos:
- Importe listas de processos
- Filtre por critérios específicos
- Exporte resultados organizados

<a id="previdenciario"></a>
### Previdenciário

**Endereço:** `/previdenciario`

Ferramentas especializadas para Direito Previdenciário:
- Cálculos previdenciários
- Modelos de petições específicas
- Consultas ao INSS

<a id="robo-djen"></a>
### Robô DJEN

**Endereço:** `/robo-djen`

Automação para o Diário da Justiça Eletrônico Nacional:
- Configure buscas automáticas por palavras-chave
- Monitore publicações relevantes
- Receba alertas de novas publicações

<a id="gerador-de-token"></a>
### Gerador de Token

**Endereço:** `/token`

Gere tokens JWT necessários para acessar APIs judiciais:
- Gere tokens para DataJud
- Gere tokens para PDPJ
- Configure suas credenciais

<a id="assistente-de-codigo"></a>
### Assistente de Código

**Endereço:** `/codigo`

IA especializada em programação para automação jurídica:
- Gere scripts de automação
- Crie robôs para tarefas repetitivas

<a id="playground"></a>
### Playground

**Endereço:** `/playground`

Área de testes:
- Teste prompts antes de usá-los nos documentos
- Experimente diferentes configurações da IA

<a id="consulta-corporativo"></a>
### Consulta Corporativo

**Endereço:** `/corporativo`

Pesquisa e gestão jurídica corporativa:
- Consultas de empresas
- Gestão de contratos empresariais

---

<a id="funcionalidades-principais"></a>
## 3. Funcionalidades Principais

<a id="geracao-de-documentos-com-ia"></a>
### Geração de Documentos com IA

O coração do sistema. Você descreve o que precisa e a IA gera o documento:

**Provedores de IA suportados:**
- Google Gemini (gratuito com limites)
- OpenAI (GPT-4o, ChatGPT)
- Perplexity

**Tipos de documentos que pode gerar:**
- Petições iniciais
- Contestações
- Pareceres jurídicos
- Minutas de contratos
- Recursos
- Manifestações
- Qualquer outro documento jurídico

<a id="pesquisa-de-jurisprudencia"></a>
### Pesquisa de Jurisprudência

Busque decisões dos tribunais diretamente no sistema:
- STF (Supremo Tribunal Federal)
- STJ (Superior Tribunal de Justiça)
- TRFs (Tribunais Regionais Federais)
- Salve ementas para usar como referência nos documentos

<a id="consulta-processual-datajud"></a>
### Consulta Processual (DataJud)

Acesse informações de processos pela API do DataJud:
- Consulte pelo número CNJ
- Veja movimentações, partes e decisões
- Precisa de um token de acesso (gere na tela de Token)

<a id="exportacao-word-pdf"></a>
### Exportação Word/PDF

Exporte seus documentos:
- **Word (.docx)** — formatação profissional, pronto para imprimir ou protocolar
- Formatação jurídica padrão (margens de 4cm, espaçamento correto)

<a id="voz-ditado-e-leitura"></a>
### Voz (Ditado e Leitura)

- **Ditado (Speech-to-Text):** Fale no microfone e o sistema transcreve para texto
- **Leitura (Text-to-Speech):** O sistema lê o documento em voz alta
- Útil para quem tem limitações físicas ou prefere ditar

<a id="auditoria-financeira-func"></a>
### Auditoria Financeira

- Gere pareceres de auditoria financeira detalhados
- Calcule correção monetária e juros
- Compartilhe relatórios via link público

<a id="monitoramento-de-processos"></a>
### Monitoramento de Processos

- Acompanhe múltiplos processos no painel
- Veja últimas movimentações
- Organize por prioridade

---

<a id="estrutura-de-pastas-e-arquivos"></a>
## 4. Estrutura de Pastas e Arquivos

<a id="pasta-client-frontend"></a>
### Pasta `client/` (Frontend)

Tudo que aparece na tela do usuário.

```
client/
├── index.html            → Página HTML principal
├── src/
│   ├── main.tsx          → Arquivo inicial (carrega o React)
│   ├── App.tsx           → Define todas as rotas/telas
│   ├── index.css         → Estilos visuais globais
│   ├── pages/            → Páginas do sistema
│   │   ├── legal-assistant.tsx    → Assistente principal (geração de documentos)
│   │   ├── jurisprudencia.tsx     → Pesquisa de jurisprudência
│   │   ├── consulta-processual.tsx → Consulta de processos
│   │   ├── painel-processos.tsx   → Painel de processos
│   │   ├── auditoria-financeira.tsx → Auditoria financeira
│   │   ├── comparador-juridico.tsx → Comparador de textos
│   │   ├── consulta-pdpj.tsx      → Consulta PDPJ
│   │   ├── tramitacao.tsx         → Tramitação processual
│   │   ├── filtrador-juridico.tsx → Filtrador jurídico
│   │   ├── previdenciario.tsx     → Direito previdenciário
│   │   ├── robo-djen.tsx          → Robô DJEN
│   │   ├── token-generator.tsx    → Gerador de tokens
│   │   ├── code-assistant.tsx     → Assistente de código
│   │   ├── playground.tsx         → Playground de testes
│   │   ├── consulta-corporativo.tsx → Consulta corporativo
│   │   └── login.tsx              → Tela de login
│   └── components/       → Componentes reutilizáveis
│       ├── tiptap-editor.tsx      → Editor de texto rico (onde escreve os documentos)
│       ├── theme-provider.tsx     → Tema claro/escuro
│       └── pwa-install.tsx        → Instalação como app
```

<a id="pasta-server-backend"></a>
### Pasta `server/` (Backend)

O "motor" que processa tudo.

```
server/
├── index.ts              → Ponto de entrada do servidor
├── routes.ts             → Todas as rotas da API (o que o servidor responde)
├── storage.ts            → Funções de banco de dados
├── db.ts                 → Conexão com PostgreSQL
└── djen.ts               → Lógica do robô DJEN
```

<a id="pasta-shared-compartilhado"></a>
### Pasta `shared/` (Compartilhado)

Código usado tanto pelo frontend quanto pelo backend.

```
shared/
└── schema.ts             → Definição das tabelas do banco de dados
```

### Outros arquivos importantes

```
├── vercel.json           → Configuração para deploy na Vercel
├── api/index.ts          → Ponto de entrada para Vercel (serverless)
├── package.json          → Lista de dependências do projeto
├── vite.config.ts        → Configuração do compilador frontend
└── .env                  → Variáveis de ambiente (NÃO compartilhar)
```

---

<a id="rotas-da-api-backend"></a>
## 5. Rotas da API (Backend)

| Rota | Método | O que faz |
|------|--------|-----------|
| `/api/ai/process` | POST | Gera documentos com IA |
| `/api/ai/refine` | POST | Refina/melhora texto existente |
| `/api/tts` | POST | Converte texto em áudio (leitura por voz) |
| `/api/jurisprudencia/buscar` | POST | Pesquisa jurisprudência nos tribunais |
| `/api/snippets` | GET/POST | Gerencia trechos de texto salvos |
| `/api/prompt-templates` | GET/POST | Gerencia modelos de prompt |
| `/api/doc-templates` | GET/POST | Gerencia modelos de documentos |
| `/api/pdpj/*` | POST | Comunicações e pesquisas no PDPJ |
| `/api/datajud/consulta` | POST | Consulta processos no DataJud |
| `/api/djen/executar` | POST | Executa robô do DJEN |
| `/api/export/word` | POST | Exporta documento para Word (.docx) |
| `/api/share/parecer` | POST | Gera link público para parecer |
| `/api/auth/login` | POST | Faz login no sistema |
| `/api/auth/check` | GET | Verifica se está logado |

---

<a id="banco-de-dados"></a>
## 6. Banco de Dados

O sistema usa **PostgreSQL**. As tabelas principais são:

| Tabela | O que guarda |
|--------|-------------|
| `session` | Sessões de login (controla quem está logado) |
| `snippets` | Trechos de texto salvos pelo usuário |
| `prompt_templates` | Modelos de prompt para a IA |
| `doc_templates` | Modelos de documentos jurídicos |
| `ementas` | Ementas de jurisprudência salvas |
| `pareceres` | Pareceres de auditoria gerados |

---

<a id="problemas-conhecidos"></a>
## 7. Problemas Conhecidos

1. **APIs judiciais instáveis:** As APIs do DataJud e PDPJ às vezes ficam fora do ar. Não é problema do sistema — é dos servidores do governo.

2. **Tokens expiram:** Os tokens JWT para acessar APIs judiciais expiram. Quando parar de funcionar, gere um novo na tela de Token.

3. **Limite da IA gratuita:** O Gemini gratuito tem limite de requisições por dia. Se esgotar, espere 24h ou use outro provedor.

4. **Exportação Word:** Alguns formatações muito complexas podem ficar diferentes no Word. Revise o documento após exportar.

5. **PWA no iOS:** No iPhone, a instalação como app funciona pelo Safari (menu "Adicionar à Tela de Início"), mas notificações push não são suportadas.
