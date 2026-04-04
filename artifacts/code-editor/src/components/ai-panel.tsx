import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Loader2,
  Send,
  Bot,
  User,
  RefreshCw,
  File,
  FolderOpen,
  Minus,
  ChevronDown,
  Check,
  Trash2,
  FilePlus,
  FilePen,
  AlertCircle,
  Terminal,
  Play,
  Mic,
  MicOff,
  Zap,
} from "lucide-react";
import {
  useAiChat,
  useWriteFile,
  useDeleteFile,
  getGetProjectQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Voice hook (shared pattern) ─────────────────────────────────────────────
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
      onResult(e.results[0][0].transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }, [listening, onResult]);

  return { listening, toggle };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

type ContextMode = "none" | "file" | "project";

export interface TerminalLogEntry {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface AiPanelProps {
  projectId: string;
  fileContext?: { path: string; content: string; language: string } | null;
  externalMessage?: { text: string; id: number; contextMode?: ContextMode } | null;
  onRunCommand?: (cmd: string) => void;
  /** Recent terminal entries - sent automatically as context with every message */
  terminalLog?: TerminalLogEntry[];
}

// ─── File change parser ───────────────────────────────────────────────────────

type Segment =
  | { type: "text"; content: string }
  | { type: "write"; path: string; content: string }
  | { type: "delete"; path: string }
  | { type: "exec"; command: string };

function parseAiMessage(text: string): Segment[] {
  const segments: Segment[] = [];
  const pattern =
    /<codelens-write\s+path="([^"]+)">([\s\S]*?)<\/codelens-write>|<codelens-delete\s+path="([^"]+)"\s*\/>|<codelens-exec>([\s\S]*?)<\/codelens-exec>/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      const textBefore = text.slice(last, match.index).trim();
      if (textBefore) segments.push({ type: "text", content: textBefore });
    }
    if (match[1] !== undefined) {
      segments.push({ type: "write", path: match[1], content: match[2].trim() });
    } else if (match[3] !== undefined) {
      segments.push({ type: "delete", path: match[3] });
    } else if (match[4] !== undefined) {
      segments.push({ type: "exec", command: match[4].trim() });
    }
    last = match.index + match[0].length;
  }

  const tail = text.slice(last).trim();
  if (tail) segments.push({ type: "text", content: tail });

  return segments;
}

// ─── File Change Card ─────────────────────────────────────────────────────────

interface FileChangeCardProps {
  segment: Segment & { type: "write" | "delete" };
  projectId: string;
  onApplied: (path: string) => void;
}

function FileChangeCard({ segment, projectId, onApplied }: FileChangeCardProps) {
  const [status, setStatus] = useState<"idle" | "applying" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const queryClient = useQueryClient();

  const writeMutation = useWriteFile();
  const deleteMutation = useDeleteFile();

  const isWrite = segment.type === "write";
  const fileName = segment.path.split("/").pop() ?? segment.path;

  const handleApply = async () => {
    setStatus("applying");
    try {
      if (isWrite && segment.type === "write") {
        await writeMutation.mutateAsync({
          projectId,
          data: { path: segment.path, content: segment.content },
        });
      } else {
        await deleteMutation.mutateAsync({
          projectId,
          params: { path: segment.path },
        });
      }
      // Invalidate project tree and all file content so UI refreshes
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      setStatus("done");
      onApplied(segment.path);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao aplicar";
      setErrorMsg(msg);
      setStatus("error");
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border text-xs overflow-hidden my-1",
        isWrite ? "border-blue-500/30 bg-blue-500/5" : "border-red-500/30 bg-red-500/5"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 border-b",
          isWrite ? "border-blue-500/20 bg-blue-500/10" : "border-red-500/20 bg-red-500/10"
        )}
      >
        {isWrite ? (
          segment.path.includes(".") ? (
            <FilePen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          ) : (
            <FilePlus className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          )
        ) : (
          <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
        )}
        <span className="font-mono font-medium truncate flex-1" title={segment.path}>
          {segment.path}
        </span>
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-full shrink-0",
            isWrite ? "bg-blue-500/20 text-blue-300" : "bg-red-500/20 text-red-300"
          )}
        >
          {isWrite ? "editar" : "deletar"}
        </span>
      </div>

      {/* Preview (write only) */}
      {isWrite && segment.type === "write" && (
        <pre className="p-3 text-[10px] font-mono text-foreground/70 overflow-auto max-h-32 leading-relaxed whitespace-pre-wrap">
          {segment.content.slice(0, 400)}
          {segment.content.length > 400 && "\n… (truncado na prévia)"}
        </pre>
      )}

      {/* Footer */}
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        {status === "error" && (
          <span className="flex items-center gap-1 text-red-400 text-[10px]">
            <AlertCircle className="w-3 h-3" /> {errorMsg}
          </span>
        )}
        {status === "done" && (
          <span className="flex items-center gap-1 text-green-400 text-[10px]">
            <Check className="w-3 h-3" /> Aplicado
          </span>
        )}
        {status === "applying" && (
          <span className="flex items-center gap-1 text-muted-foreground text-[10px] ml-auto">
            <Loader2 className="w-3 h-3 animate-spin" /> Aplicando...
          </span>
        )}
        {(status === "idle" || status === "error") && (
          <Button
            size="sm"
            variant={isWrite ? "default" : "destructive"}
            className="h-6 text-[10px] px-2 ml-auto"
            onClick={handleApply}
            disabled={writeMutation.isPending || deleteMutation.isPending}
          >
            {isWrite ? "Aplicar" : "Deletar"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Exec Command Card ────────────────────────────────────────────────────────

function ExecCommandCard({
  command,
  onRun,
}: {
  command: string;
  onRun?: (cmd: string) => void;
}) {
  return (
    <div className="rounded-lg border border-green-500/30 bg-green-500/5 overflow-hidden my-1">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-green-500/20 bg-green-500/10">
        <Terminal className="w-3.5 h-3.5 text-green-400 shrink-0" />
        <span className="font-mono text-[11px] text-green-300 truncate flex-1">{command}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 shrink-0">
          terminal
        </span>
      </div>
      <div className="px-3 py-2 flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] px-2 text-green-400 hover:text-green-300 hover:bg-green-500/10"
          onClick={() => onRun?.(command)}
        >
          <Play className="w-3 h-3 mr-1" />
          Executar no terminal
        </Button>
      </div>
    </div>
  );
}

// ─── Message Renderer ─────────────────────────────────────────────────────────

function AssistantMessage({
  content,
  projectId,
  onRunCommand,
}: {
  content: string;
  projectId: string;
  onRunCommand?: (cmd: string) => void;
}) {
  const segments = parseAiMessage(content);

  return (
    <div className="flex gap-2 justify-start">
      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="max-w-[90%] flex flex-col gap-1">
        {segments.map((seg, i) => {
          if (seg.type === "text") {
            return (
              <div
                key={i}
                className="bg-muted rounded-lg rounded-bl-sm px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground"
              >
                {seg.content}
              </div>
            );
          }
          if (seg.type === "write" || seg.type === "delete") {
            return (
              <FileChangeCard
                key={i}
                segment={seg}
                projectId={projectId}
                onApplied={() => {}}
              />
            );
          }
          if (seg.type === "exec") {
            return (
              <ExecCommandCard
                key={i}
                command={seg.command}
                onRun={onRunCommand}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

// ─── Context selector config ──────────────────────────────────────────────────

const CONTEXT_LABELS: Record<ContextMode, string> = {
  none: "Sem contexto",
  file: "Arquivo aberto",
  project: "Projeto completo",
};

const CONTEXT_ICONS: Record<ContextMode, React.ReactNode> = {
  none: <Minus className="w-3 h-3" />,
  file: <File className="w-3 h-3" />,
  project: <FolderOpen className="w-3 h-3" />,
};

// ─── Main Panel ───────────────────────────────────────────────────────────────

// Read active AI profile name from localStorage
function useActiveModel(): string {
  const [model, setModel] = useState<string>(() => {
    try {
      const profiles = JSON.parse(localStorage.getItem("codelens_ai_profiles") ?? "[]");
      const slot = parseInt(localStorage.getItem("codelens_ai_active_slot") ?? "0", 10);
      return profiles[slot]?.model ?? "";
    } catch { return ""; }
  });
  useEffect(() => {
    const update = () => {
      try {
        const profiles = JSON.parse(localStorage.getItem("codelens_ai_profiles") ?? "[]");
        const slot = parseInt(localStorage.getItem("codelens_ai_active_slot") ?? "0", 10);
        setModel(profiles[slot]?.model ?? "");
      } catch { setModel(""); }
    };
    window.addEventListener("storage", update);
    window.addEventListener("codelens-settings-saved", update);
    return () => { window.removeEventListener("storage", update); window.removeEventListener("codelens-settings-saved", update); };
  }, []);
  return model;
}

const CONTEXT_STORAGE_KEY = "codelens_ai_context_mode";
const AGENT_MODE_KEY = "codelens_agent_mode";

async function agentExec(projectId: string, command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const res = await fetch("/api/ai/agent-exec", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, command }),
  });
  return res.json();
}

async function agentWriteFile(projectId: string, filePath: string, content: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${projectId}/files`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, content }),
    });
    return res.ok;
  } catch { return false; }
}

export function AiPanel({ projectId, fileContext, externalMessage, onRunCommand, terminalLog }: AiPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [contextMode, setContextMode] = useState<ContextMode>(() => {
    const saved = localStorage.getItem(CONTEXT_STORAGE_KEY) as ContextMode | null;
    return saved ?? "project";
  });
  const [agentMode, setAgentMode] = useState(() => localStorage.getItem(AGENT_MODE_KEY) === "true");
  const [agentWorking, setAgentWorking] = useState(false);
  const agentAbortRef = useRef(false);
  const [lastExternalId, setLastExternalId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeModel = useActiveModel();

  const toggleAgentMode = () => {
    const next = !agentMode;
    setAgentMode(next);
    localStorage.setItem(AGENT_MODE_KEY, String(next));
  };

  const { listening, toggle: toggleVoice } = useVoice((text) => {
    setInput((prev) => (prev ? prev + " " + text : text));
    setTimeout(() => textareaRef.current?.focus(), 50);
  });

  const processAgentActions = useCallback(async (reply: string, allMessages: Message[]) => {
    if (!agentMode) return;
    const segments = parseAiMessage(reply);
    const actionSegments = segments.filter(s => s.type === "exec" || s.type === "write");
    if (actionSegments.length === 0) return;

    setAgentWorking(true);
    agentAbortRef.current = false;
    const results: string[] = [];

    for (const seg of actionSegments) {
      if (agentAbortRef.current) break;

      if (seg.type === "exec") {
        const cmd = seg.command.trim();
        setMessages(prev => [...prev, { role: "assistant", content: `⚡ Executando: \`${cmd}\`` }]);
        onRunCommand?.(cmd);
        try {
          const r = await agentExec(projectId, cmd);
          const output = [
            r.stdout && `stdout:\n${r.stdout.slice(-3000)}`,
            r.stderr && `stderr:\n${r.stderr.slice(-2000)}`,
            `exit: ${r.exitCode}`,
          ].filter(Boolean).join("\n");
          results.push(`Comando: ${cmd}\n${output}`);
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `✅ Resultado de \`${cmd}\`:\n\`\`\`\n${output.slice(0, 2000)}\n\`\`\``
          }]);
        } catch (e: any) {
          results.push(`Comando: ${cmd}\nErro: ${e.message}`);
        }
      } else if (seg.type === "write") {
        const ok = await agentWriteFile(projectId, seg.path, seg.content);
        results.push(`Arquivo ${seg.path}: ${ok ? "salvo" : "erro ao salvar"}`);
        if (ok) {
          setMessages(prev => [...prev, { role: "assistant", content: `📝 Arquivo \`${seg.path}\` aplicado automaticamente.` }]);
        }
      }
    }

    if (results.length > 0 && !agentAbortRef.current) {
      const feedbackMsg: Message = {
        role: "user",
        content: `[Agente] Resultados das ações executadas automaticamente:\n\n${results.join("\n\n---\n\n")}\n\nContinue o trabalho se necessário, ou diga que terminou.`
      };
      setMessages(prev => {
        const updated = [...prev, feedbackMsg];
        triggerAgentFollowUp(updated);
        return updated;
      });
    }
    setAgentWorking(false);
  }, [agentMode, projectId, onRunCommand]);

  const chatMutation = useAiChat({
    mutation: {
      onSuccess: (data) => {
        setMessages((prev) => {
          const updated = [...prev, { role: "assistant" as const, content: data.reply }];
          if (agentMode) {
            setTimeout(() => processAgentActions(data.reply, updated), 100);
          }
          return updated;
        });
      },
      onError: (error) => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Erro: ${error.message || "Falha ao conectar com a IA. Verifique as Configurações."}`,
          },
        ]);
        setAgentWorking(false);
      },
    },
  });

  const triggerAgentFollowUp = useCallback((msgs: Message[]) => {
    const tc = buildTerminalContext();
    chatMutation.mutate({
      data: {
        messages: msgs.map(m => ({ role: m.role, content: m.content })),
        fileContext: null,
        filePath: null,
        projectId,
        projectContext: true,
        terminalContext: tc ?? null,
        agentMode: true,
      },
    });
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  useEffect(() => {
    if (externalMessage && externalMessage.id !== lastExternalId) {
      setLastExternalId(externalMessage.id);
      const mode = externalMessage.contextMode ?? contextMode;
      sendMessage(externalMessage.text, mode);
    }
  }, [externalMessage]);

  // Persist context mode choice
  const changeContextMode = (mode: ContextMode) => {
    setContextMode(mode);
    localStorage.setItem(CONTEXT_STORAGE_KEY, mode);
  };

  useEffect(() => {
    if (contextMode === "file" && !fileContext) changeContextMode("project");
  }, [fileContext, contextMode]);

  // Build terminal context string from last N entries (only if there's any output)
  const buildTerminalContext = (): string | null => {
    if (!terminalLog || terminalLog.length === 0) return null;
    const last5 = terminalLog.slice(-5);
    const hasContent = last5.some(e => e.stdout || e.stderr);
    if (!hasContent) return null;
    return last5.map(e => {
      const lines: string[] = [`$ ${e.command}`];
      if (e.stdout) lines.push(e.stdout.trim());
      if (e.stderr) lines.push(`[stderr] ${e.stderr.trim()}`);
      lines.push(`[exit: ${e.exitCode}]`);
      return lines.join("\n");
    }).join("\n\n---\n\n");
  };

  const sendMessage = (text: string, mode: ContextMode = contextMode) => {
    if (!text.trim() || chatMutation.isPending) return;
    const userMsg: Message = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    const tc = buildTerminalContext();
    chatMutation.mutate({
      data: {
        messages: updated.map((m) => ({ role: m.role, content: m.content })),
        fileContext: mode === "file" && fileContext ? fileContext.content.slice(0, 12000) : null,
        filePath: mode === "file" && fileContext ? fileContext.path : null,
        projectId: mode === "project" ? projectId : null,
        projectContext: mode === "project" ? true : null,
        terminalContext: tc ?? null,
        agentMode: agentMode || null,
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage(text, contextMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const availableModes: ContextMode[] = ["none", ...(fileContext ? (["file"] as ContextMode[]) : []), "project"];
  const isEmpty = messages.length === 0 && !chatMutation.isPending;
  const hasTerminalContext = (terminalLog?.length ?? 0) > 0 && terminalLog!.some(e => e.stdout || e.stderr);

  return (
    <div className="h-full w-full flex flex-col bg-card border-l border-border overflow-hidden">
      {/* Header */}
      <div className="h-10 shrink-0 border-b border-border bg-background/50 flex items-center px-3 gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Chat IA</span>
        {activeModel && (
          <span className="text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 truncate max-w-[120px]" title={activeModel}>
            {activeModel}
          </span>
        )}
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 gap-1 text-[10px] px-2",
            agentMode
              ? "text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={toggleAgentMode}
          title={agentMode ? "Modo Agente ATIVO — IA executa comandos e aplica arquivos automaticamente" : "Ativar Modo Agente — IA executa ações sozinha"}
        >
          <Zap className="w-3 h-3" />
          {agentMode ? "Agente ON" : "Agente"}
        </Button>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => { setMessages([]); agentAbortRef.current = true; setAgentWorking(false); }}
            title="Limpar conversa"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-3 min-h-0">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Chat com sua IA</p>
            <p className="text-xs leading-relaxed max-w-[210px]">
              Pergunte, peça análises ou diga para a IA modificar, criar e deletar arquivos do projeto. As alterações aparecem como cards com botão Aplicar.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-1 w-full max-w-[210px] text-[10px] text-left text-muted-foreground">
              <div className="flex items-center gap-1.5"><FilePlus className="w-3 h-3 shrink-0 text-blue-400" /> Criar novos arquivos</div>
              <div className="flex items-center gap-1.5"><FilePen className="w-3 h-3 shrink-0 text-blue-400" /> Editar arquivos existentes</div>
              <div className="flex items-center gap-1.5"><Trash2 className="w-3 h-3 shrink-0 text-red-400" /> Deletar arquivos</div>
              <div className="flex items-center gap-1.5"><FolderOpen className="w-3 h-3 shrink-0 text-primary" /> Analisar projeto inteiro</div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="flex gap-2 justify-end">
                  <div className="max-w-[85%] bg-primary text-primary-foreground rounded-lg rounded-br-sm px-3 py-2 text-xs leading-relaxed break-words">
                    {msg.content}
                  </div>
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-secondary-foreground" />
                  </div>
                </div>
              ) : (
                <AssistantMessage key={i} content={msg.content} projectId={projectId} onRunCommand={onRunCommand} />
              )
            )}
            {(chatMutation.isPending || agentWorking) && (
              <div className="flex gap-2 justify-start">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", agentWorking ? "bg-amber-500/20" : "bg-primary/20")}>
                  {agentWorking ? <Zap className="w-3.5 h-3.5 text-amber-400" /> : <Bot className="w-3.5 h-3.5 text-primary" />}
                </div>
                <div className={cn("rounded-lg rounded-bl-sm px-3 py-2 flex items-center gap-2", agentWorking ? "bg-amber-500/10 border border-amber-500/20" : "bg-muted")}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  {agentWorking && <span className="text-[10px] text-amber-400">Agente trabalhando...</span>}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Context + Input */}
      <div className="shrink-0 border-t border-border bg-background/30 p-2 flex flex-col gap-1.5">
        {/* Terminal context indicator */}
        {hasTerminalContext && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-[10px] text-green-400">
            <Terminal className="w-3 h-3 shrink-0" />
            <span>Terminal incluído automaticamente no contexto</span>
            <span className="ml-auto text-green-400/60">{terminalLog!.length} cmd{terminalLog!.length !== 1 ? "s" : ""}</span>
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors w-full",
                contextMode === "none"
                  ? "bg-muted/50 border-border text-muted-foreground hover:border-primary/30"
                  : contextMode === "file"
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                  : "bg-primary/10 border-primary/30 text-primary"
              )}
            >
              {CONTEXT_ICONS[contextMode]}
              <span className="flex-1 text-left truncate">
                Contexto: {CONTEXT_LABELS[contextMode]}
                {contextMode === "file" && fileContext && ` — ${fileContext.path.split("/").pop()}`}
              </span>
              <ChevronDown className="w-3 h-3 ml-auto shrink-0 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            {availableModes.map((mode) => (
              <DropdownMenuItem
                key={mode}
                onClick={() => changeContextMode(mode)}
                className={cn("gap-2 text-xs", contextMode === mode && "bg-accent")}
              >
                {CONTEXT_ICONS[mode]}
                <div className="flex flex-col">
                  <span className="font-medium">{CONTEXT_LABELS[mode]}</span>
                  <span className="text-muted-foreground text-[10px]">
                    {mode === "none" && "Conversa livre, sem código"}
                    {mode === "file" && "Arquivo atual enviado como contexto"}
                    {mode === "project" && "Todos os arquivos do projeto enviados"}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <form onSubmit={handleSubmit} className="flex gap-1.5 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={listening ? "Ouvindo… fale agora" : 'Ex: "Adiciona tratamento de erro no fetch" (Enter envia)'}
            className="flex-1 min-h-[60px] max-h-[120px] text-xs resize-none bg-background border-border focus-visible:ring-1 focus-visible:ring-primary"
            disabled={chatMutation.isPending}
          />
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn(
                "h-8 w-8",
                listening
                  ? "text-red-400 bg-red-400/10 hover:bg-red-400/20 animate-pulse"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={toggleVoice}
              title={listening ? "Parar gravação" : "Falar mensagem (pt-BR)"}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              type="submit"
              size="icon"
              className="h-8 w-8"
              disabled={!input.trim() || chatMutation.isPending}
            >
              {chatMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
