import React, { useState, useRef, useEffect, useCallback } from "react";
import { Terminal, Loader2, X, ChevronRight, Trash2, Copy, Check } from "lucide-react";
import { useExecCommand } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TerminalEntry {
  id: number;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

interface TerminalPanelProps {
  projectId: string;
  onClose?: () => void;
  pendingCommand?: { cmd: string; id: number } | null;
}

export function TerminalPanel({ projectId, onClose, pendingCommand }: TerminalPanelProps) {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [lastPendingId, setLastPendingId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const entryCounter = useRef(0);

  const execMutation = useExecCommand();

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, execMutation.isPending]);

  // Focus input when panel opens
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const commandHistory = entries.map((e) => e.command);

  const runCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;
      setInput("");
      setHistoryIndex(-1);

      const pendingId = ++entryCounter.current;

      execMutation.mutate(
        { projectId, data: { command: trimmed, timeout: 60000 } },
        {
          onSuccess: (data) => {
            setEntries((prev) => [
              ...prev,
              {
                id: pendingId,
                command: trimmed,
                stdout: data.stdout,
                stderr: data.stderr,
                exitCode: data.exitCode,
                durationMs: data.durationMs,
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

  // Auto-run command sent from AI panel (after runCommand is defined)
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
      <div ref={outputRef} className="flex-1 overflow-auto p-3 space-y-3">
        {entries.length === 0 && !execMutation.isPending && (
          <p className="text-[#8b949e] text-[11px]">
            Terminal pronto. Digite um comando abaixo.
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
                className="ml-auto opacity-0 group-hover:opacity-100 text-[#8b949e] hover:text-[#e6edf3] transition-opacity"
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
          </div>
        ))}

        {execMutation.isPending && (
          <div className="flex items-center gap-2 text-[11px] text-[#8b949e]">
            <Loader2 className="w-3 h-3 animate-spin text-green-400" />
            <span>Executando...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[#30363d] bg-[#0d1117] flex items-center px-3 py-2 gap-2">
        <ChevronRight className="w-3.5 h-3.5 text-green-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="npm install, pip install, git status…"
          className="flex-1 bg-transparent outline-none text-[11px] text-[#e6edf3] placeholder:text-[#8b949e] font-mono"
          disabled={execMutation.isPending}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
