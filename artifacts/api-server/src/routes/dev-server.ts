import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import http from "http";
import {
  startDevServer,
  stopDevServer,
  getDevServer,
  detectStartCommand,
  needsInstall,
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
  const willInstall = needsInstall(project.storagePath);
  await startDevServer(id, project.storagePath, command);

  const server = getDevServer(id)!;
  const start = Date.now();
  const timeout = willInstall ? 60_000 : 15_000;
  while (!server.port && server.status === "starting" && Date.now() - start < timeout) {
    await new Promise((r) => setTimeout(r, 500));
  }

  res.json({
    running: server.status === "running",
    status: server.status,
    port: server.port,
    command: server.command,
    autoInstall: willInstall,
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

// ALL /projects/:projectId/dev-proxy — root path handler
router.all("/projects/:projectId/dev-proxy", async (req, res): Promise<void> => {
  const project = await resolveProject(req.params.projectId);
  if (!project) { res.status(404).json({ error: "Projeto não encontrado" }); return; }
  const server = getDevServer(project.id);
  if (!server || !server.port) { res.redirect(req.originalUrl + "/"); return; }
  const search = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const proxyHeaders: Record<string, string> = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (typeof val === "string") proxyHeaders[key] = val;
  }
  proxyHeaders["host"] = `localhost:${server.port}`;
  delete proxyHeaders["content-length"];
  const proxyReq = http.request(
    { hostname: "localhost", port: server.port, path: "/" + search, method: req.method, headers: proxyHeaders },
    (proxyRes) => {
      const headers: Record<string, string | string[]> = {};
      for (const [key, val] of Object.entries(proxyRes.headers)) { if (val !== undefined) headers[key] = val as string | string[]; }
      delete headers["x-frame-options"];
      delete headers["content-security-policy"];
      res.writeHead(proxyRes.statusCode ?? 200, headers);
      proxyRes.pipe(res, { end: true });
    }
  );
  proxyReq.on("error", () => { if (!res.headersSent) res.status(502).send("Erro ao conectar"); });
  if (req.method !== "GET" && req.method !== "HEAD") { req.pipe(proxyReq, { end: true }); } else { proxyReq.end(); }
});

// ALL /projects/:projectId/dev-proxy/ — root path with trailing slash
router.all("/projects/:projectId/dev-proxy/", async (req, res): Promise<void> => {
  const project = await resolveProject(req.params.projectId);
  if (!project) { res.status(404).json({ error: "Projeto não encontrado" }); return; }
  const server = getDevServer(project.id);
  if (!server || !server.port) { res.status(503).send("Servidor não iniciado"); return; }
  const search = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const proxyHeaders: Record<string, string> = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (typeof val === "string") proxyHeaders[key] = val;
  }
  proxyHeaders["host"] = `localhost:${server.port}`;
  delete proxyHeaders["content-length"];
  const proxyReq = http.request(
    { hostname: "localhost", port: server.port, path: "/" + search, method: req.method, headers: proxyHeaders },
    (proxyRes) => {
      const headers: Record<string, string | string[]> = {};
      for (const [key, val] of Object.entries(proxyRes.headers)) { if (val !== undefined) headers[key] = val as string | string[]; }
      delete headers["x-frame-options"];
      delete headers["content-security-policy"];
      res.writeHead(proxyRes.statusCode ?? 200, headers);
      proxyRes.pipe(res, { end: true });
    }
  );
  proxyReq.on("error", () => { if (!res.headersSent) res.status(502).send("Erro ao conectar"); });
  if (req.method !== "GET" && req.method !== "HEAD") { req.pipe(proxyReq, { end: true }); } else { proxyReq.end(); }
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

  // Express 5 wildcard /*path gives params.path as string[] (array of segments)
  const rawPathParam = (req.params as Record<string, string | string[]>).path ?? "";
  const rawPath = Array.isArray(rawPathParam) ? rawPathParam.join("/") : rawPathParam;
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

// ALL /projects/:projectId/port-proxy/:port/*path
// Simple proxy to any localhost port — no process management.
// Used when the user runs a server manually in the terminal.
router.all("/projects/:projectId/port-proxy/:port/*path", async (req, res): Promise<void> => {
  const portNum = parseInt(req.params.port, 10);
  if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
    res.status(400).send("Invalid port");
    return;
  }

  // Express 5 wildcard /*path gives params.path as string[] (array of segments)
  const rawPathParam2 = (req.params as Record<string, string | string[]>).path ?? "";
  const rawPath = Array.isArray(rawPathParam2) ? rawPathParam2.join("/") : rawPathParam2;
  const targetPath = rawPath ? `/${rawPath}` : "/";
  const search = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const fullPath = targetPath + search;

  const proxyHeaders: Record<string, string> = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (typeof val === "string") proxyHeaders[key] = val;
  }
  proxyHeaders["host"] = `localhost:${portNum}`;
  delete proxyHeaders["content-length"];

  const proxyReq = http.request(
    { hostname: "localhost", port: portNum, path: fullPath, method: req.method, headers: proxyHeaders },
    (proxyRes) => {
      const headers: Record<string, string | string[]> = {};
      for (const [key, val] of Object.entries(proxyRes.headers)) {
        if (val !== undefined) headers[key] = val as string | string[];
      }
      delete headers["x-frame-options"];
      delete headers["content-security-policy"];
      res.writeHead(proxyRes.statusCode ?? 200, headers);
      proxyRes.pipe(res, { end: true });
    }
  );

  proxyReq.on("error", () => {
    if (!res.headersSent) {
      res.status(502).send(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Servidor não encontrado</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d1117;color:#e6edf3;flex-direction:column;gap:8px}</style>
</head>
<body>
  <p style="font-size:18px;font-weight:700;color:#f85149;margin:0">Porta ${portNum} não está respondendo</p>
  <p style="font-size:13px;color:#8b949e;margin:0">O servidor pode ter encerrado. Verifique o terminal.</p>
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

