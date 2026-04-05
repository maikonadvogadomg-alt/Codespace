import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable, settingsTable } from "@workspace/db";
import { AnalyzeFileBody, AnalyzeFolderBody, AiChatBody } from "@workspace/api-zod";
import { isBinaryFile, detectLanguage } from "../lib/storage.js";
import { ensureProjectOnDisk } from "../lib/persistFiles.js";
import path from "path";
import fs from "fs/promises";
import { GoogleGenAI } from "@google/genai";

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CodeSpace/1.0)",
        "Accept": "text/html,application/xhtml+xml,text/plain,application/json,*/*",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("image") || contentType.includes("video") || contentType.includes("audio") || contentType.includes("octet-stream")) {
      return null;
    }
    const raw = await res.text();
    const text = raw
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 30000);
  } catch {
    return null;
  }
}

async function extractUrlContents(text: string): Promise<Array<{ url: string; content: string }>> {
  const urls = [...new Set(text.match(URL_REGEX) ?? [])].slice(0, 3);
  if (urls.length === 0) return [];
  const results: Array<{ url: string; content: string }> = [];
  await Promise.all(
    urls.map(async (url) => {
      const content = await fetchUrlContent(url);
      if (content && content.length > 50) {
        results.push({ url, content });
      }
    })
  );
  return results;
}

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

  async function walk(dir: string, relBase: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const sorted = entries
      .filter(e => !e.name.startsWith("."))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    for (const entry of sorted) {
      const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, relPath);
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

const GEMINI_CORTESIA_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? null;
const GEMINI_CORTESIA_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ?? null;
const GEMINI_CORTESIA_MODEL = "gemini-2.5-flash";

const geminiCortesiaClient = (GEMINI_CORTESIA_KEY && GEMINI_CORTESIA_URL)
  ? new GoogleGenAI({
      apiKey: GEMINI_CORTESIA_KEY,
      httpOptions: { apiVersion: "", baseUrl: GEMINI_CORTESIA_URL },
    })
  : null;

async function callGeminiCortesia(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  if (!geminiCortesiaClient) {
    throw new Error("Gemini cortesia não disponível. Configure uma chave de IA nas Configurações.");
  }

  const systemMsgs = messages.filter(m => m.role === "system").map(m => m.content);
  const nonSystemMsgs = messages.filter(m => m.role !== "system");

  const fullPrompt = [
    ...systemMsgs,
    ...nonSystemMsgs.map(m => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`),
  ].join("\n\n");

  const result = await geminiCortesiaClient.models.generateContent({
    model: GEMINI_CORTESIA_MODEL,
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    config: { maxOutputTokens: 8000, temperature: 0.7 },
  });

  const content = result.text;
  if (!content) throw new Error("Gemini retornou resposta vazia");
  return content;
}

async function callUserKey(
  settings: { aiApiKey: string; aiBaseUrl: string | null; aiModel: string | null },
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const baseUrl = settings.aiBaseUrl ?? "https://api.openai.com/v1";
  const model = settings.aiModel ?? "gpt-4o";
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.aiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    model: string;
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
): Promise<{ text: string; provider: string }> {
  if (geminiCortesiaClient) {
    const text = await callGeminiCortesia(messages);
    return { text, provider: "gemini-cortesia" };
  }

  if (settings.aiApiKey) {
    const text = await callUserKey(
      { aiApiKey: settings.aiApiKey, aiBaseUrl: settings.aiBaseUrl, aiModel: settings.aiModel },
      messages
    );
    return { text, provider: "user" };
  }

  throw new Error("Nenhuma IA disponível. Configure uma chave de API nas Configurações (engrenagem no canto inferior esquerdo).");
}

router.post("/ai/chat", async (req, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { messages, fileContext, filePath, projectId, projectContext, terminalContext, agentMode } = parsed.data;

  const settings = await getAiSettings();

  const systemMessages: Array<{ role: string; content: string }> = [];

  const FILE_CHANGE_INSTRUCTIONS = `
Você tem TRÊS capacidades especiais — use os formatos abaixo quando apropriado. O sistema renderizará botões de ação para cada bloco.

1. CRIAR OU EDITAR arquivo:
<codelens-write path="caminho/do/arquivo.ts">
conteúdo completo do arquivo aqui
</codelens-write>

2. DELETAR arquivo:
<codelens-delete path="caminho/do/arquivo.ts"/>

3. EXECUTAR COMANDO no terminal (qualquer comando do sistema):
<codelens-exec>npm install axios</codelens-exec>

⚠️ VOCÊ TEM ACESSO TOTAL AO TERMINAL E AO SISTEMA DE ARQUIVOS DO PROJETO.
Você PODE e DEVE executar qualquer comando necessário:
- Listar arquivos: <codelens-exec>ls -la</codelens-exec>
- Mover arquivos: <codelens-exec>mv arquivo.txt pasta/</codelens-exec>
- Copiar arquivos: <codelens-exec>cp arquivo.txt copia.txt</codelens-exec>
- Renomear arquivos: <codelens-exec>mv nome_antigo.txt nome_novo.txt</codelens-exec>
- Criar pastas: <codelens-exec>mkdir -p nova_pasta</codelens-exec>
- Deletar arquivos/pastas: <codelens-exec>rm -rf pasta_antiga</codelens-exec>
- Descompactar arquivos: <codelens-exec>tar -xzf arquivo.tar.gz</codelens-exec> ou <codelens-exec>unzip arquivo.zip</codelens-exec>
- Buscar arquivos: <codelens-exec>find . -name "*.tar.gz"</codelens-exec>
- Ver conteúdo: <codelens-exec>cat arquivo.txt</codelens-exec>
- Instalar pacotes: <codelens-exec>npm install pacote</codelens-exec>
- Rodar scripts: <codelens-exec>node script.js</codelens-exec>
- Git: <codelens-exec>git clone URL</codelens-exec>, <codelens-exec>git add . && git commit -m "msg"</codelens-exec>
- Qualquer outro comando bash/shell

NUNCA diga "eu não tenho acesso ao sistema de arquivos" — você TEM acesso via <codelens-exec>.
NUNCA peça para o usuário executar comandos manualmente — EXECUTE você mesmo via <codelens-exec>.
Se o usuário pedir para mover, copiar, renomear, deletar, descompactar, ou organizar arquivos — FAÇA DIRETAMENTE.
Se não souber onde está um arquivo, use <codelens-exec>find . -name "nome*"</codelens-exec> para procurar.

REGRAS ADICIONAIS:
- Caminhos sempre relativos à raiz do projeto, sem / inicial
- Conteúdo COMPLETO no bloco write (nunca use "..." ou "resto do código aqui")
- Pode combinar múltiplos blocos write + exec em uma única resposta
- Para instalar pacotes: use <codelens-exec>npm install nome-do-pacote</codelens-exec>
- Explique em PORTUGUÊS o que você está fazendo antes de cada bloco
- Quando houver múltiplas etapas (instalar + criar arquivo + configurar), faça tudo em sequência na mesma resposta
- O usuário NÃO entende de código — explique de forma simples e faça tudo por ele

4. MOSTRAR IMAGENS, DIAGRAMAS E FIGURAS:
Você pode exibir imagens e diagramas usando Markdown:
- Imagem da web: ![descrição](https://url-da-imagem.com/imagem.png)
- Diagrama SVG inline: Escreva o código SVG diretamente na resposta usando \`\`\`svg ... \`\`\` e o sistema renderizará o diagrama
- Use diagramas para explicar arquiteturas, fluxos, estruturas de pastas, etc.
- Use tabelas Markdown para comparações e dados organizados
- Use formatação rica: **negrito**, *itálico*, listas, títulos (## ##), linhas (---), blocos de código

Exemplo de diagrama SVG:
\`\`\`svg
<svg width="300" height="100" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="120" height="40" rx="8" fill="#3b82f6" />
  <text x="70" y="35" text-anchor="middle" fill="white" font-size="14">Frontend</text>
  <line x1="130" y1="30" x2="170" y2="30" stroke="#888" stroke-width="2" marker-end="url(#arrow)"/>
  <rect x="170" y="10" width="120" height="40" rx="8" fill="#10b981" />
  <text x="230" y="35" text-anchor="middle" fill="white" font-size="14">Backend</text>
</svg>
\`\`\`

SEMPRE que puder ilustrar algo visualmente, USE diagramas SVG ou imagens para facilitar o entendimento.`;

  const AGENT_MODE_INSTRUCTIONS = `
🤖 MODO AGENTE ATIVO — Você tem execução AUTOMÁTICA de comandos e arquivos.
Quando você usa <codelens-exec> ou <codelens-write>, o sistema EXECUTA automaticamente e te mostra o resultado.
Você DEVE agir como um agente autônomo:
- Diagnostique o problema executando comandos (ls, cat, npm ls, etc.)
- Instale dependências se necessário (npm install)
- Crie ou edite arquivos para corrigir erros
- Após cada ação, analise o resultado e continue até resolver
- Se um comando falhar, tente outra abordagem
- NUNCA peça permissão — EXECUTE diretamente
- Quando terminar, diga claramente "✅ Pronto!" e explique o que fez
- Limite: máximo 10 ações por turno para evitar loops infinitos`;

  const agentInstructions = agentMode ? AGENT_MODE_INSTRUCTIONS : "";

  if (projectContext && projectId) {
    try {
      const { text, fileCount, truncated } = await buildProjectContext(projectId);
      systemMessages.push({
        role: "system",
        content: `Você é um assistente especialista em código com acesso ao projeto completo e capacidade de propor alterações nos arquivos.
${truncated ? `\n⚠️ O projeto é grande — foram incluídos os primeiros ${fileCount} arquivos (limite de 200k caracteres).` : `\nO projeto contém ${fileCount} arquivo(s) de código.`}

Abaixo está o conteúdo completo do projeto:

${text}

Use markdown quando útil. Ao referenciar código, cite o arquivo pelo caminho.
${FILE_CHANGE_INSTRUCTIONS}
${agentInstructions}`,
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
      content: `Você é um assistente especialista em código com capacidade de propor alterações nos arquivos. O usuário está visualizando o arquivo "${filePath}".

Conteúdo do arquivo (${language}):
\`\`\`${language}
${fileContext}
\`\`\`

Use markdown quando útil.
${FILE_CHANGE_INSTRUCTIONS}`,
    });
  } else {
    systemMessages.push({
      role: "system",
      content: `Você é um assistente especialista em código e desenvolvimento de software com capacidade de propor alterações nos arquivos. Use markdown quando útil.
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

  const lastUserMsg = messages.filter(m => m.role === "user").pop();
  if (lastUserMsg) {
    const urlContents = await extractUrlContents(lastUserMsg.content);
    if (urlContents.length > 0) {
      const urlContext = urlContents.map(u =>
        `🌐 CONTEÚDO DO LINK: ${u.url}\n\`\`\`\n${u.content.slice(0, 15000)}\n\`\`\``
      ).join("\n\n");
      systemMessages.push({
        role: "system",
        content: `O usuário enviou link(s). Abaixo está o conteúdo extraído das páginas web. Use este conteúdo para responder de forma precisa.\n\n${urlContext}`,
      });
    }
  }

  const allMessages = [
    ...systemMessages,
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const aiSettings = {
      aiApiKey: settings?.aiApiKey ?? null,
      aiBaseUrl: settings?.aiBaseUrl ?? null,
      aiModel: settings?.aiModel ?? null,
    };
    const result = await callAi(aiSettings, allMessages);
    const usedModel = result.provider === "user" ? (aiSettings.aiModel ?? "gpt-4o") : GEMINI_CORTESIA_MODEL;
    res.json({ reply: result.text, model: usedModel, provider: result.provider });
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

  const language = detectLanguage(filePath);
  const filename = path.basename(filePath);

  const prompt = `You are an expert code reviewer. Analyze the following file and provide:
1. A brief description of what this file does
2. The main responsibilities and patterns used
3. Any potential issues, bugs, or improvements you notice
4. A summary of the overall code quality

File: ${filename} (${language})
Path: ${filePath}

\`\`\`${language}
${content.slice(0, 8000)}
\`\`\`

Provide a clear, structured analysis. Be concise but thorough.`;

  try {
    const aiS = { aiApiKey: settings?.aiApiKey ?? null, aiBaseUrl: settings?.aiBaseUrl ?? null, aiModel: settings?.aiModel ?? null };
    const result = await callAi(aiS, [
      { role: "user", content: prompt }
    ]);

    res.json({
      analysis: result.text,
      model: result.provider === "user" ? (aiS.aiModel ?? "gpt-4o") : GEMINI_CORTESIA_MODEL,
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

  const prompt = `You are an expert code reviewer. Analyze the following folder from a software project and explain:
1. The purpose and role of this folder in the overall project
2. What types of files and code it contains
3. How it fits into the larger project architecture
4. Any patterns or conventions you observe
5. A brief assessment of the code organization

Folder: ${folderName}
Project: ${project.name}
Total files analyzed: ${fileEntries.length}

Files in this folder:
${filesOverview}

Provide a clear, structured analysis of what this folder's role is in the project.`;

  try {
    const aiS = { aiApiKey: settings?.aiApiKey ?? null, aiBaseUrl: settings?.aiBaseUrl ?? null, aiModel: settings?.aiModel ?? null };
    const result = await callAi(aiS, [
      { role: "user", content: prompt }
    ]);

    res.json({
      analysis: result.text,
      model: result.provider === "user" ? (aiS.aiModel ?? "gpt-4o") : GEMINI_CORTESIA_MODEL,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown AI error";
    req.log.error({ err }, "AI folder analysis failed");
    res.status(400).json({ error: message });
    return;
  }
});

router.post("/ai/agent-exec", async (req, res): Promise<void> => {
  const { projectId, command } = req.body;
  if (!projectId || !command) {
    res.status(400).json({ error: "projectId and command are required" });
    return;
  }

  const numId = parseInt(projectId, 10);
  if (isNaN(numId)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const rows = await db.select().from(projectsTable).where(eq(projectsTable.id, numId)).limit(1);
  const project = rows[0];
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await ensureProjectOnDisk(project.id, project.storagePath);

  const BLOCKED = [
    /rm\s+-rf\s+\//,
    /mkfs/,
    /dd\s+if=.*of=\/dev/,
    /shutdown|reboot|halt|poweroff/,
    /curl.*\|\s*(bash|sh)/,
  ];
  if (BLOCKED.some(p => p.test(command))) {
    res.json({ stdout: "", stderr: "Comando bloqueado por segurança.", exitCode: 1 });
    return;
  }

  const { spawn } = await import("child_process");
  const { dbSaveDirectoryTree } = await import("../lib/persistFiles.js");
  const { countFiles } = await import("../lib/storage.js");

  const proc = spawn("bash", ["-c", command], {
    cwd: project.storagePath,
    env: {
      ...process.env,
      PATH: `${project.storagePath}/node_modules/.bin:${process.env.PATH}`,
      HOME: process.env.HOME || "/home/runner",
    },
    timeout: 120_000,
  });

  let stdout = "";
  let stderr = "";
  proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
  proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

  proc.on("close", async (code) => {
    const exitCode = code ?? 1;
    if (exitCode === 0) {
      try {
        await dbSaveDirectoryTree(numId, project.storagePath);
        const { count, sizeBytes } = await countFiles(project.storagePath);
        await db.update(projectsTable)
          .set({ fileCount: count, sizeBytes })
          .where(eq(projectsTable.id, numId));
      } catch {}
    }
    res.json({
      stdout: stdout.slice(-8000),
      stderr: stderr.slice(-4000),
      exitCode,
    });
  });

  proc.on("error", (err) => {
    res.json({ stdout: "", stderr: err.message, exitCode: 1 });
  });
});

router.get("/ai/status", async (_req, res): Promise<void> => {
  const settings = await getAiSettings();
  const hasUserKey = !!settings?.aiApiKey;
  const hasGeminiCortesia = !!GEMINI_CORTESIA_KEY && !!GEMINI_CORTESIA_URL;
  const available = hasUserKey || hasGeminiCortesia;
  res.json({
    available,
    provider: hasUserKey ? "user" : hasGeminiCortesia ? "gemini-cortesia" : "none",
    model: hasUserKey ? (settings?.aiModel ?? "gpt-4o") : hasGeminiCortesia ? GEMINI_CORTESIA_MODEL : null,
  });
});

export default router;
