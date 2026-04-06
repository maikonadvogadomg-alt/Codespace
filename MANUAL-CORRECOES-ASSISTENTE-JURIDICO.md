# INSTRUCOES PARA GEMINI — Assistente Juridico
**Projeto:** https://github.com/maikonadvogadomg-alt/AplicativoMaikon

---

## O QUE ESTE DOCUMENTO E

Manual de orientacao para a Gemini saber o estado atual do projeto, onde estao os problemas, e o que precisa corrigir. A Gemini tem autonomia total para fazer as correcoes, refatorar codigo se necessario, fazer commits e enviar para o GitHub.

---

## ESTADO ATUAL — O QUE JA FUNCIONA (NAO MEXA)

Estes itens foram verificados por comparacao direta e estao corretos:

- `client/src/components/tiptap-editor.tsx` — Editor TipTap, IDENTICO e correto
- `shared/schema.ts` — Schema do banco, 16 tabelas, correto
- `server/storage.ts` — Acesso ao banco, correto
- Todos os componentes em `client/src/components/ui/` — 47 componentes shadcn, corretos
- Chat de voz juridico — `continuous=false`, guard `alreadySent`, rate 1.15, pitch 1.05, voz Google PT-BR
- Chat de voz campo livre — Modal completo, TTS edge-tts + fallback, guard `captured`
- Gemini fallback via `AI_INTEGRATIONS_GEMINI_API_KEY` em `geminiStream()` e `geminiStreamMessages()`
- Comunicacoes CNJ — Pagina + rotas backend
- ErrorBoundary — Envolvendo todas as rotas
- Playground React/Python — Funcionando
- edge-tts com `python3` e `--rate=+18%`

---

## PROBLEMAS PARA CORRIGIR

### 1. Jamile pede documentos que ja tem acesso
**Onde:** `server/routes.ts`, const `SYSTEM_PROMPT_BASE` (linha ~260)
**O que:** Falta uma regra no system prompt dizendo para a IA nunca pedir documentos que ja estao no contexto. O texto do documento ja vem no prompt via `{{textos}}` e o historico vem via `recentContext`. Adicionar regra 12 apos a regra 11 (sobre ementas).

### 2. Importacao de documentos trava/fecha o app
**Onde:** `server/routes.ts`, rota `/api/upload/extract-text` (linha ~2286)
**Problemas:**
- PDFs grandes ativam OCR (`pdftoppm` + `tesseract`) com resolucao 300dpi e sem limite de paginas — trava com PDFs de muitas paginas
- `PDFParse` pode crashar com PDFs protegidos ou corrompidos sem try/catch adequado
- Multer aceita 50MB em memoria — varios arquivos grandes estouram RAM
- Frontend nao tem timeout na chamada fetch (`uploadAndExtract` em `legal-assistant.tsx` linha ~1374)

### 3. Formatacao juridica nao aplica automaticamente no editor
**Onde:** `client/src/components/tiptap-editor.tsx` e `client/src/index.css`
**O que:** O CSS existe (`.word-editor-content p { text-indent: 4cm; text-align: justify; }` etc) mas quando o usuario digita texto novo do zero, o editor usa defaults sem formatacao. Falta configurar `editorProps` no `useEditor` com font-family e line-height padrao. Tambem verificar se a div pai do `<EditorContent>` tem a classe `word-editor-content` ou `word-page`.

### 4. Resultado da IA sem formatacao juridica no display
**Onde:** `client/src/pages/legal-assistant.tsx`
**O que:** Verificar se a div que renderiza o `result` (via `dangerouslySetInnerHTML`) tem a classe `legal-result-display`. O CSS ja existe em `index.css`. Os estilos inline `ESTILOS_JURIDICOS` (linhas ~102-109) definem PARAGRAFO, CABECALHO, TITULO, ASSINATURA, CITACAO — verificar se o processamento pos-streaming aplica esses estilos.

---

## MAPA DOS ARQUIVOS PRINCIPAIS

```
server/routes.ts          — TODAS as rotas da API (5.784 linhas)
  - linha ~260: SYSTEM_PROMPT_BASE (prompt da Jamile)
  - linha ~79: config do multer (upload)
  - linha ~2286: rota /api/upload/extract-text
  - linha ~2314: PDFParse
  - linha ~2325: OCR com pdftoppm + tesseract

client/src/pages/legal-assistant.tsx — Pagina principal (5.403 linhas)
  - linha ~102: ESTILOS_JURIDICOS (formatacao inline)
  - linha ~1339: uploadAndExtract (importacao de arquivos)
  - linha ~1374: fetch para /api/upload/extract-text

client/src/components/tiptap-editor.tsx — Editor de texto (541 linhas)
  - linha ~112: useEditor com extensions
  - linha ~500: div.word-page com CSS de formatacao

client/src/index.css — Estilos globais
  - linha ~290: .legal-result-display (formatacao do resultado)
  - linha ~342: estilos adicionais do editor
  - linha ~506: .word-editor-content p (recuo 4cm, justify, etc)
```

---

## OPCOES PARA A GEMINI

A Gemini pode escolher a abordagem que achar melhor:

1. **Correcoes pontuais** — Alterar apenas as linhas especificas listadas acima
2. **Refatoracao parcial** — Se o codigo ao redor estiver confuso, pode refatorar a funcao/secao toda
3. **Refatoracao completa** — Se necessario, pode reescrever modulos inteiros (mas NAO altere os arquivos listados como "NAO MEXA")

Apos cada correcao, a Gemini deve:
- Testar se funciona
- Fazer commit com mensagem descritiva em portugues
- Fazer push para o GitHub (branch main)

---

## VARIAVEIS DE AMBIENTE EXISTENTES

```
DATABASE_URL — PostgreSQL
SESSION_SECRET — Sessoes Express
AI_INTEGRATIONS_GEMINI_API_KEY — Gemini cortesia Replit
AI_INTEGRATIONS_GEMINI_BASE_URL — Gemini proxy Replit
DATAJUD_API_KEY — Busca jurisprudencia (tem fallback embutido)
PDPJ_PEM_PRIVATE_KEY — Chave PEM para CNJ/PDPJ
```

---

## RESUMO

4 bugs para corrigir. Os arquivos e linhas exatas estao listados acima. O resto do projeto esta funcionando. NAO altere o que funciona. Faca as correcoes, teste, commit e push.
