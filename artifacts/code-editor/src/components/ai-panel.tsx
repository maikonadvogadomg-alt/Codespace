import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, Send, Bot, User, Paperclip, X, RefreshCw } from "lucide-react";
import { useAiChat } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiPanelProps {
  fileContext?: { path: string; content: string; language: string } | null;
  onAnalyzeFile?: () => void;
  onAnalyzeFolder?: () => void;
  externalMessage?: { text: string; id: number } | null;
}

export function AiPanel({ fileContext, onAnalyzeFile, onAnalyzeFolder, externalMessage }: AiPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [contextAttached, setContextAttached] = useState(false);
  const [lastExternalId, setLastExternalId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      sendMessage(externalMessage.text, true);
    }
  }, [externalMessage]);

  // Auto-detach context if file changes
  useEffect(() => {
    setContextAttached(false);
  }, [fileContext?.path]);

  const sendMessage = (text: string, withContext = false) => {
    if (!text.trim() || chatMutation.isPending) return;

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    const shouldIncludeContext = (withContext || contextAttached) && fileContext;

    chatMutation.mutate({
      data: {
        messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        fileContext: shouldIncludeContext ? fileContext.content.slice(0, 12000) : null,
        filePath: shouldIncludeContext ? fileContext.path : null,
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage(text, contextAttached);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

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
              Faça perguntas sobre o código, peça explicações ou sugestões. Use o clipe para incluir o arquivo aberto como contexto.
            </p>
            {fileContext && (
              <div className="mt-4 flex flex-col gap-2 w-full max-w-[200px]">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-1.5 h-7"
                  onClick={onAnalyzeFile}
                >
                  <Sparkles className="w-3 h-3" />
                  Analisar arquivo
                </Button>
              </div>
            )}
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

      {/* Context pill */}
      {fileContext && (
        <div className="px-3 pb-1 shrink-0">
          <button
            type="button"
            onClick={() => setContextAttached((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-colors w-full max-w-full truncate",
              contextAttached
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-muted/50 border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
            title={contextAttached ? "Remover contexto do arquivo" : "Incluir arquivo como contexto"}
          >
            {contextAttached ? (
              <>
                <Paperclip className="w-3 h-3 shrink-0" />
                <span className="truncate">{fileContext.path.split("/").pop()}</span>
                <X className="w-3 h-3 ml-auto shrink-0" />
              </>
            ) : (
              <>
                <Paperclip className="w-3 h-3 shrink-0" />
                <span className="truncate">Incluir: {fileContext.path.split("/").pop()}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-2 shrink-0 border-t border-border bg-background/30">
        <div className="flex gap-1.5 items-end">
          <Textarea
            ref={textareaRef}
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
        </div>
      </form>
    </div>
  );
}
