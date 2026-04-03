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
} from "lucide-react";
import { useAiChat } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export function AiPanel({ projectId, fileContext, externalMessage }: AiPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [contextMode, setContextMode] = useState<ContextMode>("none");
  const [lastExternalId, setLastExternalId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = useAiChat({
    mutation: {
      onSuccess: (data) => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
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

  // Handle external messages (from analyze file/folder buttons)
  useEffect(() => {
    if (externalMessage && externalMessage.id !== lastExternalId) {
      setLastExternalId(externalMessage.id);
      const mode = externalMessage.contextMode ?? contextMode;
      sendMessage(externalMessage.text, mode);
    }
  }, [externalMessage]);

  // If file context disappears, fall back to none
  useEffect(() => {
    if (contextMode === "file" && !fileContext) {
      setContextMode("none");
    }
  }, [fileContext, contextMode]);

  const sendMessage = (text: string, mode: ContextMode = contextMode) => {
    if (!text.trim() || chatMutation.isPending) return;

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    chatMutation.mutate({
      data: {
        messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
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

  const clearChat = () => setMessages([]);

  const isEmpty = messages.length === 0 && !chatMutation.isPending;

  const availableModes: ContextMode[] = ["none", ...(fileContext ? (["file"] as ContextMode[]) : []), "project"];

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
            onClick={clearChat}
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
            <p className="text-xs leading-relaxed max-w-[200px]">
              Faça perguntas sobre o código, peça explicações ou sugestões. Escolha o contexto abaixo.
            </p>
            <div className="mt-4 flex flex-col gap-1.5 w-full max-w-[200px] text-xs text-left">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Minus className="w-3.5 h-3.5 shrink-0" />
                <span>Sem contexto — perguntas gerais</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <File className="w-3.5 h-3.5 shrink-0" />
                <span>Arquivo aberto como contexto</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Projeto completo como contexto</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2 text-sm",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}
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

      {/* Context Selector + Input */}
      <div className="shrink-0 border-t border-border bg-background/30 p-2 flex flex-col gap-1.5">
        {/* Context selector */}
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
          <DropdownMenuContent align="start" className="w-56">
            {availableModes.map((mode) => (
              <DropdownMenuItem
                key={mode}
                onClick={() => setContextMode(mode)}
                className={cn(
                  "gap-2 text-xs",
                  contextMode === mode && "bg-accent"
                )}
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

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-1.5 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte algo... (Enter para enviar)"
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
