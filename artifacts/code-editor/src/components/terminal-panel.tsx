import React, { useState, useRef, useEffect, useCallback } from "react";
import { Terminal, Loader2, X, ChevronRight, Trash2, Copy, Check, Mic, MicOff, Download } from "lucide-react";
import { useExecCommand } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Voice hook ───────────────────────────────────────────────────────────────
function useVoice(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const toggle = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }, [listening, onResult]);

  return { listening, toggle };
}

// ─── Smart install detection ──────────────────────────────────────────────────

// Maps known CLI executables to their npm package name
const CLI_TO_PACKAGE: Record<string, string> = {
  tsx: "tsx",
  "ts-node": "ts-node",
  vite: "vite",
  "react-scripts": "react-scripts",
  next: "next",
  tsc: "typescript",
  eslint: "eslint",
  prettier: "prettier",
  jest: "jest",
  vitest: "vitest",
  esbuild: "esbuild",
  rollup: "rollup",
  webpack: "webpack",
  nodemon: "nodemon",
  concurrently: "concurrently",
  "cross-env": "cross-env",
};

/**
 * Given combined stdout+stderr output, try to detect an npm package name
 * that is missing and should be installed.
 */
function detectMissingPackage(stderr: string, stdout: string): string | null {
  const text = stderr + "\n" + stdout;

  // Shell "tsx: not found" or "bash: tsx: command not found"
  // Covers cases where npm run <script> calls a missing local binary
  const shellNotFound = text.match(/(?:sh|bash|zsh):\s*\d*:?\s*([^\s:]+):\s*(?:not found|command not found)/);
  if (shellNotFound) {
    const bin = shellNotFound[1];
    const pkg = CLI_TO_PACKAGE[bin];
    if (pkg) return pkg;
  }

  // Node "Cannot find module 'X'" — captures scoped and unscoped packages
  const cannotFind = text.match(/Cannot find module ['"](@?[a-zA-Z0-9._/-]+)['"]/);
  if (cannotFind) {
    const mod = cannotFind[1];
    // Strip relative paths — only suggest external packages
    if (!mod.startsWith(".") && !mod.startsWith("/")) return mod.split("/").slice(0, mod.startsWith("@") ? 2 : 1).join("/");
  }

  // npm ERR! missing: X@Y
  const npmMissing = text.match(/npm ERR! missing: ([a-zA-Z0-9@._/-]+)@/);
  if (npmMissing) return npmMissing[1].split("/").slice(0, npmMissing[1].startsWith("@") ? 2 : 1).join("/");

  // MODULE_NOT_FOUND (vite/webpack bundler style): Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'X'
  const errModNotFound = text.match(/Cannot find package ['"](@?[a-zA-Z0-9._/-]+)['"]/);
  if (errModNotFound) {
    const mod = errModNotFound[1];
    if (!mod.startsWith(".") && !mod.startsWith("/")) return mod;
  }

  // Vite: "X" is not installed
  const viteNotInstalled = text.match(/"(@?[a-zA-Z0-9._/-]+)" is not installed/);
  if (viteNotInstalled) return viteNotInstalled[1];

  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TerminalEntry {
  id: number;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  missingPackage?: string | null;
}

interface TerminalPanelProps {
  projectId: string;
  onClose?: () => void;
  pendingCommand?: { cmd: string; id: number } | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TerminalPanel({ projectId, onClose, pendingCommand }: TerminalPanelProps) {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [lastPendingId, setLastPendingId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const entryCounter = useRef(0);

  const { listening, toggle: toggleVoice } = useVoice((text) => {
    setInput((prev) => (prev ? prev + " " + text : text));
    setTimeout(() => inputRef.current?.focus(), 50);
  });

  const execMutation = useExecCommand();

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, execMutation.isPending]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const commandHistory = entries.map((e) => e.command);

  // Detect commands that need extended timeouts
  const getTimeout = (cmd: string): number => {
    const c = cmd.trim().toLowerCase();
    const isInstall = /^(npm\s+install|npm\s+i\b|yarn\s+install|yarn\b|pnpm\s+install|pip3?\s+install|poetry\s+install|composer\s+install|bundle\s+install|cargo\s+build|go\s+get)/.test(c);
    const isBuild = /^(npm\s+run\s+build|npm\s+run\s+start|vite\s+build|next\s+build|tsc\b)/.test(c);
    if (isInstall) return 600_000; // 10 minutes
    if (isBuild) return 300_000;  // 5 minutes
    return 60_000;                 // 1 minute default
  };

  const runCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;
      setInput("");
      setHistoryIndex(-1);

      const pendingId = ++entryCounter.current;
      const timeout = getTimeout(trimmed);

      execMutation.mutate(
        { projectId, data: { command: trimmed, timeout } },
        {
          onSuccess: (data) => {
            const missingPackage = data.exitCode !== 0
              ? detectMissingPackage(data.stderr, data.stdout)
              : null;
            setEntries((prev) => [
              ...prev,
              {
                id: pendingId,
                command: trimmed,
                stdout: data.stdout,
                stderr: data.stderr,
                exitCode: data.exitCode,
                durationMs: data.durationMs,
                missingPackage,
              },
            ]);
          },
          onError: (err) => {
            setEntries((prev) => [
              ...prev,
              {
                id: pendingId,
                command: trimmed,
                stdout: "",
                stderr: `Erro: ${err.error || "Falha ao executar comando"}`,
                exitCode: 1,
                durationMs: 0,
              },
            ]);
          },
        }
      );
    },
    [projectId, execMutation]
  );

  // Auto-run command sent from outside (AI panel / packages panel)
  useEffect(() => {
    if (pendingCommand && pendingCommand.id !== lastPendingId) {
      setLastPendingId(pendingCommand.id);
      runCommand(pendingCommand.cmd);
    }
  }, [pendingCommand, runCommand]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      runCommand(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(newIndex);
      setInput(commandHistory[commandHistory.length - 1 - newIndex] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      setInput(newIndex === -1 ? "" : (commandHistory[commandHistory.length - 1 - newIndex] ?? ""));
    }
  };

  const copyOutput = (entry: TerminalEntry) => {
    const text = [entry.stdout, entry.stderr].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#e6edf3] font-mono text-xs">
      {/* Header */}
      <div className="h-9 shrink-0 border-b border-[#30363d] bg-[#161b22] flex items-center px-3 gap-2">
        <Terminal className="w-3.5 h-3.5 text-green-400" />
        <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider flex-1">Terminal</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d]"
          onClick={() => setEntries([])}
          title="Limpar"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d]"
            onClick={onClose}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Output */}
      <div ref={outputRef} className="flex-1 overflow-auto p-3 space-y-3 select-none">
        {entries.length === 0 && !execMutation.isPending && (
          <p className="text-[#8b949e] text-[11px]">
            Terminal pronto. Digite ou fale um comando abaixo.
            <br />
            <span className="text-[10px] opacity-60">Use ↑ ↓ para navegar no histórico.</span>
          </p>
        )}

        {entries.map((entry) => (
          <div key={entry.id} className="space-y-1">
            {/* Command line */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-green-400 shrink-0">$</span>
              <span className="text-[#e6edf3]">{entry.command}</span>
              <button
                className="ml-auto text-[#8b949e] hover:text-[#e6edf3] transition-opacity"
                onClick={() => copyOutput(entry)}
                title="Copiar saída"
              >
                {copiedId === entry.id ? (
                  <Check className="w-3 h-3 text-green-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              <span
                className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded-full ml-1",
                  entry.exitCode === 0
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                )}
              >
                {entry.exitCode === 0 ? "OK" : `exit ${entry.exitCode}`}
              </span>
              <span className="text-[#8b949e] text-[9px]">{entry.durationMs}ms</span>
            </div>

            {/* stdout */}
            {entry.stdout && (
              <pre className="text-[11px] text-[#c9d1d9] whitespace-pre-wrap break-words pl-4 leading-relaxed">
                {entry.stdout}
              </pre>
            )}

            {/* stderr */}
            {entry.stderr && (
              <pre className="text-[11px] text-[#f85149] whitespace-pre-wrap break-words pl-4 leading-relaxed">
                {entry.stderr}
              </pre>
            )}

            {/* ── Smart npm install suggestion ─────────────────────────── */}
            {entry.missingPackage && (
              <div className="flex items-center gap-2 mt-1 ml-4 p-2 rounded bg-yellow-400/10 border border-yellow-400/30">
                <Download className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <span className="text-[11px] text-yellow-300 flex-1">
                  Módulo <code className="font-bold">{entry.missingPackage}</code> não encontrado.
                </span>
                <button
                  onClick={() => runCommand(`npm install ${entry.missingPackage}`)}
                  disabled={execMutation.isPending}
                  className="text-[10px] font-semibold px-2 py-1 rounded bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 border border-yellow-400/30 transition-colors shrink-0 disabled:opacity-50"
                >
                  npm install {entry.missingPackage}
                </button>
              </div>
            )}
          </div>
        ))}

        {execMutation.isPending && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] text-[#8b949e]">
              <Loader2 className="w-3 h-3 animate-spin text-green-400" />
              <span>Executando...</span>
            </div>
            {/* Show extended-wait notice for install commands */}
            {entries.length > 0 && /^(npm\s+install|yarn\s+install|pip3?\s+install|pnpm\s+install)/i.test(
              entries[entries.length - 1]?.command ?? ""
            ) && (
              <p className="text-[10px] text-yellow-400/70 pl-5">
                ⏳ Instalação de pacotes pode levar 2-10 minutos. Por favor aguarde...
              </p>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[#30363d] bg-[#0d1117] flex items-center px-3 py-3 gap-2">
        <ChevronRight className="w-3.5 h-3.5 text-green-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="npm install, pip install, git status…"
          className="flex-1 bg-transparent outline-none text-sm text-[#e6edf3] placeholder:text-[#8b949e] font-mono"
          disabled={execMutation.isPending}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={toggleVoice}
          className={cn(
            "shrink-0 p-1.5 rounded transition-colors",
            listening
              ? "text-red-400 bg-red-400/20 animate-pulse"
              : "text-[#8b949e] hover:text-[#e6edf3]"
          )}
          title={listening ? "Parar gravação" : "Falar comando"}
        >
          {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
