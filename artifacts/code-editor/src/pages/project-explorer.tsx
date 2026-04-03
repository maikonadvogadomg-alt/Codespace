import React, { useState, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import {
  useGetProject,
  useGetFileContent,
  getGetProjectQueryKey,
  getGetFileContentQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { FileTree } from "@/components/file-tree";
import { CodeViewer } from "@/components/code-viewer";
import { AiPanel } from "@/components/ai-panel";
import { TerminalPanel } from "@/components/terminal-panel";
import { GithubDeployModal } from "@/components/github-deploy-modal";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import {
  Github,
  Loader2,
  ArrowLeft,
  TerminalSquare,
  Terminal,
  Files,
  Code2,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { ImperativePanelHandle } from "react-resizable-panels";

type ContextMode = "none" | "file" | "project";
type MobileTab = "files" | "code" | "ai" | "terminal";

export default function ProjectExplorer() {
  const params = useParams();
  const projectId = params.id!;
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [selectedFile, setSelectedFile] = useState<string | undefined>(undefined);
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("files");
  const [pendingTerminalCommand, setPendingTerminalCommand] = useState<{ cmd: string; id: number } | null>(null);
  const [externalMessage, setExternalMessage] = useState<{ text: string; id: number; contextMode?: ContextMode } | null>(null);
  const terminalPanelRef = useRef<ImperativePanelHandle>(null);

  const { data: project, isLoading: isProjectLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  const { data: fileContent, isLoading: isFileLoading } = useGetFileContent(
    projectId,
    { params: { path: selectedFile! } },
    {
      query: {
        enabled: !!projectId && !!selectedFile,
        queryKey: getGetFileContentQueryKey(projectId, { path: selectedFile! }),
      },
    }
  );

  const [pendingAnalysisPath, setPendingAnalysisPath] = useState<string | null>(null);

  const triggerFileAnalysis = (path: string) => {
    const fileName = path.split("/").pop() ?? path;
    setExternalMessage({
      text: `Analise o arquivo "${fileName}". Explique o que ele faz, suas responsabilidades e aponte possíveis melhorias.`,
      id: Date.now(),
      contextMode: "file",
    });
    if (isMobile) setMobileTab("ai");
  };

  const handleAnalyzeFileClick = (path: string) => {
    if (selectedFile === path && fileContent) {
      triggerFileAnalysis(path);
    } else {
      setSelectedFile(path);
      setPendingAnalysisPath(path);
    }
  };

  React.useEffect(() => {
    if (pendingAnalysisPath && selectedFile === pendingAnalysisPath && fileContent) {
      triggerFileAnalysis(pendingAnalysisPath);
      setPendingAnalysisPath(null);
    }
  }, [pendingAnalysisPath, selectedFile, fileContent]);

  const handleAnalyzeFolderClick = (folderPath: string) => {
    const folderName = (folderPath.split("/").pop() ?? folderPath) || "raiz";
    setExternalMessage({
      text: `Analise a pasta "${folderName}" do projeto. Explique seu papel na arquitetura geral.`,
      id: Date.now(),
    });
    if (isMobile) setMobileTab("ai");
  };

  const handleSelectFile = (path: string) => {
    setSelectedFile(path);
    if (isMobile) setMobileTab("code");
  };

  const handleRunCommand = useCallback((cmd: string) => {
    setPendingTerminalCommand({ cmd, id: Date.now() });
    if (isMobile) {
      setMobileTab("terminal");
    } else {
      setTerminalOpen(true);
    }
  }, [isMobile]);

  const fileContextForAi = fileContent
    ? { path: fileContent.path, content: fileContent.content, language: fileContent.language }
    : null;

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (isProjectLoading) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center text-muted-foreground">
          Projeto não encontrado.
        </div>
      </AppLayout>
    );
  }

  // ─── Mobile Layout ───────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <AppLayout hideBottomNav>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Mobile header */}
          <header className="h-12 shrink-0 border-b border-border bg-card flex items-center px-3 gap-2 z-10">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <TerminalSquare className="w-4 h-4 text-primary shrink-0" />
              <span className="font-medium text-sm text-foreground truncate">{project.name}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setGithubModalOpen(true)}
              className="h-8 w-8 p-0 shrink-0 text-muted-foreground"
            >
              <Github className="w-4 h-4" />
            </Button>
          </header>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {/* Files tab */}
            <div className={cn("h-full overflow-auto", mobileTab !== "files" && "hidden")}>
              <div className="h-9 flex items-center px-4 border-b border-border/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-background/30">
                Explorer
              </div>
              <div className="p-2">
                <FileTree
                  node={project.tree}
                  onSelectFile={handleSelectFile}
                  onAnalyzeFile={handleAnalyzeFileClick}
                  onAnalyzeFolder={handleAnalyzeFolderClick}
                  selectedPath={selectedFile}
                />
              </div>
            </div>

            {/* Code tab */}
            <div className={cn("h-full flex flex-col", mobileTab !== "code" && "hidden")}>
              {!selectedFile ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                  <Files className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">Selecione um arquivo na aba Arquivos</p>
                </div>
              ) : (
                <CodeViewer file={fileContent} isLoading={isFileLoading && !!selectedFile} />
              )}
            </div>

            {/* AI tab */}
            <div className={cn("h-full", mobileTab !== "ai" && "hidden")}>
              <AiPanel
                projectId={projectId}
                fileContext={fileContextForAi}
                externalMessage={externalMessage}
                onRunCommand={handleRunCommand}
              />
            </div>

            {/* Terminal tab */}
            <div className={cn("h-full", mobileTab !== "terminal" && "hidden")}>
              <TerminalPanel
                projectId={projectId}
                pendingCommand={pendingTerminalCommand}
              />
            </div>
          </div>

          {/* Mobile bottom tab bar */}
          <nav className="shrink-0 h-14 border-t border-border bg-card flex items-stretch">
            <MobileTab
              label="Arquivos"
              icon={<Files className="w-5 h-5" />}
              active={mobileTab === "files"}
              onClick={() => setMobileTab("files")}
            />
            <MobileTab
              label="Código"
              icon={<Code2 className="w-5 h-5" />}
              active={mobileTab === "code"}
              onClick={() => setMobileTab("code")}
              badge={selectedFile ? selectedFile.split("/").pop() : undefined}
            />
            <MobileTab
              label="IA"
              icon={<Sparkles className="w-5 h-5" />}
              active={mobileTab === "ai"}
              onClick={() => setMobileTab("ai")}
            />
            <MobileTab
              label="Terminal"
              icon={<Terminal className="w-5 h-5" />}
              active={mobileTab === "terminal"}
              onClick={() => setMobileTab("terminal")}
            />
          </nav>
        </div>

        <GithubDeployModal
          open={githubModalOpen}
          onOpenChange={setGithubModalOpen}
          projectId={project.id}
          defaultName={project.name}
        />
      </AppLayout>
    );
  }

  // ─── Desktop Layout ──────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <header className="h-12 shrink-0 border-b border-border bg-card flex items-center px-4 justify-between z-10">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 px-2 border-l border-border/50">
              <TerminalSquare className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm text-foreground">{project.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setTerminalOpen((v) => !v)}
              className={cn(
                "gap-2 h-8 px-3 border",
                terminalOpen
                  ? "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <Terminal className="w-3.5 h-3.5" />
              Terminal
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setGithubModalOpen(true)}
              className="gap-2 bg-background hover:bg-accent border border-border h-8 px-3"
            >
              <Github className="w-4 h-4" />
              Enviar ao GitHub
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={terminalOpen ? 65 : 100} minSize={30}>
              <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-sidebar flex flex-col">
                  <div className="h-9 shrink-0 flex items-center px-4 border-b border-border/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-background/30">
                    Explorer
                  </div>
                  <div className="flex-1 overflow-auto p-2">
                    <FileTree
                      node={project.tree}
                      onSelectFile={setSelectedFile}
                      onAnalyzeFile={handleAnalyzeFileClick}
                      onAnalyzeFolder={handleAnalyzeFolderClick}
                      selectedPath={selectedFile}
                    />
                  </div>
                </ResizablePanel>
                <ResizableHandle className="bg-border w-[1px] hover:w-1 hover:bg-primary/50 transition-all" />
                <ResizablePanel defaultSize={50} minSize={30}>
                  <CodeViewer file={fileContent} isLoading={isFileLoading && !!selectedFile} />
                </ResizablePanel>
                <ResizableHandle className="bg-border w-[1px] hover:w-1 hover:bg-primary/50 transition-all" />
                <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                  <AiPanel
                    projectId={projectId}
                    fileContext={fileContextForAi}
                    externalMessage={externalMessage}
                    onRunCommand={handleRunCommand}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>

            {terminalOpen && (
              <>
                <ResizableHandle className="bg-border h-[1px] hover:h-1 hover:bg-green-500/50 transition-all" />
                <ResizablePanel
                  ref={terminalPanelRef}
                  defaultSize={35}
                  minSize={15}
                  maxSize={60}
                >
                  <TerminalPanel
                    projectId={projectId}
                    onClose={() => setTerminalOpen(false)}
                    pendingCommand={pendingTerminalCommand}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      </div>

      <GithubDeployModal
        open={githubModalOpen}
        onOpenChange={setGithubModalOpen}
        projectId={project.id}
        defaultName={project.name}
      />
    </AppLayout>
  );
}

// ─── Mobile Tab Button ───────────────────────────────────────────────────────

function MobileTab({
  label,
  icon,
  active,
  onClick,
  badge,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      {active && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full" />
      )}
      {icon}
      <span>{label}</span>
      {badge && (
        <span className="absolute top-1.5 right-3 text-[8px] bg-primary/20 text-primary px-1 rounded-full max-w-[60px] truncate">
          {badge}
        </span>
      )}
    </button>
  );
}
