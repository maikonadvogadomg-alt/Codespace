import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { ExecCommandBody } from "@workspace/api-zod";
import { exec } from "child_process";
import path from "path";

const router: IRouter = Router();

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
  const clampedTimeout = Math.min(timeoutMs ?? 30000, 120000);

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
  const start = Date.now();

  exec(
    command,
    { cwd, timeout: clampedTimeout, maxBuffer: 1024 * 1024 },
    (error, stdout, stderr) => {
      const durationMs = Date.now() - start;
      const exitCode = error?.code != null ? (typeof error.code === "number" ? error.code : 1) : 0;

      res.json({
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        exitCode,
        durationMs,
      });
    }
  );
});

export default router;
