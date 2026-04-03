import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { ExecCommandBody } from "@workspace/api-zod";
import { spawn, execSync } from "child_process";
import path from "path";

const router: IRouter = Router();

// Detect runtime binary paths at startup so they work in all environments
function detectBinPaths(): string[] {
  const extra: string[] = [];
  const tryResolve = (cmd: string) => {
    try {
      const p = execSync(`which ${cmd} 2>/dev/null`, { encoding: "utf8" }).trim();
      if (p) extra.push(path.dirname(p));
    } catch {}
  };
  tryResolve("npm");
  tryResolve("node");
  tryResolve("npx");
  tryResolve("yarn");
  tryResolve("pnpm");
  return [...new Set(extra)];
}

const DETECTED_BIN_PATHS = detectBinPaths();

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//,
  /mkfs/,
  /dd\s+if=.*of=\/dev/,
  />\s*\/dev\/sd/,
  /shutdown|reboot|halt|poweroff/,
  /curl.*\|\s*(bash|sh|zsh)/,
  /wget.*\|\s*(bash|sh|zsh)/,
];

function isCommandBlocked(cmd: string): boolean {
  return BLOCKED_PATTERNS.some((p) => p.test(cmd));
}

function normalizeCommand(cmd: string): string {
  return cmd
    .replace(/^pip\s+/, "pip3 ")
    .replace(/^pip\b/, "pip3")
    .replace(/^python\s+/, "python3 ")
    .replace(/^python\b/, "python3")
    .replace(/pipenv run python\b/, "pipenv run python3")
    .replace(/poetry run python\b/, "poetry run python3");
}

function buildEnv() {
  const extraPaths = [
    ...DETECTED_BIN_PATHS,
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/local/sbin",
    "/usr/sbin",
    "/sbin",
    "/home/runner/.local/bin",
    "/home/runner/.cargo/bin",
    "/home/runner/go/bin",
    "/usr/local/go/bin",
  ];
  const currentPath = process.env.PATH ?? "";
  const pathSet = new Set([...currentPath.split(":"), ...extraPaths]);
  return {
    ...process.env,
    PATH: [...pathSet].filter(Boolean).join(":"),
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    PYTHONUNBUFFERED: "1",
    // Force npm to show progress
    NPM_CONFIG_PROGRESS: "true",
  };
}

function enrichStderr(stderr: string, exitCode: number, normalized: string): string {
  let enriched = stderr;

  const notFoundMatch = enriched.match(
    /(?:sh|bash|zsh):\s*\d*:?\s*([^\s:]+):\s*(?:not found|command not found|No such file)/
  );
  const missingTool = notFoundMatch ? notFoundMatch[1] : null;

  if (exitCode === 127 || missingTool) {
    const tool = missingTool ?? normalized.split(" ")[0];
    let hint = `\n⚠️  "${tool}" não encontrado.\n`;
    const npmLocalTools = ["tsx", "ts-node", "vite", "react-scripts", "next", "tsc", "eslint", "prettier", "jest", "vitest", "esbuild", "rollup", "webpack"];
    if (npmLocalTools.includes(tool)) {
      hint += `   Este comando faz parte das dependências do projeto.\n   💡 Rode primeiro: npm install`;
    } else if (["npm", "node", "npx"].includes(tool)) {
      hint += `   O Node.js/npm não está disponível neste servidor.`;
    } else if (["python", "python3", "pip3"].includes(tool)) {
      hint += `   Python não está disponível neste ambiente.\n   Este servidor suporta apenas Node.js/npm.`;
    } else {
      hint += `   Verifique se está instalada ou tente: npm install -g ${tool}`;
    }
    enriched = (enriched ? enriched + "\n" : "") + hint;
  }

  return enriched;
}

// ── Streaming exec via SSE ─────────────────────────────────────────────────────
// This is the primary endpoint — streams output line by line in real time.
router.post("/projects/:projectId/exec-stream", async (req, res): Promise<void> => {
  const id = parseInt(req.params.projectId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const parsed = ExecCommandBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { command } = parsed.data;

  if (isCommandBlocked(command)) {
    res.status(400).json({ error: "Comando bloqueado por segurança." });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Projeto não encontrado" }); return; }

  const normalized = normalizeCommand(command);
  const isInstallCmd = /^(npm\s+install|npm\s+i\b|yarn\s+install|yarn\b|pnpm\s+install|pip3?\s+install|poetry\s+install|composer\s+install|bundle\s+install|cargo\s+build|go\s+get)/.test(normalized.trim());
  const isBuildCmd = /^(npm\s+run\s+build|vite\s+build|next\s+build|tsc\b)/.test(normalized.trim());
  const maxTimeout = isInstallCmd ? 600_000 : isBuildCmd ? 300_000 : 120_000;

  const cwd = path.resolve(project.storagePath);
  const start = Date.now();

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (type: string, payload: object) => {
    try {
      res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
    } catch { /* client disconnected */ }
  };

  // Spawn process
  const proc = spawn("sh", ["-c", normalized], {
    cwd,
    env: buildEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderrBuffer = "";
  let exitCode = 0;

  proc.stdout.on("data", (chunk: Buffer) => {
    send("stdout", { data: chunk.toString() });
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stderrBuffer += text;
    send("stderr", { data: text });
  });

  proc.on("error", (err) => {
    send("stderr", { data: `\nErro ao iniciar processo: ${err.message}\n` });
  });

  proc.on("close", (code, signal) => {
    exitCode = code ?? (signal ? 1 : 0);
    const durationMs = Date.now() - start;

    // Append enriched hints to stderr if needed
    const enriched = enrichStderr(stderrBuffer, exitCode, normalized);
    const extraHint = enriched.slice(stderrBuffer.length);
    if (extraHint) send("stderr", { data: extraHint });

    if (signal === "SIGTERM" && durationMs >= maxTimeout - 1000) {
      send("stderr", { data: `\n\n⏱️  Comando interrompido após ${Math.round(durationMs / 1000)}s (limite atingido).` });
    }

    send("exit", { exitCode, durationMs });
    res.end();
  });

  // Kill on timeout
  const timer = setTimeout(() => {
    try { proc.kill("SIGTERM"); } catch {}
  }, maxTimeout);

  proc.on("close", () => clearTimeout(timer));

  // Kill if client disconnects
  req.on("close", () => {
    try { proc.kill("SIGTERM"); } catch {}
    clearTimeout(timer);
  });
});

// ── Legacy batch exec (kept for API client compatibility) ──────────────────────
router.post("/projects/:projectId/exec", async (req, res): Promise<void> => {
  const id = parseInt(req.params.projectId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const parsed = ExecCommandBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { command } = parsed.data;
  if (isCommandBlocked(command)) { res.status(400).json({ error: "Comando bloqueado por segurança." }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Projeto não encontrado" }); return; }

  const normalized = normalizeCommand(command);
  const isInstallCmd = /^(npm\s+install|npm\s+i\b|yarn|pnpm\s+install|pip3?\s+install)/.test(normalized.trim());
  const timeout = isInstallCmd ? 600_000 : 120_000;
  const cwd = path.resolve(project.storagePath);
  const start = Date.now();

  const proc = spawn("sh", ["-c", normalized], { cwd, env: buildEnv(), stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
  proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

  const timer = setTimeout(() => { try { proc.kill("SIGTERM"); } catch {} }, timeout);

  proc.on("close", (code) => {
    clearTimeout(timer);
    const exitCode = code ?? 1;
    const enriched = enrichStderr(stderr, exitCode, normalized);
    res.json({ stdout, stderr: enriched, exitCode, durationMs: Date.now() - start });
  });

  proc.on("error", () => {
    clearTimeout(timer);
    res.json({ stdout, stderr: "Erro ao iniciar o processo.", exitCode: 1, durationMs: Date.now() - start });
  });
});

export default router;
