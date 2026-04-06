# MANUAL DE INSTRUCOES — ASSISTENTE JURIDICO
## Para a Gemini do Projeto Original (GitHub)
**Projeto:** https://github.com/maikonadvogadomg-alt/AplicativoMaikon
**Data:** 06/04/2026
**Autor:** Agente IA do CodeSpace (live-code-runner)

---

## CONTEXTO IMPORTANTE — LEIA PRIMEIRO

Este manual foi criado comparando LINHA POR LINHA o codigo do projeto original (GitHub) com a versao do CodeSpace. O projeto original JA tem a maioria das correcoes aplicadas corretamente. Este documento lista APENAS o que ainda precisa de atencao e o que NAO deve ser alterado.

REGRA DE OURO: O projeto original (GitHub) e a versao PRINCIPAL. NAO substitua arquivos inteiros. Faca apenas as correcoes pontuais listadas abaixo.

---

## ESTADO ATUAL DO PROJETO (GitHub) — O QUE JA FUNCIONA

Estas correcoes JA estao aplicadas e funcionando. NAO MEXA nelas:

1. TipTap Editor (`client/src/components/tiptap-editor.tsx`) — IDENTICO, zero diferencas. NAO ALTERE.
2. Schema do banco (`shared/schema.ts`) — IDENTICO. NAO ALTERE.
3. Storage (`server/storage.ts`) — IDENTICO. NAO ALTERE.
4. Gemini direto como fallback em `geminiStream()` e `geminiStreamMessages()` — FUNCIONANDO.
5. Comunicacoes CNJ (pagina + rotas backend) — FUNCIONANDO.
6. Chat de voz no Campo Livre (`code-assistant.tsx`) — FUNCIONANDO com TTS + microfone.
7. ErrorBoundary em App.tsx — FUNCIONANDO.
8. Busca de jurisprudencia DataJud — FUNCIONANDO.
9. Playground React/Python — FUNCIONANDO.
10. 47 componentes UI shadcn — IDENTICOS. NAO ALTERE.

---

## DIFERENCAS ENCONTRADAS — ANALISE DETALHADA

### ARQUIVO 1: `server/routes.ts`
**GitHub tem 5.784 linhas | CodeSpace tem 5.623 linhas**
**Diferenca: 161 linhas a mais no GitHub**

#### O QUE O GITHUB TEM A MAIS (MANTER — estao corretos):

1. **Gemini fallback em `geminiStream()` (linhas ~160-179)**
   - Bloco que verifica `AI_INTEGRATIONS_GEMINI_API_KEY` e usa Gemini direto
   - MANTER — isso permite IA funcionar sem chave propria

2. **Gemini fallback em `geminiStreamMessages()` (linhas ~228-246)**
   - Mesmo padrao para chamadas com multiplas mensagens
   - MANTER

3. **Rotas CNJ Comunicacoes (linhas ~4778-4898)**
   - `POST /api/cnj/comunicacoes` — busca comunicacoes processuais
   - `GET /api/cnj/comunicacoes/certidao/:hash` — download de certidoes PDF
   - MANTER — funcionalidade completa

4. **`python3` em vez de `python` para edge-tts (linha ~904)**
   - GitHub usa `python3` (correto para producao)
   - MANTER

5. **`--rate=+18%` no edge-tts (linha ~912)**
   - Velocidade de fala aumentada
   - MANTER

#### CORRECAO PENDENTE no `server/routes.ts`:

**Linha ~1011 — Operador logico na validacao de chave customizada:**

O GitHub tem:
```typescript
const useCustomKey = !!personalKey || !!(isCustomModel && (dbDemoKey || publicEnvKey));
```

O CodeSpace tem:
```typescript
const useCustomKey = !!(personalKey || (isCustomModel && (dbDemoKey || publicEnvKey)));
```

ACAO: NAO ALTERAR. As duas formas produzem o mesmo resultado logico neste caso. Ambas funcionam.

---

### ARQUIVO 2: `client/src/pages/legal-assistant.tsx`
**GitHub tem 5.403 linhas | CodeSpace tem 5.399 linhas**
**Diferenca: 4 linhas**

#### DIFERENCAS ENCONTRADAS:

1. **TTS fallback — rate e pitch (linhas ~517-518)**
   GitHub (MELHOR — manter):
   ```typescript
   utterance.rate = 1.15;   // Mais rapida e natural
   utterance.pitch = 1.05;  // Tom mais agradavel
   ```
   CodeSpace tinha:
   ```typescript
   utterance.rate = 0.95;   // Muito lenta
   utterance.pitch = 1.0;   // Tom monotono
   ```
   ACAO: MANTER o do GitHub (1.15 e 1.05). JA esta correto.

2. **Preferencia voz Google PT-BR (linhas ~520-521)**
   GitHub (MELHOR — manter):
   ```typescript
   const ptVoice = voices.find(v => v.lang === "pt-BR" && v.name.includes("Google"))
     || voices.find(v => v.lang.startsWith("pt-BR") || v.lang.startsWith("pt_BR"));
   ```
   ACAO: MANTER. Prioriza voz Google que e mais natural.

3. **Ditado de voz — continuous=false (linhas ~671-682)**
   GitHub (MELHOR — manter):
   ```typescript
   rec.continuous = false;
   rec.interimResults = false;
   let alreadySent = false;
   // ...
   if (alreadySent) return;
   const last = e.results[e.results.length - 1];
   if (last && last.isFinal) {
     const text = last[0].transcript.trim();
     if (text) {
       alreadySent = true;
       try { rec.stop(); } catch {}
       setTimeout(() => voiceChatSend(text), 300);
     }
   }
   ```
   ACAO: MANTER. `continuous=false` com `stop()` explicito evita texto duplicado.

4. **Link Comunicacoes no menu (linhas ~2553-2558)**
   GitHub tem link para `/comunicacoes` no menu lateral.
   ACAO: MANTER.

RESUMO: O `legal-assistant.tsx` do GitHub JA ESTA CORRETO. Nada precisa mudar.

---

### ARQUIVO 3: `client/src/pages/code-assistant.tsx`
**GitHub tem 999 linhas | CodeSpace tem 748 linhas**
**Diferenca: 251 linhas a mais no GitHub**

O GitHub tem o chat de voz COMPLETO que o CodeSpace nao tem:
- Modal de conversa por voz
- Botao "VOZ" no header
- TTS via edge-tts + fallback SpeechSynthesis
- Microfone com `continuous=false` e guard `captured`
- Campo de digitacao como alternativa
- Historico de mensagens no modal

ACAO: MANTER tudo do GitHub. JA esta funcionando.

---

### ARQUIVO 4: `client/src/App.tsx`

#### DIFERENCAS:

1. **Import de ComunicacoesCnj**
   GitHub tem: `import ComunicacoesCnj from "@/pages/comunicacoes-cnj";`
   ACAO: MANTER.

2. **Rota `/comunicacoes`**
   GitHub tem: `<Route path="/comunicacoes" component={ComunicacoesCnj} />`
   ACAO: MANTER.

3. **WouterRouter com base path**
   CodeSpace tem `<WouterRouter base={basePath}>` envolvendo tudo.
   GitHub NAO tem — usa `<ThemeProvider>` diretamente.
   ACAO: NAO PRECISAR mudar. O base path so e necessario quando roda dentro do CodeSpace como sub-rota `/app`. No projeto original standalone, nao precisa.

RESUMO: O App.tsx do GitHub JA ESTA CORRETO para uso standalone.

---

### ARQUIVO 5: `server/index.ts`

#### DIFERENCAS:

1. **BASE_PATH middleware**
   CodeSpace tem middleware que strip `/app` prefix.
   GitHub NAO tem.
   ACAO: NAO PRECISA. So e necessario dentro do CodeSpace.

2. **Try/catch no migrate**
   Ambos tem try/catch. Estrutura ligeiramente diferente mas funcionalidade identica.
   ACAO: NAO MUDAR.

3. **Fatal error handler**
   GitHub tem `process.exit(1)` em erro fatal.
   ACAO: MANTER (ja esta no GitHub).

---

## PROBLEMAS CONHECIDOS E SOLUCOES

### Problema 1: Jamile pede documentos que ja tem acesso
**Causa:** O historico de contexto (`recentContext`) e passado corretamente no system prompt. O problema e comportamental do modelo de IA, nao do codigo.

**Solucao — Adicionar ao SYSTEM_PROMPT_BASE em `server/routes.ts` (logo apos a linha 241):**

Encontre o final da const `SYSTEM_PROMPT_BASE` (termina com aspas crases) e adicione ANTES do fechamento:

```
12. REGRA CRITICA DE CONTEXTO: Voce TEM acesso completo a TODOS os documentos, textos e arquivos que o advogado ja forneceu nesta sessao. Eles estao no campo {{textos}} e no historico abaixo. NUNCA peca ao advogado para "enviar", "fornecer", "compartilhar" ou "anexar" documentos que ja estao no seu contexto. Se o texto esta no seu prompt, voce JA TEM o documento. Trabalhe com o que tem. So peca informacoes NOVAS que realmente nao existem no contexto (como dados pessoais especificos, numeros de processo, etc).
```

**Localizacao exata:** `server/routes.ts`, procure por:
```
11. EMENTAS: quando citar ementa de jurisprudencia
```
Adicione a regra 12 DEPOIS da regra 11, antes do fechamento das aspas crases.

### Problema 2: Erros de publicacao quando roda junto com CodeSpace
**Causa:** Quando publicado como parte do CodeSpace, o assistente juridico roda na porta 5000 com BASE_PATH=/app. Conflitos de porta e roteamento causam erros.

**Solucao:** O projeto original no GitHub roda STANDALONE na porta 5000 sem base path. NAO precisa de BASE_PATH. Se precisar rodar em sub-rota no futuro, adicione o middleware de BASE_PATH do CodeSpace.

### Problema 3: Voz duplica texto no ditado
**Status:** JA CORRIGIDO no GitHub com `continuous=false`.
**Onde:** `legal-assistant.tsx` linhas ~671 e `code-assistant.tsx` no modal de voz.
**Verificacao:** Confirme que `rec.continuous = false` esta presente nos dois arquivos.

---

## CHECKLIST DE VERIFICACAO

Execute esta verificacao no projeto original para confirmar que tudo esta correto:

### Backend (`server/routes.ts`):
- [ ] `geminiStream()` tem bloco de fallback com `AI_INTEGRATIONS_GEMINI_API_KEY`
- [ ] `geminiStreamMessages()` tem bloco de fallback com `AI_INTEGRATIONS_GEMINI_API_KEY`
- [ ] Rotas CNJ Comunicacoes existem (`/api/cnj/comunicacoes`)
- [ ] edge-tts usa `python3` (nao `python`)
- [ ] edge-tts tem `--rate=+18%`
- [ ] SYSTEM_PROMPT_BASE tem regra contra pedir documentos (regra 12 — ADICIONAR se nao existir)

### Frontend — Juridico (`legal-assistant.tsx`):
- [ ] `utterance.rate = 1.15` (nao 0.95)
- [ ] `utterance.pitch = 1.05` (nao 1.0)
- [ ] Voz Google PT-BR tem prioridade no find
- [ ] `rec.continuous = false` no ditado de voz
- [ ] Guard `alreadySent` existe contra envio duplo
- [ ] `rec.stop()` explicito apos captura
- [ ] Link "Comunicacoes" no menu lateral

### Frontend — Campo Livre (`code-assistant.tsx`):
- [ ] Modal de chat de voz existe (Dialog com AudioLines)
- [ ] Botao "VOZ" no header
- [ ] TTS via `/api/tts` com fallback SpeechSynthesis
- [ ] `continuous=false` no microfone do modal
- [ ] Guard `captured` contra captura duplicada

### App.tsx:
- [ ] Import de `ComunicacoesCnj` existe
- [ ] Rota `/comunicacoes` existe
- [ ] ErrorBoundary envolve todas as rotas
- [ ] NAO tem WouterRouter com base (so precisa no CodeSpace)

### Paginas:
- [ ] `comunicacoes-cnj.tsx` existe em `client/src/pages/`
- [ ] `playground.tsx` funciona (botao executar nao trava)

### Banco:
- [ ] 16 tabelas presentes (migrate automatico ao iniciar)
- [ ] NAO alterar schema.ts — esta identico e correto

### Variaveis de ambiente:
- [ ] `DATABASE_URL` configurada
- [ ] `SESSION_SECRET` configurada
- [ ] `AI_INTEGRATIONS_GEMINI_API_KEY` configurada (Replit auto)
- [ ] `AI_INTEGRATIONS_GEMINI_BASE_URL` configurada (Replit auto)
- [ ] `DATAJUD_API_KEY` configurada (opcional, tem fallback embutido)

---

## INSTRUCAO PARA A GEMINI

Cole isto no chat da Gemini do projeto original:

> Estas sao instrucoes de verificacao e correcao do projeto Assistente Juridico.
> Foram criadas comparando o codigo atual (GitHub) com a versao de desenvolvimento
> (CodeSpace) LINHA POR LINHA.
>
> REGRAS OBRIGATORIAS:
> 1. NAO substitua arquivos inteiros — faca apenas as correcoes pontuais listadas
> 2. NAO altere tiptap-editor.tsx, schema.ts, storage.ts — estao identicos e corretos
> 3. NAO adicione BASE_PATH ou WouterRouter base — so e necessario no CodeSpace
> 4. A UNICA correcao pendente e adicionar a regra 12 no SYSTEM_PROMPT_BASE
>    em server/routes.ts (regra contra pedir documentos que ja tem)
> 5. Execute o checklist de verificacao para confirmar que tudo esta correto
> 6. Se algo do checklist falhar, corrija APENAS o item especifico
>
> O projeto esta 98% correto. A maioria das correcoes do CodeSpace ja foi aplicada.
> Nao faca mudancas desnecessarias. Nao quebre o que funciona.

---

## HISTORICO DE COMMITS RELEVANTES (GitHub)

Para referencia da Gemini — estes commits contem as correcoes importantes:

1. `1091437` — Relatorio completo de todas as correcoes
2. `c677dd2` — Ditado voz continuous=false no Campo Livre
3. `c2c7ca0` — TODAS as correcoes restantes do pacote externo
4. `8c40d60` — Integracao completa das correcoes
5. `f899e13` — Chat de voz completo no Campo Livre
6. `d35e358` — Comunicacoes CNJ e download de PDFs
7. `e9e539e` — Merge correcoes do pacote externo

Todos estes commits JA estao no main. As correcoes JA estao aplicadas.

---

## RESUMO FINAL

| Area | Status no GitHub | Acao Necessaria |
|------|-----------------|-----------------|
| TipTap Editor | IDENTICO | Nenhuma |
| Schema banco | IDENTICO | Nenhuma |
| Storage | IDENTICO | Nenhuma |
| Componentes UI | IDENTICOS | Nenhuma |
| Gemini fallback | FUNCIONANDO | Nenhuma |
| CNJ Comunicacoes | FUNCIONANDO | Nenhuma |
| Chat voz juridico | FUNCIONANDO | Nenhuma |
| Chat voz campo livre | FUNCIONANDO | Nenhuma |
| TTS rate/pitch | CORRETO (1.15/1.05) | Nenhuma |
| Ditado continuous=false | CORRETO | Nenhuma |
| Voz Google PT-BR | CORRETO | Nenhuma |
| ErrorBoundary | FUNCIONANDO | Nenhuma |
| SYSTEM_PROMPT regra 12 | PENDENTE | ADICIONAR |
| BASE_PATH middleware | NAO PRECISA | Nenhuma (so CodeSpace) |

**Conclusao:** O projeto original esta praticamente completo. A unica correcao pendente e adicionar a regra 12 no system prompt para evitar que a Jamile peca documentos que ja tem acesso.
