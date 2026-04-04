import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable, settingsTable } from "@workspace/db";
import { AnalyzeFileBody, AnalyzeFolderBody, AiChatBody } from "@workspace/api-zod";
import { isBinaryFile, detectLanguage } from "../lib/storage.js";
import { ensureProjectOnDisk } from "../lib/persistFiles.js";
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

async function callAi(
  settings: { aiApiKey: string | null; aiBaseUrl: string | null; aiModel: string | null },
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  if (!settings.aiApiKey) {
    throw new Error("AI API key not configured. Please go to Settings and add your API key.");
  }

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

router.post("/ai/chat", async (req, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { messages, fileContext, filePath, projectId, projectContext, terminalContext, agentMode } = parsed.data;

  const settings = await getAiSettings();
  if (!settings?.aiApiKey) {
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

  const allMessages = [
    ...systemMessages,
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const reply = await callAi(settings, allMessages);
    res.json({ reply, model: settings.aiModel ?? "gpt-4o" });
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
  if (!settings?.aiApiKey) {
    res.status(400).json({ error: "AI API key not configured. Please go to Settings." });
    return;
  }

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
    const analysis = await callAi(settings, [
      { role: "user", content: prompt }
    ]);

    res.json({
      analysis,
      model: settings.aiModel ?? "gpt-4o",
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
  if (!settings?.aiApiKey) {
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
    const analysis = await callAi(settings, [
      { role: "user", content: prompt }
    ]);

    res.json({
      analysis,
      model: settings.aiModel ?? "gpt-4o",
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

  proc.on("close", (code) => {
    res.json({
      stdout: stdout.slice(-8000),
      stderr: stderr.slice(-4000),
      exitCode: code ?? 1,
    });
  });

  proc.on("error", (err) => {
    res.json({ stdout: "", stderr: err.message, exitCode: 1 });
  });
});

export default router;
