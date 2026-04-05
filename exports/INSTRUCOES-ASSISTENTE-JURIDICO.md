# ASSISTENTE JURÍDICO — Pacote Completo para Implantação

## COMANDO PARA COLAR NO OUTRO PROJETO
Maikon, quando abrir o outro Replit, cole isto no chat:

> Eu trouxe o pacote completo do Assistente Jurídico atualizado. Ele foi feito
> pelo agente IA no meu outro Replit (CodeSpace). O arquivo INSTRUCOES.md
> explica tudo: quais arquivos substituir, quais tabelas criar, quais
> variáveis de ambiente configurar, e todas as 9 correções que já foram
> aplicadas (Gemini cortesia sem cobrar, busca de jurisprudência DataJud,
> ementas resumidas, sem tela branca, chat por voz, links clicáveis,
> formatação jurídica, playground React/Python, e package.json corrigido).
> Leia o INSTRUCOES.md e aplique tudo. O banco já existe aqui — só precisa
> criar as tabelas novas sem apagar as existentes.

## QUEM FEZ
Este projeto foi desenvolvido pelo agente IA no Replit do CodeSpace (live-code-runner.replit.app).
O dono é **Maikon da Rocha Caldeira**, OAB 183712/MG, CPF 09494128648.

## O QUE É
Assistente Jurídico completo com IA (Gemini 2.5 Flash), busca de jurisprudência via DataJud/CNJ,
editor de texto com formatação jurídica, chat por voz, gerador de tokens, consulta processual,
comunicações CNJ, e muito mais.

---

## INSTRUÇÕES PARA O AGENTE DO OUTRO PROJETO

### PASSO 1 — Substituir os arquivos
Copie TODAS as pastas abaixo para a raiz do projeto, substituindo o que já existe:
- `client/` — Frontend React completo (páginas, componentes, hooks, estilos)
- `server/` — Backend Express completo (rotas, banco, storage, integrações)
- `shared/` — Schema do banco (Drizzle ORM) e modelos compartilhados
- `package.json` — Dependências atualizadas (IMPORTANTE: substituir)
- `tsconfig.json`, `vite.config.ts`, `drizzle.config.ts` — Configs
- `tailwind.config.ts`, `postcss.config.js`, `components.json` — Estilos

### PASSO 2 — Instalar dependências
```bash
npm install
```

### PASSO 3 — Banco de dados
O projeto usa PostgreSQL via `DATABASE_URL`. As tabelas são criadas automaticamente
ao iniciar o servidor (migrate automático em `server/routes.ts`).

Tabelas necessárias (criadas automaticamente):
- users, snippets, custom_actions, ementas, ai_history
- prompt_templates, doc_templates, shared_pareceres
- processos_monitorados, app_settings, tramitacao_publicacoes
- djen_clientes, djen_publicacoes, djen_execucoes
- conversations, messages

Se o banco já tem tabelas com esses nomes, o migrate ignora (usa IF NOT EXISTS).
NÃO apague dados existentes.

### PASSO 4 — Variáveis de ambiente necessárias
```
DATABASE_URL=postgresql://...          # Banco PostgreSQL (já deve existir)
SESSION_SECRET=qualquer-string-longa   # Para sessões Express
```

Opcionais (melhoram funcionalidade):
```
PDPJ_PEM_PRIVATE_KEY=...     # Chave PEM para autenticação PDPJ/CNJ
PDPJ_CPF=09494128648         # CPF do advogado
PDPJ_PASSWORD=...            # Senha PDPJ
PDPJ_PEM_PASSWORD=...        # Senha da chave PEM
```

### PASSO 5 — Iniciar
```bash
# Desenvolvimento:
NODE_ENV=development tsx server/index.ts

# Produção:
npm run build && npm run start
```

O servidor roda na porta definida por `PORT` (padrão 5000).
Se o app usa base path (ex: `/app`), configure via `BASE_PATH=/app`.

---

## CORREÇÕES JÁ APLICADAS NESTE PACOTE

### 1. IA usa Gemini 2.5 Flash (NÃO cobra)
- Prioridade: chave própria do usuário > Gemini cortesia do Replit
- NUNCA usa OpenAI/GPT — removido completamente como fallback padrão
- Se `AI_INTEGRATIONS_GEMINI_API_KEY` e `AI_INTEGRATIONS_GEMINI_BASE_URL` existem, usa direto
- Sem essas vars, usa o cliente Gemini global (apiKey placeholder funciona no Replit)

### 2. Busca de jurisprudência (DataJud) funcionando
- Endpoint: POST `/api/jurisprudencia/buscar`
- Busca por TERMOS (ementa, assuntos, classe, órgão julgador)
- Chave DataJud embutida como fallback — funciona sem configurar nada
- Suporta filtro por tribunais (TJMG, STJ, TRF6, etc.)
- Resultados incluem link direto para CNJ

### 3. Ementas resumidas pela IA
- Quando ementas são selecionadas para fundamentação, a IA resume inteligentemente
- Preserva fonte oficial intacta (tribunal, processo, relator, data)
- Nunca copia ementa inteira se for longa

### 4. Sem tela branca (ErrorBoundary)
- ErrorBoundary envolve todas as rotas em App.tsx
- Se alguma página travar, mostra tela de recuperação com botão para voltar
- Nunca mais tela branca

### 5. Chat por voz no modo Livre
- Botão VOZ no header do Assistente Livre (code-assistant.tsx)
- Microfone + TTS (texto-para-fala)
- Endpoint: POST `/api/code-assistant` com streaming
- TTS via POST `/api/tts` com fallback para SpeechSynthesis do navegador

### 6. Links clicáveis
- URLs em respostas da IA viram links azuis clicáveis
- Usa linkifyHtml no assistente jurídico
- Componente RenderText no assistente livre

### 7. Formatação jurídica correta
- Recuo primeira linha: 4cm
- Fonte: Times New Roman 12pt
- Espaçamento: 1.5 entre linhas
- Alinhamento: justificado
- Editor TipTap com toolbar completa

### 8. Playground React + Python
- Página `/playground` com editor de código
- Executa React (JSX) com preview ao vivo
- Executa Python com output no console
- Botão executar NÃO trava mais

### 9. Package.json corrigido
- Todas as dependências resolvidas e funcionando
- Sem conflitos de versão
- Override do drizzle-kit para compatibilidade com tsx

---

## ESTRUTURA DO PROJETO

```
client/
  src/
    pages/
      legal-assistant.tsx      — Assistente Jurídico principal
      jurisprudencia.tsx       — Busca de jurisprudência DataJud
      code-assistant.tsx       — Assistente Livre (chat + voz)
      playground.tsx           — Playground React/Python
      consulta-processual.tsx  — Consulta por número de processo
      comunicacoes-cnj.tsx     — Comunicações CNJ/PDPJ
      painel-processos.tsx     — Painel de processos monitorados
      comparador-juridico.tsx  — Comparador de textos
      auditoria-financeira.tsx — Auditoria financeira
      filtrador.tsx            — Filtrador de documentos
      previdenciario.tsx       — Calculadora previdenciária
      robo-djen.tsx            — Robô DJen (publicações)
      tramitacao.tsx           — Tramitação processual
      consulta-corporativo.tsx — Consulta corporativa
      consulta-pdpj.tsx        — Consulta PDPJ
      token-generator.tsx      — Gerador de tokens JWT
      login.tsx                — Tela de login
      not-found.tsx            — 404
    components/
      ui/                      — 47 componentes shadcn/ui
      tiptap-editor.tsx        — Editor de texto jurídico
      theme-provider.tsx       — Provedor de tema claro/escuro
      theme-toggle.tsx         — Botão de alternar tema
      pwa-install.tsx          — Banner de instalação PWA
    App.tsx                    — Rotas e ErrorBoundary
    index.css                  — Estilos globais + .legal-link
    main.tsx                   — Entry point
    lib/
      queryClient.ts           — React Query config
      utils.ts                 — Utilitários

server/
  index.ts                     — Entry point do servidor
  routes.ts                    — TODAS as rotas (6000+ linhas)
  storage.ts                   — Camada de acesso ao banco
  db.ts                        — Conexão PostgreSQL + Drizzle
  vite.ts                      — Dev server Vite middleware
  static.ts                    — Arquivos estáticos em produção
  djen.ts                      — Lógica do Robô DJen
  replit_integrations/         — Integrações AI do Replit

shared/
  schema.ts                    — Schema completo do banco (Drizzle)
  models/
    chat.ts                    — Schema de conversações
```

---

## ROTAS PRINCIPAIS DA API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/ai/process | Processar texto com IA (streaming) |
| POST | /api/ai/refine | Refinar texto com IA |
| POST | /api/jurisprudencia/buscar | Buscar jurisprudência por termos |
| POST | /api/datajud/consulta | Consultar processo por número |
| POST | /api/datajud/consulta-oab | Consultar por OAB |
| GET  | /api/datajud/tribunais | Listar tribunais disponíveis |
| POST | /api/code-assistant | Chat livre com IA (streaming) |
| POST | /api/tts | Texto-para-fala |
| GET  | /api/ementas | Listar ementas salvas |
| POST | /api/ementas | Salvar ementa |
| GET  | /api/custom-actions | Listar ações personalizadas |
| POST | /api/custom-actions | Criar ação personalizada |
| GET  | /api/ai-history | Histórico de uso da IA |
| GET  | /api/processos | Listar processos monitorados |
| POST | /api/processos | Adicionar processo |
| GET  | /api/auth/check | Verificar autenticação |
| POST | /api/auth/login | Login |

---

## RESUMO PARA O AGENTE
Substitua os arquivos, rode `npm install`, e inicie.
O banco migra sozinho. A IA funciona sem configurar chave (Gemini cortesia).
A busca de jurisprudência funciona sem configurar chave (DataJud embutida).
Todas as correções de bugs, tela branca, travamentos e formatação já estão aplicadas.
