import React, { useState, useRef, useEffect } from "react";
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

type ContextMode = "none" | "file" | "project";

interface AiPanelProps {
  projectId: string;
  fileContext?: { path: string; content: string; language: string } | null;
  externalMessage?: { text: string; id: number; contextMode?: ContextMode } | null;
}

// ─── File change parser ───────────────────────────────────────────────────────

type Segment =
  | { type: "text"; content: string }
  | { type: "write"; path: string; content: string }
  | { type: "delete"; path: string };

function parseAiMessage(text: string): Segment[] {
  const segments: Segment[] = [];
  // Match both write and delete blocks
  const pattern = /<codelens-write\s+path="([^"]+)">([\s\S]*?)<\/codelens-write>|<codelens-delete\s+path="([^"]+)"\s*\/>/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      const textBefore = text.slice(last, match.index).trim();
      if (textBefore) segments.push({ type: "text", content: textBefore });
    }
    if (match[1] !== undefined) {
      // write block
      segments.push({ type: "write", path: match[1], content: match[2].trim() });
    } else if (match[3] !== undefined) {
      // delete block
      segments.push({ type: "delete", path: match[3] });
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
        {(status === "idle" || status === "error") && (
          <Button
            size="sm"
            variant={isWrite ? "default" : "destructive"}
            className="h-6 text-[10px] px-2 ml-auto"
            onClick={handleApply}
            disabled={status === "applying"}
          >
            {status === "applying" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isWrite ? (
              "Aplicar"
            ) : (
              "Deletar"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Message Renderer ─────────────────────────────────────────────────────────

function AssistantMessage({
  content,
  projectId,
}: {
  content: string;
  projectId: string;
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

export function AiPanel({ projectId, fileContext, externalMessage }: AiPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [contextMode, setContextMode] = useState<ContextMode>("none");
  const [lastExternalId, setLastExternalId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = useAiChat({
    mutation: {
      onSuccess: (data) => {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      },
      onError: (error) => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Erro: ${error.error || "Falha ao conectar com a IA. Verifique as Configurações."}`,
          },
        ]);
      },
    },
  });

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

  useEffect(() => {
    if (contextMode === "file" && !fileContext) setContextMode("none");
  }, [fileContext, contextMode]);

  const sendMessage = (text: string, mode: ContextMode = contextMode) => {
    if (!text.trim() || chatMutation.isPending) return;
    const userMsg: Message = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    chatMutation.mutate({
      data: {
        messages: updated.map((m) => ({ role: m.role, content: m.content })),
        fileContext: mode === "file" && fileContext ? fileContext.content.slice(0, 12000) : null,
        filePath: mode === "file" && fileContext ? fileContext.path : null,
        projectId: mode === "project" ? projectId : null,
        projectContext: mode === "project" ? true : null,
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

  return (
    <div className="h-full w-full flex flex-col bg-card border-l border-border overflow-hidden">
      {/* Header */}
      <div className="h-10 shrink-0 border-b border-border bg-background/50 flex items-center px-3 gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground flex-1">Chat IA</span>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setMessages([])}
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
                <AssistantMessage key={i} content={msg.content} projectId={projectId} />
              )
            )}
            {chatMutation.isPending && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-muted rounded-lg rounded-bl-sm px-3 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Context + Input */}
      <div className="shrink-0 border-t border-border bg-background/30 p-2 flex flex-col gap-1.5">
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
                onClick={() => setContextMode(mode)}
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Ex: "Adiciona tratamento de erro no fetch" (Enter envia)'
            className="flex-1 min-h-[60px] max-h-[120px] text-xs resize-none bg-background border-border focus-visible:ring-1 focus-visible:ring-primary"
            disabled={chatMutation.isPending}
          />
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={!input.trim() || chatMutation.isPending}
          >
            {chatMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
