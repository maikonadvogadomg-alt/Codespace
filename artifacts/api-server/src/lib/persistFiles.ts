/**
 * Persistent file storage using PostgreSQL.
 * Ensures project files survive server restarts and redeployments.
 */
import { db, projectsTable, projectFilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { ensureProjectDir } from "./storage.js";

/** Save a single file to the database (upsert). */
export async function dbSaveFile(projectId: number, filePath: string, content: string): Promise<void> {
  const normalized = filePath.replace(/^\/+/, "");
  await db
    .insert(projectFilesTable)
    .values({ projectId, path: normalized, content })
    .onConflictDoUpdate({
      target: [projectFilesTable.projectId, projectFilesTable.path],
      set: { content, updatedAt: new Date() },
    });
}

/** Delete a single file from the database. */
export async function dbDeleteFile(projectId: number, filePath: string): Promise<void> {
  const normalized = filePath.replace(/^\/+/, "");
  await db
    .delete(projectFilesTable)
    .where(
      and(
        eq(projectFilesTable.projectId, projectId),
        eq(projectFilesTable.path, normalized)
      )
    );
}

/** Delete all files for a project from the database. */
export async function dbDeleteAllFiles(projectId: number): Promise<void> {
  await db.delete(projectFilesTable).where(eq(projectFilesTable.projectId, projectId));
}

/**
 * Restore a project directory from the database.
 * Called when the /tmp directory is missing (after server restart/redeploy).
 * Returns true if files were restored, false if no files found in DB.
 */
export async function restoreProjectFromDb(projectId: number, storagePath: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(projectFilesTable)
    .where(eq(projectFilesTable.projectId, projectId));

  if (rows.length === 0) return false;

  await fs.mkdir(storagePath, { recursive: true });

  await Promise.all(
    rows.map(async (row) => {
      const fullPath = path.join(storagePath, row.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, row.content, "utf-8");
    })
  );

  return true;
}

/**
 * Ensure the project directory exists on disk.
 * If it's missing, restore from DB. If DB also has nothing, just create empty dir.
 */
export async function ensureProjectOnDisk(projectId: number, storagePath: string): Promise<void> {
  try {
    await fs.stat(storagePath);
    // Dir exists — nothing to do
  } catch {
    // Dir missing — restore from DB
    const restored = await restoreProjectFromDb(projectId, storagePath);
    if (!restored) {
      // No DB backup either — create empty dir
      await fs.mkdir(storagePath, { recursive: true });
    }
  }
}

/** Save all files in a directory tree to the database (called after ZIP import, template creation, etc.) */
export async function dbSaveDirectoryTree(projectId: number, rootDir: string): Promise<void> {
  const files: { path: string; content: string }[] = [];

  async function walk(dir: string, relBase: string) {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const fullPath = path.join(dir, entry);
      const relPath = relBase ? `${relBase}/${entry}` : entry;
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        await walk(fullPath, relPath);
      } else {
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          files.push({ path: relPath, content });
        } catch {
          // Skip binary files or unreadable files
        }
      }
    }
  }

  await walk(rootDir, "");

  if (files.length === 0) return;

  // Batch upsert all files
  for (const f of files) {
    await db
      .insert(projectFilesTable)
      .values({ projectId, path: f.path, content: f.content })
      .onConflictDoUpdate({
        target: [projectFilesTable.projectId, projectFilesTable.path],
        set: { content: f.content, updatedAt: new Date() },
      });
  }
}
