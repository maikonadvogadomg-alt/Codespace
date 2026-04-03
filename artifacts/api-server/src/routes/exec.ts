import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { ExecCommandBody } from "@workspace/api-zod";
import { exec, execSync } from "child_process";
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

// Commands that are blocked for safety
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//, // rm -rf /
  /mkfs/, // format disk
  /dd\s+if=.*of=\/dev/, // write to block device
  />\s*\/dev\/sd/, // write to disk
  /shutdown|reboot|halt|poweroff/, // system commands
  /curl.*\|\s*(bash|sh|zsh)/, // curl pipe to shell
  /wget.*\|\s*(bash|sh|zsh)/,
];

function isCommandBlocked(cmd: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(cmd));
}

// Normalize common command aliases that differ across environments
function normalizeCommand(cmd: string): string {
  return cmd
    // pip → pip3 (preferred on most systems)
    .replace(/^pip\s+/, "pip3 ")
    .replace(/^pip\b/, "pip3")
    // python → python3
    .replace(/^python\s+/, "python3 ")
    .replace(/^python\b/, "python3")
    // pipenv run python → pipenv run python3
    .replace(/pipenv run python\b/, "pipenv run python3")
    // poetry run python → poetry run python3
    .replace(/poetry run python\b/, "poetry run python3");
}

// Build a comprehensive PATH for child processes
function buildEnv() {
  const extraPaths = [
    ...DETECTED_BIN_PATHS, // runtime-detected binary paths (npm, node, etc.)
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
    // Suppress npm update notices and verbose output
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    // Ensure pip/python output is unbuffered
    PYTHONUNBUFFERED: "1",
  };
}

router.post("/projects/:projectId/exec", async (req, res): Promise<void> => {
  const id = parseInt(req.params.projectId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const parsed = ExecCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { command, timeout: timeoutMs = 30000 } = parsed.data;
  // Allow up to 10 minutes for package installation commands
  const isInstallCmd = /^(npm\s+install|npm\s+i\b|yarn\s+install|yarn\b|pnpm\s+install|pip3?\s+install|poetry\s+install|composer\s+install|bundle\s+install|cargo\s+build|go\s+get)/.test(command.trim());
  const maxTimeout = isInstallCmd ? 600_000 : 120_000;
  const clampedTimeout = Math.min(timeoutMs ?? 30000, maxTimeout);

  if (isCommandBlocked(command)) {
    res.status(400).json({ error: "Comando bloqueado por segurança." });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }

  const cwd = path.resolve(project.storagePath);
  const normalized = normalizeCommand(command);
  const start = Date.now();

  exec(
    normalized,
    {
      cwd,
      timeout: clampedTimeout,
      maxBuffer: 4 * 1024 * 1024,
      env: buildEnv(),
    },
    (error, stdout, stderr) => {
      const durationMs = Date.now() - start;

      let exitCode = 0;
      if (error) {
        if (typeof error.code === "number") {
          exitCode = error.code;
        } else if (error.signal) {
          // Killed by timeout or signal
          exitCode = 1;
        } else {
          exitCode = 1;
        }
      }

      // Enrich stderr with a friendly hint for "command not found" (exit 127)
      let enrichedStderr = stderr ?? "";
      if (
        exitCode === 127 ||
        enrichedStderr.includes("not found") ||
        enrichedStderr.includes("No such file")
      ) {
        const tool = normalized.split(" ")[0];
        let hint = `\n⚠️  Ferramenta "${tool}" não encontrada neste ambiente.\n`;
        if (tool === "npm" || tool === "node" || tool === "npx") {
          hint += `   O Node.js/npm pode não estar disponível neste servidor.\n`;
          hint += `   Tente usar: npx <pacote> ou verifique as configurações.`;
        } else if (tool === "python" || tool === "python3" || tool === "pip3") {
          hint += `   Python não está disponível neste ambiente.\n`;
          hint += `   Este servidor suporta apenas Node.js/npm.`;
        } else {
          hint += `   Verifique se está instalada ou use uma alternativa disponível.`;
        }
        enrichedStderr = (enrichedStderr ? enrichedStderr + "\n" : "") + hint;
      }

      // Timeout hint
      if (error?.signal === "SIGTERM" || (error && enrichedStderr.includes("timeout"))) {
        enrichedStderr += `\n\n⏱️  O comando demorou mais que o limite permitido e foi interrompido.`;
        if (normalized.startsWith("npm install")) {
          enrichedStderr += `\n   Para instalações grandes, tente instalar pacotes em partes: npm install <pacote1> <pacote2>`;
        }
      }

      res.json({
        stdout: stdout ?? "",
        stderr: enrichedStderr,
        exitCode,
        durationMs,
        command: normalized !== command ? normalized : undefined,
      });
    }
  );
});

export default router;
