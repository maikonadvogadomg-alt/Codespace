import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import http from "http";
import {
  startDevServer,
  stopDevServer,
  getDevServer,
  detectStartCommand,
} from "../lib/devServerRegistry.js";
import { ensureProjectOnDisk } from "../lib/persistFiles.js";

const router: IRouter = Router();

async function resolveProject(projectId: string) {
  const id = parseInt(projectId, 10);
  if (isNaN(id)) return null;
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));
  return project ?? null;
}

// POST /projects/:projectId/dev-server/start
router.post("/projects/:projectId/dev-server/start", async (req, res): Promise<void> => {
  const project = await resolveProject(req.params.projectId);
  if (!project) { res.status(404).json({ error: "Projeto não encontrado" }); return; }

  await ensureProjectOnDisk(project.id, project.storagePath);

  const { command } = (req.body ?? {}) as { command?: string };
  const id = project.id;
  startDevServer(id, project.storagePath, command);

  // Wait up to 15s for port to be detected before responding
  const server = getDevServer(id)!;
  const start = Date.now();
  while (!server.port && Date.now() - start < 15_000) {
    await new Promise((r) => setTimeout(r, 300));
  }

  res.json({
    status: server.status,
    port: server.port,
    command: server.command,
    suggestedCommand: detectStartCommand(project.storagePath),
  });
});

// DELETE /projects/:projectId/dev-server/stop
router.delete("/projects/:projectId/dev-server/stop", async (req, res): Promise<void> => {
  const project = await resolveProject(req.params.projectId);
  if (!project) { res.status(404).json({ error: "Projeto não encontrado" }); return; }
  const stopped = stopDevServer(project.id);
  res.json({ stopped });
});

// GET /projects/:projectId/dev-server/status
router.get("/projects/:projectId/dev-server/status", async (req, res): Promise<void> => {
  const project = await resolveProject(req.params.projectId);
  if (!project) { res.status(404).json({ error: "Projeto não encontrado" }); return; }
  const server = getDevServer(project.id);
  if (!server) {
    res.json({ running: false, port: null, status: "stopped", log: [] });
    return;
  }
  res.json({
    running: server.status === "running" || server.status === "starting",
    port: server.port,
    status: server.status,
    command: server.command,
    log: server.log.slice(-20).join(""),
  });
});

// ALL /projects/:projectId/dev-proxy/*path — proxy to the running dev server
router.all("/projects/:projectId/dev-proxy/*path", async (req, res): Promise<void> => {
  const project = await resolveProject(req.params.projectId);
  if (!project) { res.status(404).json({ error: "Projeto não encontrado" }); return; }

  const server = getDevServer(project.id);
  if (!server || !server.port) {
    res.status(503).send(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Servidor não iniciado</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d1117;color:#8b949e;flex-direction:column;gap:12px}</style>
</head>
<body>
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
  <p style="font-size:14px;font-weight:600;color:#e6edf3;margin:0">Servidor não iniciado</p>
  <p style="font-size:12px;margin:0">Clique em <strong>Iniciar Servidor</strong> no painel de Preview</p>
</body>
</html>`);
    return;
  }

  const rawPath = (req.params as Record<string, string>).path ?? "";
  const targetPath = rawPath ? `/${rawPath}` : "/";
  const search = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const fullPath = targetPath + search;

  const proxyHeaders: Record<string, string> = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (typeof val === "string") proxyHeaders[key] = val;
  }
  proxyHeaders["host"] = `localhost:${server.port}`;
  // Remove potentially problematic headers
  delete proxyHeaders["content-length"];

  const proxyReq = http.request(
    {
      hostname: "localhost",
      port: server.port,
      path: fullPath,
      method: req.method,
      headers: proxyHeaders,
    },
    (proxyRes) => {
      const statusCode = proxyRes.statusCode ?? 200;
      const headers: Record<string, string | string[]> = {};
      for (const [key, val] of Object.entries(proxyRes.headers)) {
        if (val !== undefined) headers[key] = val as string | string[];
      }
      // Allow iframe embedding
      delete headers["x-frame-options"];
      delete headers["content-security-policy"];

      res.writeHead(statusCode, headers);
      proxyRes.pipe(res, { end: true });
    }
  );

  proxyReq.on("error", () => {
    if (!res.headersSent) {
      res.status(502).send(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Erro de conexão</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d1117;color:#8b949e;flex-direction:column;gap:8px}</style>
</head>
<body>
  <p style="font-size:14px;font-weight:600;color:#f85149;margin:0">Erro ao conectar ao servidor</p>
  <p style="font-size:12px;margin:0">Porta: ${server.port} — verifique o terminal</p>
</body>
</html>`);
    }
  });

  if (req.method !== "GET" && req.method !== "HEAD") {
    req.pipe(proxyReq, { end: true });
  } else {
    proxyReq.end();
  }
});

export default router;
