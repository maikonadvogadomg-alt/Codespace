import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { GetFileContentQueryParams, WriteFileBody, DeleteFileQueryParams } from "@workspace/api-zod";
import { detectLanguage, isBinaryFile } from "../lib/storage.js";
import path from "path";
import fs from "fs/promises";

const router: IRouter = Router();

router.get("/projects/:projectId/files", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const queryParsed = GetFileContentQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }

  const filePath = queryParsed.data.path;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedPath = filePath.replace(/^\//, "");
  const fullPath = path.join(project.storagePath, normalizedPath);

  const resolved = path.resolve(fullPath);
  const base = path.resolve(project.storagePath);
  if (!resolved.startsWith(base)) {
    res.status(400).json({ error: "Invalid path" });
    return;
  }

  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
      res.status(400).json({ error: "Path is not a file" });
      return;
    }
  } catch {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const binary = isBinaryFile(filePath);
  const language = detectLanguage(filePath);

  if (binary) {
    res.json({
      path: filePath,
      content: "[Binary file - content not available]",
      language: "plaintext",
      isBinary: true,
    });
    return;
  }

  try {
    const buffer = await fs.readFile(fullPath);
    const content = buffer.toString("utf-8");
    res.json({
      path: filePath,
      content,
      language,
      isBinary: false,
    });
  } catch {
    res.status(500).json({ error: "Could not read file" });
    return;
  }
});

async function resolveProjectPath(projectId: string, filePath: string): Promise<{ storagePath: string; fullPath: string } | null> {
  const id = parseInt(projectId, 10);
  if (isNaN(id)) return null;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) return null;
  const normalized = filePath.replace(/^\/+/, "");
  const fullPath = path.join(project.storagePath, normalized);
  const resolved = path.resolve(fullPath);
  const base = path.resolve(project.storagePath);
  if (!resolved.startsWith(base)) return null;
  return { storagePath: project.storagePath, fullPath };
}

router.put("/projects/:projectId/files", async (req, res): Promise<void> => {
  const parsed = WriteFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { path: filePath, content } = parsed.data;
  const resolved = await resolveProjectPath(req.params.projectId, filePath);
  if (!resolved) {
    res.status(400).json({ error: "Invalid project or path" });
    return;
  }

  await fs.mkdir(path.dirname(resolved.fullPath), { recursive: true });
  await fs.writeFile(resolved.fullPath, content, "utf-8");
  res.json({ path: filePath, message: "Arquivo salvo com sucesso" });
});

router.delete("/projects/:projectId/files", async (req, res): Promise<void> => {
  const queryParsed = DeleteFileQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }

  const resolved = await resolveProjectPath(req.params.projectId, queryParsed.data.path);
  if (!resolved) {
    res.status(400).json({ error: "Invalid project or path" });
    return;
  }

  try {
    await fs.unlink(resolved.fullPath);
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

export default router;
