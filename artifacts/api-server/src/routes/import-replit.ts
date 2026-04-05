import { Router, type IRouter } from "express";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ensureProjectDir,
  deleteProjectDir,
  countFiles,
} from "../lib/storage.js";
import { dbSaveDirectoryTree } from "../lib/persistFiles.js";
import AdmZip from "adm-zip";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";

const router: IRouter = Router();

const MAX_ZIP_SIZE = 200 * 1024 * 1024;
const MAX_ENTRIES = 5000;
const MAX_EXTRACTED_BYTES = 500 * 1024 * 1024;
const MAX_SINGLE_FILE = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;

function parseReplitUrl(url: string): { user: string; repl: string } | null {
  const cleaned = url.trim().replace(/\/$/, "");
  const patterns = [
    /^https?:\/\/replit\.com\/@([^/]+)\/([^/?#]+)/,
    /^@([^/]+)\/([^/?#]+)$/,
  ];
  for (const p of patterns) {
    const m = cleaned.match(p);
    if (m) return { user: m[1], repl: m[2] };
  }
  return null;
}

router.post("/projects/import-replit", async (req, res): Promise<void> => {
  const { replitUrl } = req.body as { replitUrl?: string };

  if (!replitUrl || typeof replitUrl !== "string") {
    res.status(400).json({ error: "replitUrl é obrigatório" });
    return;
  }

  const info = parseReplitUrl(replitUrl);
  if (!info) {
    res.status(400).json({
      error: "URL inválida. Use o formato: https://replit.com/@usuario/projeto",
    });
    return;
  }

  const { user, repl } = info;
  const zipUrl = `https://replit.com/@${user}/${repl}.zip`;

  let zipRes: Response;
  try {
    zipRes = await fetch(zipUrl, {
      headers: { "User-Agent": "CodeLens-App" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err: any) {
    res.status(502).json({ error: `Não foi possível conectar ao Replit: ${err.message}` });
    return;
  }

  if (!zipRes.ok) {
    res.status(400).json({
      error: `Não foi possível baixar o projeto (${zipRes.status}). Verifique se o link está correto e o projeto é público.`,
    });
    return;
  }

  const contentLength = parseInt(zipRes.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_ZIP_SIZE) {
    res.status(400).json({ error: `Projeto muito grande (${(contentLength / 1024 / 1024).toFixed(0)}MB). Limite: ${MAX_ZIP_SIZE / 1024 / 1024}MB.` });
    return;
  }

  const zipBuffer = Buffer.from(await zipRes.arrayBuffer());

  if (zipBuffer.length > MAX_ZIP_SIZE) {
    res.status(400).json({ error: `ZIP excede o limite de ${MAX_ZIP_SIZE / 1024 / 1024}MB.` });
    return;
  }

  if (zipBuffer.length < 100) {
    res.status(400).json({ error: "Arquivo baixado está vazio. Verifique se o projeto é público." });
    return;
  }

  const slug = randomUUID();
  const projectDir = await ensureProjectDir(slug);
  let insertedId: number | null = null;

  try {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    if (entries.length > MAX_ENTRIES) {
      throw new Error(`Projeto tem ${entries.length} arquivos, limite é ${MAX_ENTRIES}.`);
    }

    const entryNames = entries.map((e) => e.entryName);
    const firstPart = entryNames[0]?.split("/")[0] ?? "";
    const allHaveSameRoot =
      firstPart &&
      entryNames.every((n) => n.startsWith(firstPart + "/") || n === firstPart);
    const rootPrefix = allHaveSameRoot ? firstPart + "/" : "";

    const skipDirs = new Set(["node_modules", ".git", "dist", ".cache", "__pycache__", ".next"]);

    let totalExtracted = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      let entryName = entry.entryName;
      if (rootPrefix && entryName.startsWith(rootPrefix)) {
        entryName = entryName.slice(rootPrefix.length);
      }
      if (!entryName) continue;

      const parts = entryName.split("/");
      if (parts.some((p) => skipDirs.has(p))) continue;

      if (entry.header.size > MAX_SINGLE_FILE) continue;

      const data = entry.getData();
      totalExtracted += data.length;
      if (totalExtracted > MAX_EXTRACTED_BYTES) {
        throw new Error(`Tamanho total extraído excede o limite de ${MAX_EXTRACTED_BYTES / 1024 / 1024}MB.`);
      }

      const targetPath = path.join(projectDir, entryName);
      const resolvedTarget = path.resolve(targetPath);
      const resolvedBase = path.resolve(projectDir);
      if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) continue;

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, data);
    }

    const { count, sizeBytes } = await countFiles(projectDir);
    const projectName = `${repl} (Replit @${user})`;

    const [inserted] = await db
      .insert(projectsTable)
      .values({
        slug,
        name: projectName,
        storagePath: projectDir,
        fileCount: count,
        sizeBytes,
      })
      .returning();

    insertedId = inserted.id;

    await dbSaveDirectoryTree(inserted.id, projectDir);

    res.status(201).json({
      id: String(inserted.id),
      name: inserted.name,
      createdAt: inserted.createdAt.toISOString(),
      fileCount: inserted.fileCount,
      sizeBytes: inserted.sizeBytes,
    });
  } catch (err) {
    await deleteProjectDir(slug);
    if (insertedId !== null) {
      try {
        await db.delete(projectsTable).where(eq(projectsTable.id, insertedId));
      } catch {}
    }
    req.log.error({ err }, "Failed to import Replit project");
    const msg = err instanceof Error ? err.message : "Falha ao processar os arquivos do projeto";
    res.status(500).json({ error: msg });
    return;
  }
});

export default router;
