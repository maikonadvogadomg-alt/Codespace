import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import {
  ListProjectsResponse,
  GetProjectParams,
  GetProjectResponse,
  DeleteProjectParams,
} from "@workspace/api-zod";
import {
  ensureProjectDir,
  deleteProjectDir,
  buildFileTree,
  countFiles,
} from "../lib/storage.js";
import multer from "multer";
import AdmZip from "adm-zip";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const router: IRouter = Router();

router.get("/projects", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(projectsTable)
    .orderBy(projectsTable.createdAt);

  res.json(
    ListProjectsResponse.parse(
      rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        createdAt: r.createdAt.toISOString(),
        fileCount: r.fileCount,
        sizeBytes: r.sizeBytes,
      }))
    )
  );
});

router.post(
  "/projects",
  upload.single("file"),
  async (req, res): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    if (!file.originalname.endsWith(".zip")) {
      res.status(400).json({ error: "Only .zip files are supported" });
      return;
    }

    const name =
      (req.body.name as string) ||
      path.basename(file.originalname, ".zip") ||
      "untitled";
    const slug = `${randomUUID()}`;

    const projectDir = await ensureProjectDir(slug);

    try {
      const zip = new AdmZip(file.buffer);
      const entries = zip.getEntries();

      let extractedFiles = 0;

      for (const entry of entries) {
        if (entry.isDirectory) continue;

        let entryName = entry.entryName;
        const parts = entryName.split("/");
        if (parts.length > 1 && entries.every((e) => e.entryName.startsWith(parts[0] + "/"))) {
          entryName = parts.slice(1).join("/");
        }

        if (!entryName) continue;

        const targetPath = path.join(projectDir, entryName);
        const targetDir = path.dirname(targetPath);
        await fs.mkdir(targetDir, { recursive: true });

        const content = entry.getData();
        await fs.writeFile(targetPath, content);
        extractedFiles++;
      }

      if (extractedFiles === 0) {
        zip.extractAllTo(projectDir, true);
      }

      const { count, sizeBytes } = await countFiles(projectDir);

      const [inserted] = await db
        .insert(projectsTable)
        .values({
          slug,
          name,
          storagePath: projectDir,
          fileCount: count,
          sizeBytes,
        })
        .returning();

      res.status(201).json({
        id: String(inserted.id),
        name: inserted.name,
        createdAt: inserted.createdAt.toISOString(),
        fileCount: inserted.fileCount,
        sizeBytes: inserted.sizeBytes,
      });
    } catch (err) {
      await deleteProjectDir(slug);
      req.log.error({ err }, "Failed to extract ZIP");
      res.status(400).json({ error: "Failed to extract ZIP file" });
      return;
    }
  }
);

router.get("/projects/:projectId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const params = GetProjectParams.safeParse({ projectId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const tree = await buildFileTree(project.storagePath);

  res.json(
    GetProjectResponse.parse({
      id: String(project.id),
      name: project.name,
      createdAt: project.createdAt.toISOString(),
      fileCount: project.fileCount,
      sizeBytes: project.sizeBytes,
      tree: { ...tree, name: project.name, path: "" },
    })
  );
});

router.delete("/projects/:projectId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const params = DeleteProjectParams.safeParse({ projectId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await deleteProjectDir(project.slug);
  await db.delete(projectsTable).where(eq(projectsTable.id, id));

  res.sendStatus(204);
});

export default router;
