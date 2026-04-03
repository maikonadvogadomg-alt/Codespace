import React, { useState } from "react";
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
import { GithubDeployModal } from "@/components/github-deploy-modal";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Github, Loader2, ArrowLeft, TerminalSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProjectExplorer() {
  const params = useParams();
  const projectId = params.id!;
  const { toast } = useToast();

  const [selectedFile, setSelectedFile] = useState<string | undefined>(undefined);
  const [githubModalOpen, setGithubModalOpen] = useState(false);

  // External AI trigger: bumping this id sends a message to the AI panel
  const [externalMessage, setExternalMessage] = useState<{ text: string; id: number } | null>(null);

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

  // Track pending analysis path (so we can load file then trigger)
  const [pendingAnalysisPath, setPendingAnalysisPath] = useState<string | null>(null);

  const triggerFileAnalysis = (path: string, content: string) => {
    const fileName = path.split("/").pop() ?? path;
    setExternalMessage({
      text: `Analise o arquivo "${fileName}". Explique o que ele faz, suas responsabilidades principais e aponte possíveis problemas ou melhorias.`,
      id: Date.now(),
    });
  };

  const handleAnalyzeFileClick = (path: string) => {
    if (selectedFile === path && fileContent) {
      triggerFileAnalysis(path, fileContent.content);
    } else {
      setSelectedFile(path);
      setPendingAnalysisPath(path);
    }
  };

  React.useEffect(() => {
    if (pendingAnalysisPath && selectedFile === pendingAnalysisPath && fileContent) {
      triggerFileAnalysis(pendingAnalysisPath, fileContent.content);
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
          <div className="flex items-center">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setGithubModalOpen(true)}
              className="gap-2 bg-background hover:bg-accent border border-border"
            >
              <Github className="w-4 h-4" />
              Enviar para GitHub
            </Button>
          </div>
        </header>

        {/* 3-Panel Layout */}
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            {/* Left Panel: File Tree */}
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

            {/* Center Panel: Code Viewer */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <CodeViewer
                file={fileContent}
                isLoading={isFileLoading && !!selectedFile}
              />
            </ResizablePanel>

            <ResizableHandle className="bg-border w-[1px] hover:w-1 hover:bg-primary/50 transition-all" />

            {/* Right Panel: AI Chat */}
            <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
              <AiPanel
                projectId={projectId}
                fileContext={fileContextForAi}
                externalMessage={externalMessage}
              />
            </ResizablePanel>
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
