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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ImperativePanelHandle } from "react-resizable-panels";

type ContextMode = "none" | "file" | "project";

export default function ProjectExplorer() {
  const params = useParams();
  const projectId = params.id!;
  const { toast } = useToast();

  const [selectedFile, setSelectedFile] = useState<string | undefined>(undefined);
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [pendingTerminalCommand, setPendingTerminalCommand] = useState<{ cmd: string; id: number } | null>(null);

  // External AI trigger
  const [externalMessage, setExternalMessage] = useState<{ text: string; id: number; contextMode?: ContextMode } | null>(null);

  const terminalPanelRef = useRef<ImperativePanelHandle>(null);

  const { data: project, isLoading: isProjectLoading } = useGetProject(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: getGetProjectQueryKey(projectId),
    },
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
      text: `Analise o arquivo "${fileName}". Explique o que ele faz, suas responsabilidades principais e aponte possíveis problemas ou melhorias.`,
      id: Date.now(),
      contextMode: "file",
    });
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
      text: `Analise a pasta "${folderName}" do projeto. Explique qual é o papel desta pasta na arquitetura geral do projeto.`,
      id: Date.now(),
    });
  };

  // Called by AiPanel when user clicks "Executar no terminal"
  const handleRunCommand = useCallback((cmd: string) => {
    setTerminalOpen(true);
    setPendingTerminalCommand({ cmd, id: Date.now() });
  }, []);

  // Auto-send pending command to terminal
  React.useEffect(() => {
    if (pendingTerminalCommand && terminalOpen) {
      // Terminal will pick it up via prop
    }
  }, [pendingTerminalCommand, terminalOpen]);

  const toggleTerminal = () => {
    setTerminalOpen((v) => !v);
  };

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

  const fileContextForAi = fileContent
    ? { path: fileContent.path, content: fileContent.content, language: fileContent.language }
    : null;

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top Bar */}
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
              onClick={toggleTerminal}
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

        {/* Main area — horizontal panels */}
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="vertical">
            {/* Top section: File tree + Editor + AI */}
            <ResizablePanel defaultSize={terminalOpen ? 65 : 100} minSize={30}>
              <ResizablePanelGroup direction="horizontal">
                {/* File Tree */}
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

                {/* Code Viewer */}
                <ResizablePanel defaultSize={50} minSize={30}>
                  <CodeViewer
                    file={fileContent}
                    isLoading={isFileLoading && !!selectedFile}
                  />
                </ResizablePanel>

                <ResizableHandle className="bg-border w-[1px] hover:w-1 hover:bg-primary/50 transition-all" />

                {/* AI Chat */}
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

            {/* Terminal Panel (bottom) */}
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
