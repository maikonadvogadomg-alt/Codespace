import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable, settingsTable } from "@workspace/db";
import { AnalyzeFileBody, AnalyzeFolderBody, AiChatBody } from "@workspace/api-zod";
import { isBinaryFile, detectLanguage } from "../lib/storage.js";
import { ensureProjectOnDisk } from "../lib/persistFiles.js";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import fs from "fs/promises";

async function buildProjectContext(projectId: string): Promise<{ text: string; fileCount: number; truncated: boolean }> {
  const numId = parseInt(projectId, 10);
  if (isNaN(numId)) throw new Error("ID de projeto inválido");
  const rows = await db.select().from(projectsTable).where(eq(projectsTable.id, numId)).limit(1);
  const project = rows[0];
  if (!project) throw new Error("Projeto não encontrado");

  // Restore from DB if /tmp was wiped
  await ensureProjectOnDisk(project.id, project.storagePath);

  const projectDir = project.storagePath;
  const parts: string[] = [];
  let fileCount = 0;
  let totalChars = 0;
  const MAX_CHARS = 200_000;
  let truncated = false;

  const MAX_DEPTH = 10;
  const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".cache", "__pycache__", ".venv", "vendor"]);

  async function walk(dir: string, relBase: string, depth = 0) {
    if (depth > MAX_DEPTH) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const sorted = entries
      .filter(e => !e.name.startsWith(".") && !SKIP_DIRS.has(e.name))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    for (const entry of sorted) {
      const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, relPath, depth + 1);
      } else if (!isBinaryFile(relPath)) {
        if (totalChars >= MAX_CHARS) {
          truncated = true;
          continue;
        }
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          const lang = detectLanguage(relPath);
          const block = `// ═══ FILE: ${relPath} ═══\n\`\`\`${lang}\n${content}\n\`\`\`\n`;
          parts.push(block);
          totalChars += block.length;
          fileCount++;
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  await walk(projectDir, "");
  return { text: parts.join("\n"), fileCount, truncated };
}

const router: IRouter = Router();

async function getAiSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  return rows[0] ?? null;
}

function getGeminiFallback(): { apiKey: string; baseUrl: string; model: string } | null {
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (baseUrl && apiKey) {
    return { apiKey, baseUrl: baseUrl.replace(/\/$/, ""), model: "gemini-2.5-flash" };
  }
  return null;
}

async function callGemini(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: { apiVersion: "", baseUrl },
  });

  const systemParts: string[] = [];
  const nonSystemMessages = messages.filter((m) => {
    if (m.role === "system") {
      systemParts.push(m.content);
      return false;
    }
    return true;
  });

  const contents = nonSystemMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const config: { maxOutputTokens: number; systemInstruction?: string } = { maxOutputTokens: 8192 };
  if (systemParts.length > 0) {
    config.systemInstruction = systemParts.join("\n\n");
  }

  const response = await client.models.generateContent({
    model,
    contents,
    config,
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned empty response");
  }
  return text;
}

async function callOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 8000 }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI returned empty response");
  }
  return content;
}

async function callAi(
  settings: { aiApiKey: string | null; aiBaseUrl: string | null; aiModel: string | null },
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  if (settings.aiApiKey) {
    return callOpenAiCompatible(
      settings.aiBaseUrl ?? "https://api.openai.com/v1",
      settings.aiApiKey,
      settings.aiModel ?? "gpt-4o",
      messages
    );
  }

  const fallback = getGeminiFallback();
  if (!fallback) {
    throw new Error("AI API key not configured. Please go to Settings and add your API key.");
  }
  return callGemini(fallback.baseUrl, fallback.apiKey, fallback.model, messages);
}

router.post("/ai/chat", async (req, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { messages, fileContext, filePath, projectId, projectContext, terminalContext } = parsed.data;

  const settings = await getAiSettings();
  const effectiveSettings = {
    aiApiKey: settings?.aiApiKey ?? null,
    aiBaseUrl: settings?.aiBaseUrl ?? null,
    aiModel: settings?.aiModel ?? null,
  };
  if (!effectiveSettings.aiApiKey && !getGeminiFallback()) {
    res.status(400).json({ error: "Chave de API da IA não configurada. Vá em Configurações." });
    return;
  }

  const systemMessages: Array<{ role: string; content: string }> = [];

  const FILE_CHANGE_INSTRUCTIONS = `
Você tem TRÊS capacidades especiais — use os formatos abaixo quando apropriado. O sistema renderizará botões de ação para cada bloco.

1. CRIAR OU EDITAR arquivo:
<codelens-write path="caminho/do/arquivo.ts">
conteúdo completo do arquivo aqui
</codelens-write>

2. DELETAR arquivo:
<codelens-delete path="caminho/do/arquivo.ts"/>

3. SUGERIR COMANDO para o terminal (npm install, git, node, etc.):
<codelens-exec>npm install axios</codelens-exec>

REGRAS IMPORTANTES:
- Caminhos sempre relativos à raiz do projeto, sem / inicial
- Conteúdo COMPLETO no bloco write (nunca use "..." ou "resto do código aqui")
- Pode combinar múltiplos blocos write + exec em uma única resposta
- Para instalar pacotes: use <codelens-exec>npm install nome-do-pacote</codelens-exec>
- Para banco de dados: SQLite usa "better-sqlite3" ou "drizzle-orm", Postgres usa "pg" ou "drizzle-orm/node-postgres"
- Explique em PORTUGUÊS o que você está fazendo antes de cada bloco
- Quando houver múltiplas etapas (instalar + criar arquivo + configurar), faça tudo em sequência na mesma resposta`;

  if (projectContext && projectId) {
    try {
      const { text, fileCount, truncated } = await buildProjectContext(projectId);
      systemMessages.push({
        role: "system",
        content: `Voce e um engenheiro de software senior. Objetivo e direto. Sem gentilezas, sem desculpas, sem rodeios. Se tem problema, corrija. Se tem duvida, pergunte uma vez so.
${truncated ? `\n⚠️ Projeto grande — incluidos os primeiros ${fileCount} arquivos (limite 200k chars).` : `\nProjeto com ${fileCount} arquivo(s). Voce tem acesso a TODOS.`}

REGRAS DE COMPORTAMENTO:
1. NUNCA diga "desculpe", "com certeza", "fico feliz em ajudar" ou qualquer gentileza. Va direto ao ponto.
2. Se o usuario pedir correcao, CORRIJA. Nao pergunte se quer. Faca.
3. Se encontrar bug, mostre a causa em 1 frase e forneca a correcao pronta com bloco de acao.
4. Se pressionado ou o usuario ficar frustrado, mantenha foco tecnico. Responda com solucao, nao com desculpa.
5. Respostas em PORTUGUES, formatadas com markdown.
6. Nunca diga "nao posso". Se e complexo, faca por etapas.

PRIORIDADES DE ANALISE:
1. ESTRUTURA — Ponto de entrada, fluxo de execucao, arquitetura geral
2. BUGS — Detecte quebras e vulnerabilidades. Corrija imediatamente com blocos de acao
3. COMPONENTES — So depois analise funcionalidades especificas

CAPACIDADES:
- Voce pode criar, editar e deletar arquivos do projeto usando blocos de acao
- Voce pode sugerir comandos de terminal (npm install, git, etc)
- Voce pode refatorar codigo, reorganizar arquivos, corrigir bugs
- Voce pode fazer tudo que um programador faria — use essa autonomia
- Apos corrigir, o usuario pode aplicar com um clique e voce pode sugerir commit e push

Abaixo esta o conteudo completo do projeto:

${text}

Ao referenciar codigo, cite o arquivo pelo caminho.
${FILE_CHANGE_INSTRUCTIONS}`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao carregar projeto";
      res.status(400).json({ error: message });
      return;
    }
  } else if (fileContext && filePath) {
    const language = detectLanguage(filePath);
    systemMessages.push({
      role: "system",
      content: `Voce e um engenheiro de software senior. Objetivo e direto. Sem gentilezas. O usuario esta no arquivo "${filePath}".

Conteudo do arquivo (${language}):
\`\`\`${language}
${fileContext}
\`\`\`

REGRAS: Respostas em portugues, diretas, com markdown. Se encontrar bug, corrija com bloco de acao. Nunca diga "desculpe" ou "com certeza". Va ao ponto.
${FILE_CHANGE_INSTRUCTIONS}`,
    });
  } else {
    systemMessages.push({
      role: "system",
      content: `Voce e um engenheiro de software senior. Objetivo e direto. Sem gentilezas, sem desculpas. Respostas em portugues com markdown. Se encontrar problema, corrija com bloco de acao. Nunca diga "desculpe", "com certeza" ou "fico feliz". Va direto ao ponto.
${FILE_CHANGE_INSTRUCTIONS}`,
    });
  }

  // Inject terminal context as an extra system message if provided
  if (terminalContext && terminalContext.trim()) {
    systemMessages.push({
      role: "system",
      content: `📟 SAÍDA RECENTE DO TERMINAL DO USUÁRIO:
\`\`\`
${terminalContext.trim().slice(0, 8000)}
\`\`\`
Use esse contexto para entender erros recentes e ajudar o usuário a corrigir os problemas sem precisar que ele copie e cole os erros.`,
    });
  }

  const allMessages = [
    ...systemMessages,
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const reply = await callAi(effectiveSettings, allMessages);
    res.json({ reply, model: effectiveSettings.aiModel ?? (getGeminiFallback()?.model ?? "gpt-4o") });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro na IA";
    req.log.error({ err }, "AI chat failed");
    res.status(400).json({ error: message });
    return;
  }
});

router.post("/ai/analyze-file", async (req, res): Promise<void> => {
  const parsed = AnalyzeFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { projectId, filePath, content } = parsed.data;

  const settings = await getAiSettings();
  if (!settings?.aiApiKey && !getGeminiFallback()) {
    res.status(400).json({ error: "AI API key not configured. Please go to Settings." });
    return;
  }

  const language = detectLanguage(filePath);
  const filename = path.basename(filePath);

  const prompt = `Voce e um analista de codigo objetivo e direto. Analise este arquivo e responda em portugues:
1. O que este arquivo faz (1-2 frases)
2. Padroes e responsabilidades principais
3. Bugs, problemas ou melhorias que voce identifica — se encontrar, mostre a correcao
4. Qualidade geral do codigo

Arquivo: ${filename} (${language})
Caminho: ${filePath}

\`\`\`${language}
${content.slice(0, 8000)}
\`\`\`

Seja direto. Sem rodeios. Se tem bug, mostre a correcao pronta.`;

  try {
    const effectiveSettings = {
      aiApiKey: settings?.aiApiKey ?? null,
      aiBaseUrl: settings?.aiBaseUrl ?? null,
      aiModel: settings?.aiModel ?? null,
    };
    const analysis = await callAi(effectiveSettings, [
      { role: "user", content: prompt }
    ]);

    res.json({
      analysis,
      model: effectiveSettings.aiModel ?? (getGeminiFallback()?.model ?? "gpt-4o"),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown AI error";
    req.log.error({ err }, "AI analysis failed");
    res.status(400).json({ error: message });
    return;
  }
});

router.post("/ai/analyze-folder", async (req, res): Promise<void> => {
  const parsed = AnalyzeFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { projectId, folderPath } = parsed.data;

  const id = parseInt(projectId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const settings = await getAiSettings();
  if (!settings?.aiApiKey && !getGeminiFallback()) {
    res.status(400).json({ error: "AI API key not configured. Please go to Settings." });
    return;
  }

  const normalizedFolder = folderPath.replace(/^\//, "");
  const fullFolderPath = normalizedFolder
    ? path.join(project.storagePath, normalizedFolder)
    : project.storagePath;

  const resolved = path.resolve(fullFolderPath);
  const base = path.resolve(project.storagePath);
  if (!resolved.startsWith(base)) {
    res.status(400).json({ error: "Invalid folder path" });
    return;
  }

  interface FileEntry {
    path: string;
    language: string;
    preview: string;
  }

  const fileEntries: FileEntry[] = [];

  async function collectFiles(dir: string, prefix: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        if (entry.startsWith(".")) continue;
        const fullPath = path.join(dir, entry);
        const rel = prefix ? `${prefix}/${entry}` : entry;
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await collectFiles(fullPath, rel);
        } else if (!isBinaryFile(entry)) {
          try {
            const buf = await fs.readFile(fullPath);
            const preview = buf.toString("utf-8").slice(0, 500);
            fileEntries.push({
              path: rel,
              language: detectLanguage(entry),
              preview,
            });
          } catch {
            fileEntries.push({ path: rel, language: detectLanguage(entry), preview: "" });
          }
        }
      }
    } catch {
    }
  }

  await collectFiles(fullFolderPath, "");

  const folderName = normalizedFolder ? path.basename(normalizedFolder) : project.name;
  const filesOverview = fileEntries.slice(0, 30).map((f) =>
    `- ${f.path} (${f.language})${f.preview ? `\n  Preview: ${f.preview.slice(0, 200).replace(/\n/g, " ")}` : ""}`
  ).join("\n");

  const prompt = `Voce e um analista de codigo objetivo e direto. Analise esta pasta e responda em portugues:
1. Proposito e funcao desta pasta no projeto
2. Tipos de arquivos e codigo que contem
3. Como se encaixa na arquitetura geral
4. Padroes e convencoes observados
5. Avaliacao da organizacao — se tem problema, aponte

Pasta: ${folderName}
Projeto: ${project.name}
Arquivos analisados: ${fileEntries.length}

Arquivos nesta pasta:
${filesOverview}

Seja direto e objetivo. Sem rodeios.`;

  try {
    const effectiveSettings = {
      aiApiKey: settings?.aiApiKey ?? null,
      aiBaseUrl: settings?.aiBaseUrl ?? null,
      aiModel: settings?.aiModel ?? null,
    };
    const analysis = await callAi(effectiveSettings, [
      { role: "user", content: prompt }
    ]);

    res.json({
      analysis,
      model: effectiveSettings.aiModel ?? (getGeminiFallback()?.model ?? "gpt-4o"),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown AI error";
    req.log.error({ err }, "AI folder analysis failed");
    res.status(400).json({ error: message });
    return;
  }
});

router.post("/ai/tts", async (req, res): Promise<void> => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "Texto é obrigatório" });
    return;
  }

  const cleanText = text.slice(0, 3000);

  try {
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const { tmpdir } = await import("os");
    const execFileAsync = promisify(execFile);
    const tmpPath = path.join(tmpdir(), `tts-${Date.now()}.mp3`);

    await execFileAsync(
      "python3",
      [
        "-m", "edge_tts",
        "--voice", "pt-BR-FranciscaNeural",
        "--rate", "+18%",
        "--text", cleanText,
        "--write-media", tmpPath,
      ],
      { timeout: 30000 }
    );

    const audioBuffer = await fs.readFile(tmpPath);
    fs.unlink(tmpPath).catch(() => {});

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBuffer.length),
      "Cache-Control": "no-cache",
    });
    res.send(audioBuffer);
  } catch (err: unknown) {
    req.log.error({ err }, "TTS failed");
    res.status(500).json({ error: "Falha ao gerar áudio" });
  }
});

export default router;
