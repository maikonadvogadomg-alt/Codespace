import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  GitBranch,
  Loader2,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Upload,
  Github,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GitCommitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface GitStatus {
  linked: boolean;
  owner: string | null;
  repoName: string | null;
  repoUrl: string | null;
  hasToken: boolean;
}

type Screen = "loading" | "not-linked" | "form" | "pushing" | "success" | "error";

export function GitCommitModal({ open, onOpenChange, projectId }: GitCommitModalProps) {
  const { toast } = useToast();
  const [screen, setScreen] = useState<Screen>("loading");
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [pushResult, setPushResult] = useState<{ commitSha: string; filesCommitted: number; repoUrl: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setScreen("loading");
    setCommitMessage("");
    setPushResult(null);
    setErrorMsg("");

    fetch(`/api/github/status/${projectId}`)
      .then(r => r.json())
      .then((data: GitStatus) => {
        setGitStatus(data);
        if (!data.linked) {
          setScreen("not-linked");
        } else {
          setScreen("form");
        }
      })
      .catch(() => {
        setScreen("error");
        setErrorMsg("Erro ao verificar status do GitHub");
      });
  }, [open, projectId]);

  const handlePush = async () => {
    if (!commitMessage.trim()) {
      toast({ title: "Digite uma mensagem de commit", variant: "destructive" });
      return;
    }
    setScreen("pushing");
    try {
      const res = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, commitMessage: commitMessage.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Erro ao enviar");
        setScreen("error");
        return;
      }
      setPushResult(data);
      setScreen("success");
    } catch (err) {
      setErrorMsg("Erro de conexão");
      setScreen("error");
    }
  };

  const canClose = screen !== "pushing";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (canClose) onOpenChange(v); }}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => { if (!canClose) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (!canClose) e.preventDefault(); }}
      >
        {screen === "loading" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verificando GitHub...</p>
          </div>
        )}

        {screen === "not-linked" && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                Projeto não vinculado
              </DialogTitle>
            </DialogHeader>
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
              Este projeto ainda não foi enviado ao GitHub.
              Use o botão <strong>GitHub</strong> (ícone do gato) para criar o repositório primeiro.
              Depois você pode usar o Commit para enviar atualizações.
            </div>
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Entendi
            </Button>
          </div>
        )}

        {screen === "form" && gitStatus && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-green-500" />
                Commit &amp; Push
              </DialogTitle>
            </DialogHeader>

            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm flex items-center gap-2">
              <Github className="w-4 h-4 text-green-500 shrink-0" />
              <div className="min-w-0">
                <span className="font-medium">{gitStatus.owner}/{gitStatus.repoName}</span>
                {gitStatus.repoUrl && (
                  <a href={gitStatus.repoUrl} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
                    Abrir <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mensagem do commit:</label>
              <Textarea
                placeholder="Descreva o que foi alterado..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="min-h-[80px] text-sm resize-none"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handlePush}
                disabled={!commitMessage.trim()}
              >
                <Upload className="w-4 h-4" />
                Enviar ao GitHub
              </Button>
            </div>
          </div>
        )}

        {screen === "pushing" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="font-medium">Enviando para o GitHub...</p>
              <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos</p>
            </div>
          </div>
        )}

        {screen === "success" && pushResult && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Enviado com sucesso!
              </DialogTitle>
            </DialogHeader>

            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Arquivos:</span>
                <span className="font-medium">{pushResult.filesCommitted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commit:</span>
                <span className="font-mono text-xs">{pushResult.commitSha.slice(0, 7)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <a href={pushResult.repoUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button className="w-full gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Ver no GitHub
                </Button>
              </a>
            </div>
          </div>
        )}

        {screen === "error" && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Erro
              </DialogTitle>
            </DialogHeader>
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm">
              {errorMsg}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button className="flex-1" onClick={() => setScreen("form")}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
