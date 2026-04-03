import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

export type DevServerStatus = "starting" | "running" | "error" | "stopped";

export interface DevServer {
  process: ChildProcess | null;
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

export function needsInstall(cwd: string): boolean {
  const pkgPath = path.join(cwd, "package.json");
  const nodeModulesPath = path.join(cwd, "node_modules");
  return fs.existsSync(pkgPath) && !fs.existsSync(nodeModulesPath);
}

const ALLOWED_START_COMMANDS = new Set([
  "npm run dev", "npm start", "npm run serve", "npm run build",
  "npm test", "npm install",
  "yarn dev", "yarn start", "yarn build",
  "pnpm dev", "pnpm start", "pnpm run dev", "pnpm run start",
  "python3 -m http.server", "python -m http.server",
]);

function isAllowedCommand(cmd: string): boolean {
  if (ALLOWED_START_COMMANDS.has(cmd)) return true;
  if (/^node\s+[\w./-]+\.m?js$/.test(cmd)) return true;
  if (/^python3?\s+[\w./-]+\.py$/.test(cmd)) return true;
  return false;
}

function buildCleanEnv(): Record<string, string> {
  const cleanEnv: Record<string, string> = {};
  for (const [key, val] of Object.entries(process.env)) {
    if (typeof val !== "string") continue;
    if (key.toLowerCase().startsWith("npm_config_") && (
      key.toLowerCase().includes("jsr") ||
      key.toLowerCase().includes("catalog") ||
      key.toLowerCase().includes("release_age") ||
      key.toLowerCase().includes("globalconfig") ||
      key.toLowerCase().includes("verify_deps") ||
      key.toLowerCase().includes("recursive") ||
      key.toLowerCase().includes("overrides")
    )) continue;
    cleanEnv[key] = val;
  }
  return cleanEnv;
}

function spawnInProject(cmd: string, cwd: string, env: Record<string, string>): ChildProcess {
  const [bin, ...args] = cmd.split(/\s+/);
  return spawn(bin, args, {
    cwd,
    env,
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
}

export function startDevServer(projectId: number, cwd: string, command?: string): DevServer {
  stopDevServer(projectId);

  const startCmd = command && isAllowedCommand(command) ? command : detectStartCommand(cwd);
  const autoInstall = needsInstall(cwd);

  const cleanEnv = buildCleanEnv();
  const projectEnv: Record<string, string> = {
    ...cleanEnv,
    BROWSER: "none",
    CI: "false",
    NO_COLOR: "1",
    FORCE_COLOR: "0",
    PORT: "3000",
    npm_config_userconfig: "/dev/null",
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
  };

  const displayCmd = autoInstall ? `npm install && ${startCmd}` : startCmd;

  const server: DevServer = {
    process: null,
    port: null,
    status: "starting",
    log: autoInstall ? ["[auto] Instalando dependências antes de iniciar…\n"] : [],
    command: displayCmd,
    startedAt: new Date(),
  };

  registry.set(projectId, server);

  const attachListeners = (proc: ChildProcess, isServerProc: boolean) => {
    const handleOutput = (data: Buffer) => {
      const text = data.toString();
      server.log = [...server.log.slice(-199), text];
      if (isServerProc && !server.port) {
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
  };

  const launchServer = () => {
    const proc = spawnInProject(startCmd, cwd, projectEnv);
    server.process = proc;
    attachListeners(proc, true);

    proc.on("close", (code) => {
      server.status = code === 0 ? "stopped" : "error";
      registry.delete(projectId);
    });

    const timer = setTimeout(() => {
      if (server.status === "starting" && !server.port) {
        server.port = 3000;
        server.status = "running";
      }
    }, 30_000);
    proc.on("close", () => clearTimeout(timer));
  };

  if (autoInstall) {
    const installProc = spawnInProject("npm install", cwd, projectEnv);
    server.process = installProc;
    attachListeners(installProc, false);

    installProc.on("close", (code) => {
      if (code === 0) {
        server.log.push("[auto] Dependências instaladas. Iniciando servidor…\n");
        launchServer();
      } else {
        server.status = "error";
        server.log.push(`[erro] npm install falhou (código ${code})\n`);
        registry.delete(projectId);
      }
    });
  } else {
    launchServer();
  }

  return server;
}

export function stopDevServer(projectId: number): boolean {
  const server = registry.get(projectId);
  if (!server) return false;
  try {
    server.process?.kill("SIGTERM");
    setTimeout(() => {
      try { server.process?.kill("SIGKILL"); } catch { /* already dead */ }
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
