import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

export type DevServerStatus = "starting" | "running" | "error" | "stopped";

export interface DevServer {
  process: ChildProcess;
  port: number | null;
  status: DevServerStatus;
  log: string[];
  command: string;
  startedAt: Date;
}

const registry = new Map<number, DevServer>();

// Port detection from stdout/stderr
const PORT_PATTERNS = [
  /localhost:(\d{4,5})/i,
  /127\.0\.0\.1:(\d{4,5})/i,
  /0\.0\.0\.0:(\d{4,5})/i,
  /port[:\s]+(\d{4,5})/i,
  /listening.*?:(\d{4,5})/i,
  /started.*?:(\d{4,5})/i,
  /running.*?:(\d{4,5})/i,
  /server.*?:(\d{4,5})/i,
  /:(\d{4,5})\b/,
];

function detectPort(text: string): number | null {
  for (const pattern of PORT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const port = parseInt(match[1], 10);
      if (port >= 1024 && port <= 65535) return port;
    }
  }
  return null;
}

// Determine best start command from project files
export function detectStartCommand(cwd: string): string {
  try {
    const pkgPath = path.join(cwd, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
        scripts?: Record<string, string>;
      };
      const scripts = pkg.scripts ?? {};
      if (scripts.dev) return "npm run dev";
      if (scripts.start) return "npm start";
      if (scripts.serve) return "npm run serve";
    }
  } catch { /* ignore */ }

  // Fallback: look for common entry files
  const candidates = ["index.js", "server.js", "app.js", "main.js", "src/index.js", "src/server.js"];
  for (const c of candidates) {
    if (fs.existsSync(path.join(cwd, c))) return `node ${c}`;
  }

  return "npm start";
}

export function startDevServer(projectId: number, cwd: string, command?: string): DevServer {
  // Kill any existing server for this project
  stopDevServer(projectId);

  const cmd = command ?? detectStartCommand(cwd);
  const [bin, ...args] = cmd.split(/\s+/);

  const proc = spawn(bin, args, {
    cwd,
    env: {
      ...process.env,
      BROWSER: "none",
      CI: "false",
      NO_COLOR: "1",
      FORCE_COLOR: "0",
      PORT: "3000", // suggest a default port; many frameworks respect this
    },
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const server: DevServer = {
    process: proc,
    port: null,
    status: "starting",
    log: [],
    command: cmd,
    startedAt: new Date(),
  };

  registry.set(projectId, server);

  const handleOutput = (data: Buffer) => {
    const text = data.toString();
    server.log = [...server.log.slice(-199), text];
    // Try to detect port from output
    if (!server.port) {
      const detected = detectPort(text);
      if (detected) {
        server.port = detected;
        server.status = "running";
      }
    }
  };

  proc.stdout?.on("data", handleOutput);
  proc.stderr?.on("data", handleOutput);

  proc.on("error", (err) => {
    server.status = "error";
    server.log.push(`[erro] ${err.message}`);
  });

  proc.on("close", (code) => {
    server.status = code === 0 ? "stopped" : "error";
    registry.delete(projectId);
  });

  // After 20s with no port detected, assume default 3000
  const timer = setTimeout(() => {
    if (server.status === "starting") {
      server.port = parseInt(process.env.PORT ?? "3000", 10);
      server.status = "running";
    }
  }, 20_000);

  proc.on("close", () => clearTimeout(timer));

  return server;
}

export function stopDevServer(projectId: number): boolean {
  const server = registry.get(projectId);
  if (!server) return false;
  try {
    server.process.kill("SIGTERM");
    setTimeout(() => {
      try { server.process.kill("SIGKILL"); } catch { /* already dead */ }
    }, 3000);
  } catch { /* process already exited */ }
  registry.delete(projectId);
  return true;
}

export function getDevServer(projectId: number): DevServer | null {
  return registry.get(projectId) ?? null;
}

// Register a process that was started externally (e.g. from terminal exec-stream)
// This keeps the process alive even after the SSE connection closes.
export function registerTerminalProcess(
  projectId: number,
  proc: ChildProcess,
  port: number,
  command: string,
  existingLog: string[]
): DevServer {
  // Kill any existing server for this project first
  stopDevServer(projectId);

  const server: DevServer = {
    process: proc,
    port,
    status: "running",
    log: existingLog,
    command,
    startedAt: new Date(),
  };

  registry.set(projectId, server);

  // Continue collecting log
  const handleOutput = (data: Buffer) => {
    server.log = [...server.log.slice(-199), data.toString()];
  };
  proc.stdout?.on("data", handleOutput);
  proc.stderr?.on("data", handleOutput);

  proc.on("close", (code) => {
    server.status = code === 0 ? "stopped" : "error";
    registry.delete(projectId);
  });

  return server;
}

export function listDevServers(): Array<{ projectId: number; port: number | null; status: DevServerStatus; command: string }> {
  return Array.from(registry.entries()).map(([projectId, s]) => ({
    projectId,
    port: s.port,
    status: s.status,
    command: s.command,
  }));
}
