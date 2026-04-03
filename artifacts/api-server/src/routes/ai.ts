import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable, settingsTable } from "@workspace/db";
import { AnalyzeFileBody, AnalyzeFolderBody, AiChatBody } from "@workspace/api-zod";
import { isBinaryFile, detectLanguage } from "../lib/storage.js";
import path from "path";
import fs from "fs/promises";

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
      max_tokens: 2000,
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

  const { messages, fileContext, filePath } = parsed.data;

  const settings = await getAiSettings();
  if (!settings?.aiApiKey) {
    res.status(400).json({ error: "Chave de API da IA não configurada. Vá em Configurações." });
    return;
  }

  const systemMessages: Array<{ role: string; content: string }> = [];

  if (fileContext && filePath) {
    const language = detectLanguage(filePath);
    systemMessages.push({
      role: "system",
      content: `Você é um assistente especialista em código. O usuário está visualizando o arquivo "${filePath}".

Conteúdo do arquivo (${language}):
\`\`\`${language}
${fileContext}
\`\`\`

Responda de forma direta e clara, em português. Use markdown quando útil.`,
    });
  } else {
    systemMessages.push({
      role: "system",
      content: `Você é um assistente especialista em código e desenvolvimento de software. Responda de forma direta e clara, em português. Use markdown quando útil.`,
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

export default router;
