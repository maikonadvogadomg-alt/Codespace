# Bugs Corrigidos no Assistente Juridico

## BUG 1 - CRITICO: Import do pdf-parse ERRADO (SERVIDOR NAO INICIA)

**Arquivo:** `server/routes.ts` linha 16

**ERRADO (como estava):**
```
import { PDFParse } from "pdf-parse";
```

**CORRETO:**
```
import pdf from "pdf-parse";
```

**E na linha ~2478 onde usava:**

**ERRADO:**
```
const parser = new PDFParse({ data: file.buffer });
const data = await parser.getText();
extractedText = data.text || "";
await parser.destroy();
```

**CORRETO:**
```
const data = await pdf(file.buffer);
extractedText = data.text || "";
```

**Impacto:** O servidor CRASHA na inicializacao porque `PDFParse` nao existe no pacote `pdf-parse`. Nenhuma funcionalidade do app funciona.

---

## BUG 2 - OCR trava o upload por 5 minutos

**Arquivo:** `server/routes.ts` rota `/api/upload/extract-text`

**Problema:** Quando o PDF nao tem texto (escaneado), o codigo tentava OCR com `pdftoppm` e `tesseract` com timeout de 300 segundos (5 minutos). Se esses programas nao estao instalados, o upload trava e parece que congelou.

**Correcao:** 
- Timeout reduzido para 60s (pdftoppm) e 30s (tesseract)
- OCR agora tem try/catch proprio - se falhar, usa o texto do pdf-parse em vez de crashar
- Limita a 20 paginas para OCR

---

## BUG 3 - Voice Chat usa OpenAI como fallback (gasta dinheiro)

**Arquivo:** `server/routes.ts` rota `/api/voice-chat`

**Problema:** Quando nao tem chave custom, o voice-chat tentava usar `AI_INTEGRATIONS_OPENAI_API_KEY` (GPT-4o-mini) antes de ir para o Gemini. Isso gasta creditos do Replit desnecessariamente.

**Correcao:** Removido o bloco do OpenAI proxy. Agora vai direto para o Gemini.

---

## BUG 4 - Transcricao de audio crasha sem chave

**Arquivo:** `server/routes.ts` rota `/api/upload/transcribe`  

**Problema:** Se nao tinha chave Groq nem OpenAI configurada, tentava usar o client `openai` global que tem chave "placeholder" - dava erro 401 sem mensagem clara.

**Correcao:** Agora retorna mensagem de erro clara pedindo para configurar uma chave.

---

## COMO APLICAR NO OUTRO PROJETO

1. Abra o projeto do Assistente Juridico no Replit
2. Abra o arquivo `server/routes.ts`
3. Substitua TODO o conteudo pelo arquivo `routes.ts` desta pasta
4. Salve e reinicie o servidor

O arquivo `routes.ts` nesta pasta ja tem TODAS as correcoes aplicadas.
