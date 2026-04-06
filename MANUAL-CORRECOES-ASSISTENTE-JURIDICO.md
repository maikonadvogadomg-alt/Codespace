# MANUAL TECNICO COMPLETO — ASSISTENTE JURIDICO
## Para uso com a Gemini no projeto original
**Projeto:** https://github.com/maikonadvogadomg-alt/AplicativoMaikon
**Data:** 06/04/2026
**Versao:** 2.0 — Analise profunda com diferencas exatas entre GitHub e CodeSpace

---

## INSTRUCAO PARA A GEMINI

Cole este bloco inteiro no chat da Gemini do projeto original. Ele contem TUDO que ela precisa saber para corrigir os bugs sem quebrar o que funciona.

---

## PARTE 1 — CONTEXTO E REGRAS

Este manual foi gerado por comparacao LINHA POR LINHA entre o projeto original (GitHub) e a versao de desenvolvimento (CodeSpace). O projeto original JA tem a maioria das correcoes. Este documento lista:

1. O que JA funciona (NAO MEXA)
2. Bugs ativos que precisam de correcao
3. Codigo exato para cada correcao
4. Onde cada arquivo esta e qual linha alterar

REGRA ABSOLUTA: NAO substitua arquivos inteiros. Faca APENAS as correcoes pontuais listadas. Se algo nao esta listado aqui como bug, NAO ALTERE.

---

## PARTE 2 — ARQUIVOS QUE NAO DEVEM SER ALTERADOS

Estes arquivos estao 100% corretos (verificado por diff). NAO MEXA neles:

- `client/src/components/tiptap-editor.tsx` — ZERO diferencas, IDENTICO
- `shared/schema.ts` — ZERO diferencas, IDENTICO
- `server/storage.ts` — ZERO diferencas, IDENTICO
- `tailwind.config.ts` — IDENTICO
- `postcss.config.js` — IDENTICO
- `components.json` — IDENTICO
- Todos os 47 componentes em `client/src/components/ui/` — IDENTICOS

---

## PARTE 3 — BUGS ATIVOS E CORRECOES

### BUG 1: Jamile pede documentos que ja tem acesso
**Severidade:** ALTA
**Arquivo:** `server/routes.ts`
**Sintoma:** A IA pede ao usuario para "enviar", "fornecer" ou "anexar" documentos que ja estao no contexto da conversa.
**Causa:** O system prompt nao tem uma regra explicita contra esse comportamento.

**CORRECAO:**
Localize a const `SYSTEM_PROMPT_BASE` (comeca na linha ~260). Encontre a ultima regra (regra 11 sobre EMENTAS). Logo DEPOIS da regra 11, ANTES do fechamento das aspas crases, adicione:

```
12. REGRA CRITICA DE CONTEXTO: Voce TEM acesso a TODOS os documentos e textos que o advogado forneceu. Eles estao no campo de texto da mensagem e no historico da sessao. NUNCA peca para "enviar", "fornecer", "compartilhar" ou "anexar" documentos. Se o texto aparece no seu prompt, voce JA TEM o documento. Trabalhe com o que tem. So peca informacoes que REALMENTE nao existem no contexto (dados pessoais especificos, numeros nao mencionados, etc). Se o advogado disser "analise o documento" ou "faca uma minuta", USE o texto que esta no prompt — ele JA E o documento.
```

**COMO ENCONTRAR:** Procure por este trecho exato:
```
11. EMENTAS: quando citar ementa de jurisprudencia, COPIE O TEXTO COMPLETO
```
A regra 12 vai logo depois do final dessa regra 11.

---

### BUG 2: Importacao de documentos falha/trava o app
**Severidade:** CRITICA
**Arquivo:** `server/routes.ts` (rota `/api/upload/extract-text`, linha ~2286)
**Sintoma:** Ao importar PDF ou DOCX, o app trava, fecha ou mostra erro.

**CAUSAS IDENTIFICADAS:**

**Causa 2a — PDFs grandes com OCR travam o servidor:**
O codigo atual faz OCR com `pdftoppm` + `tesseract` quando o PDF tem pouco texto extraivel. Para PDFs grandes (muitas paginas), isso pode demorar MINUTOS e estourar a memoria.

Localize este trecho (linha ~2325):
```typescript
const ocrTmpDir = fs.mkdtempSync(path.join("/tmp", "ocr-"));
try {
  const pdfPath = path.join(ocrTmpDir, "input.pdf");
  fs.writeFileSync(pdfPath, file.buffer);
  await execFileAsync(
    "pdftoppm",
    ["-png", "-r", "300", pdfPath, path.join(ocrTmpDir, "page")],
    { timeout: 300000 },
  );
```

**CORRECAO 2a — Limitar OCR a 10 paginas e reduzir resolucao:**
Substitua o bloco de pdftoppm por:
```typescript
const ocrTmpDir = fs.mkdtempSync(path.join("/tmp", "ocr-"));
try {
  const pdfPath = path.join(ocrTmpDir, "input.pdf");
  fs.writeFileSync(pdfPath, file.buffer);
  await execFileAsync(
    "pdftoppm",
    ["-png", "-r", "200", "-l", "10", pdfPath, path.join(ocrTmpDir, "page")],
    { timeout: 120000 },
  );
```

Mudancas:
- `-r 200` em vez de `-r 300` (resolucao menor = mais rapido, qualidade ainda boa para OCR)
- `-l 10` adicionado (limita a 10 primeiras paginas — evita travar com PDF de 200 paginas)
- `timeout: 120000` em vez de `300000` (2 min em vez de 5 min)

**Causa 2b — PDFParse pode falhar silenciosamente com certos PDFs:**
O `PDFParse` pode lancar excecao com PDFs protegidos, corrompidos ou com encoding exotico. O erro e capturado mas o texto fica vazio, e depois tenta OCR (que pode tambem falhar).

**CORRECAO 2b — Melhorar tratamento de erro no PDFParse:**
Localize (linha ~2314):
```typescript
if (isPdf) {
  const parser = new PDFParse({ data: file.buffer });
  const data = await parser.getText();
  extractedText = data.text || "";
  await parser.destroy();
```

Substitua por:
```typescript
if (isPdf) {
  try {
    const parser = new PDFParse({ data: file.buffer });
    const data = await parser.getText();
    extractedText = data.text || "";
    await parser.destroy();
  } catch (pdfErr) {
    console.error(`PDFParse falhou para ${file.originalname}:`, pdfErr);
    extractedText = "";
  }
```

Isso garante que se o PDFParse falhar, o codigo continua para tentar OCR em vez de crashar.

**Causa 2c — Arquivos enormes estourando memoria (multer):**
O multer aceita ate 50MB (`fileSize: 50 * 1024 * 1024`). Com `memoryStorage`, o arquivo inteiro fica em RAM. Se o usuario importar multiplos PDFs grandes ao mesmo tempo, a memoria estoura e o processo morre.

**CORRECAO 2c — Adicionar tratamento de memoria e limite de arquivos simultaneos:**
Localize (linha ~79):
```typescript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});
```

Substitua por:
```typescript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 5 },
});
```

Mudancas:
- `fileSize: 30MB` em vez de `50MB` (suficiente para qualquer peticao/acordao)
- `files: 5` adicionado (maximo 5 arquivos por vez)

**Causa 2d — Frontend nao trata timeout de rede:**
A chamada fetch em `uploadAndExtract` nao tem timeout. Se o servidor demorar 3+ minutos no OCR, o frontend fica travado.

**CORRECAO 2d:**
Localize em `client/src/pages/legal-assistant.tsx` (linha ~1374):
```typescript
const res = await fetch("/api/upload/extract-text", { method: "POST", body: formData });
```

Substitua por:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 120000);
const res = await fetch("/api/upload/extract-text", { method: "POST", body: formData, signal: controller.signal });
clearTimeout(timeoutId);
```

Isso cancela a requisicao apos 2 minutos e mostra erro em vez de travar.

---

### BUG 3: Formatacao juridica do TipTap nao aplica automaticamente
**Severidade:** MEDIA
**Arquivo:** `client/src/components/tiptap-editor.tsx` e `client/src/index.css`
**Sintoma:** Texto no editor nao tem recuo 4cm, nao tem Times New Roman, nao tem espacamento 1.5 por padrao.

**ANALISE:** O TipTap Editor TEM as extensoes corretas:
- `TextIndent` (extensao customizada, linha ~67)
- `LineHeight` (extensao customizada, linha ~36)
- `FontFamily` (extensao oficial, linha ~8)
- `TextAlign` (extensao oficial, linha ~3)

O problema NAO e no componente TipTap em si. O problema e que o CSS do editor (`.word-editor-content`) define os estilos corretos, MAS o editor so aplica quando o usuario cola texto ou quando o resultado da IA e inserido via `setContent()`. Quando o usuario digita texto novo do zero, o TipTap usa os defaults (sem recuo, sem Times).

**CORRECAO 3 — Aplicar formatacao padrao ao iniciar o editor:**
No arquivo `client/src/components/tiptap-editor.tsx`, localize o `useEditor` (linha ~112):

```typescript
const editor = useEditor({
  extensions: [
    StarterKit.configure(...)
```

Dentro do objeto de configuracao do `useEditor`, APOS a lista de `extensions`, adicione:

```typescript
editorProps: {
  attributes: {
    style: "font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5;",
  },
},
```

Isso faz o editor SEMPRE usar Times New Roman 12pt com espacamento 1.5 como padrao, mesmo quando o usuario digita do zero.

Para o recuo de 4cm nos paragrafos, o CSS em `index.css` JA tem a regra `.word-editor-content p { text-indent: 4cm }`. Verifique que a div que envolve o editor tem a classe `word-editor-content`. Se nao tiver, adicione.

**LOCALIZACAO DO CSS (ja existente e correto em index.css):**
```css
.word-editor-content p { margin: 0 0 12pt 0; text-align: justify; text-indent: 4cm; line-height: 1.5; min-height: 1.5em; }
.word-editor-content h1 { font-size: 14pt; font-weight: bold; text-align: center; text-transform: uppercase; text-indent: 0 !important; }
.word-editor-content h2 { font-size: 12pt; font-weight: bold; text-align: center; text-transform: uppercase; text-indent: 0 !important; }
.word-editor-content blockquote { margin: 12pt 4cm 12pt 4cm; font-size: 10pt; line-height: 1.0; text-indent: 0 !important; text-align: justify; }
```

Essas regras JA existem. O que pode estar faltando e a classe `word-editor-content` na div pai do editor.

**COMO VERIFICAR:** No `tiptap-editor.tsx`, procure a div que contem `<EditorContent>`. Ela deve ter uma classe que aplica esses estilos. Se a div pai nao tem `word-editor-content` ou `word-page`, a formatacao nao sera aplicada visualmente.

Localize (proximo da linha ~500):
```typescript
<div className="word-page">
```

Se essa div existe, a formatacao CSS esta sendo aplicada. Se NAO existe, adicione a classe `word-page` na div que envolve o `<EditorContent>`.

---

### BUG 4: Resultado da IA nao respeita formatacao juridica no display
**Severidade:** MEDIA
**Arquivo:** `client/src/pages/legal-assistant.tsx`
**Sintoma:** O texto gerado pela IA aparece sem a formatacao juridica (sem recuo, sem Times New Roman) na area de resultado.

**ANALISE:** O CSS para `.legal-result-display` JA existe em `index.css`:
```css
.legal-result-display {
  font-family: 'Times New Roman', Georgia, serif;
  line-height: 1.5;
}
.legal-result-display p {
  /* estilos de paragrafo */
}
```

O problema pode ser que o container do resultado nao tem a classe `legal-result-display`.

**COMO VERIFICAR:** No `legal-assistant.tsx`, procure onde o `result` ou `editedHtml` e renderizado. Deve haver algo como:
```typescript
<div dangerouslySetInnerHTML={{ __html: result }} />
```

Essa div DEVE ter a classe `legal-result-display`. Se nao tiver, adicione:
```typescript
<div className="legal-result-display" dangerouslySetInnerHTML={{ __html: result }} />
```

**TAMBEM:** O `ESTILOS_JURIDICOS` definido nas linhas ~102-109 do `legal-assistant.tsx` e usado quando a IA gera a resposta. Verifique que o resultado streaming aplica esses estilos ao HTML gerado. Se a IA gera texto puro (sem tags HTML com styles inline), a formatacao so vem do CSS.

A const `ESTILOS_JURIDICOS` e:
```typescript
PARAGRAFO: "text-indent:4cm;text-align:justify;line-height:1.5;margin:0 0 12pt 0;font-family:'Times New Roman',serif;font-size:12pt"
CABECALHO: "text-align:center;text-indent:0;line-height:1.5;..."
TITULO: "font-weight:bold;text-align:justify;text-indent:0;..."
ASSINATURA: "text-align:center;font-weight:bold;text-transform:uppercase;..."
CITACAO: "margin-left:4cm;margin-right:4cm;text-align:justify;text-indent:0;line-height:1.0;font-size:10pt"
```

Esses estilos sao aplicados pelo processamento pos-IA. Verifique que a funcao que processa o streaming da IA aplica esses estilos nos paragrafos gerados.

---

## PARTE 4 — O QUE JA FUNCIONA (NAO ALTERE)

### Chat de voz no Juridico (`legal-assistant.tsx`):
- `rec.continuous = false` — CORRETO (captura limpa)
- `rec.stop()` explicito apos captura — CORRETO
- Guard `alreadySent` — CORRETO
- `utterance.rate = 1.15` — CORRETO (fala natural)
- `utterance.pitch = 1.05` — CORRETO
- Preferencia voz Google PT-BR — CORRETO

### Chat de voz no Campo Livre (`code-assistant.tsx`):
- Modal completo com historico — CORRETO
- Botao VOZ no header — CORRETO
- TTS via edge-tts + fallback — CORRETO
- `continuous=false` + guard `captured` — CORRETO

### Backend (`server/routes.ts`):
- Gemini fallback via `AI_INTEGRATIONS_GEMINI_API_KEY` — CORRETO
- `python3` para edge-tts — CORRETO
- `--rate=+18%` no TTS — CORRETO
- Rotas CNJ Comunicacoes — CORRETO
- Fatal error handler — CORRETO

### Paginas e navegacao:
- Comunicacoes CNJ — CORRETO
- ErrorBoundary — CORRETO
- Playground React/Python — CORRETO
- Link Comunicacoes no menu — CORRETO

---

## PARTE 5 — CHECKLIST FINAL

Apos aplicar todas as correcoes, verifique:

### Testar importacao:
- [ ] Importar um PDF pequeno (1-5 paginas) — deve funcionar em segundos
- [ ] Importar um PDF grande (50+ paginas) — deve limitar OCR a 10 paginas, nao travar
- [ ] Importar um DOCX — deve extrair texto normalmente
- [ ] Importar arquivo TXT — deve funcionar sem backend
- [ ] Importar arquivo corrompido — deve mostrar erro amigavel, nao travar

### Testar formatacao:
- [ ] Digitar texto novo no editor — deve ter Times New Roman, espacamento 1.5
- [ ] Resultado da IA — deve ter recuo 4cm, Times New Roman, justificado
- [ ] Titulos — devem ser centralizados, CAIXA ALTA, sem recuo
- [ ] Citacoes (blockquote) — recuo 4cm dos dois lados, fonte 10pt, sem recuo primeira linha

### Testar IA:
- [ ] Enviar documento e pedir analise — Jamile NAO deve pedir para enviar o documento de novo
- [ ] Pedir minuta — deve gerar 15+ paginas com todas as secoes
- [ ] Chat de voz — deve funcionar sem duplicar texto

---

## PARTE 6 — MAPA DE ARQUIVOS ALTERADOS

| Arquivo | Linhas alteradas | Tipo de correcao |
|---------|-----------------|------------------|
| `server/routes.ts` ~260 | Adicionar regra 12 ao SYSTEM_PROMPT_BASE | Bug 1 |
| `server/routes.ts` ~79 | Multer limits: 30MB, max 5 files | Bug 2c |
| `server/routes.ts` ~2314 | Try/catch no PDFParse | Bug 2b |
| `server/routes.ts` ~2325 | OCR: -r 200, -l 10, timeout 120s | Bug 2a |
| `client/src/pages/legal-assistant.tsx` ~1374 | AbortController timeout 120s | Bug 2d |
| `client/src/components/tiptap-editor.tsx` ~112 | editorProps com font padrao | Bug 3 |
| Verificar classe `legal-result-display` no resultado | CSS ja existe | Bug 4 |

Total de linhas a mudar: ~15 linhas de codigo. NAO e refatoracao. Sao correcoes cirurgicas.

---

## RESUMO PARA A GEMINI

> Leia este manual INTEIRO antes de fazer qualquer mudanca.
> Sao 4 bugs para corrigir. Cada um tem o codigo exato e a linha exata.
> NAO altere arquivos que nao estao listados.
> NAO substitua arquivos inteiros.
> NAO mude o TipTap editor exceto adicionar editorProps.
> NAO mude o schema, storage, ou componentes UI.
> Faca as 4 correcoes, teste cada uma, e confirme com o checklist.
> O projeto esta 95% correto. So precisa dessas correcoes pontuais.
