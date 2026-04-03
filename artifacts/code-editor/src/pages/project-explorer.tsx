import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetProject, 
  useGetFileContent, 
  useAnalyzeFile, 
  useAnalyzeFolder,
  getGetProjectQueryKey,
  getGetFileContentQueryKey
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
  
  // AI State
  const [aiTarget, setAiTarget] = useState<{ path: string, type: "file" | "folder" } | undefined>();

  const { data: project, isLoading: isProjectLoading } = useGetProject(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: getGetProjectQueryKey(projectId)
    }
  });

  const { data: fileContent, isLoading: isFileLoading } = useGetFileContent(
    projectId, 
    { params: { path: selectedFile! } },
    {
      query: {
        enabled: !!projectId && !!selectedFile,
        queryKey: getGetFileContentQueryKey(projectId, { path: selectedFile! })
      }
    }
  );

  const analyzeFileMutation = useAnalyzeFile({
    mutation: {
      onError: (error) => {
        toast({ title: "Analysis failed", description: error.error, variant: "destructive" });
      }
    }
  });

  const analyzeFolderMutation = useAnalyzeFolder({
    mutation: {
      onError: (error) => {
        toast({ title: "Analysis failed", description: error.error, variant: "destructive" });
      }
    }
  });

  const handleAnalyzeFile = (path: string) => {
    // Need content to analyze file
    // Ideally we'd fetch it if not selected, but for now let's just trigger if selected, or we could fetch it via API
    // Actually, the useAnalyzeFile mutation requires `content`. Wait, the requirement says we send { projectId, filePath, content }.
    // If we only have path from the tree, how do we get content? 
    // Let's just make them select it first, OR we can use the API. 
    // Oh, the backend schema for `analyzeFileRequest` requires `content`.
    // Let's just use the currently selected file content if it matches.
    if (selectedFile !== path || !fileContent) {
      // Auto select it so it loads
      setSelectedFile(path);
      toast({ title: "Loading file for analysis..." });
      // We will trigger analysis in an effect once loaded, but that's messy.
      // Let's just require them to open it first or handle it gracefully.
      return;
    }

    setAiTarget({ path, type: "file" });
    analyzeFileMutation.mutate({
      data: {
        projectId,
        filePath: path,
        content: fileContent.content
      }
    });
  };

  // We need a small effect to handle auto-analyzing if we selected a file for analysis
  const [pendingAnalysisPath, setPendingAnalysisPath] = useState<string | null>(null);

  const handleAnalyzeFileClick = (path: string) => {
    if (selectedFile === path && fileContent) {
      setAiTarget({ path, type: "file" });
      analyzeFileMutation.mutate({
        data: { projectId, filePath: path, content: fileContent.content }
      });
    } else {
      setSelectedFile(path);
      setPendingAnalysisPath(path);
    }
  };

  React.useEffect(() => {
    if (pendingAnalysisPath && selectedFile === pendingAnalysisPath && fileContent) {
      setAiTarget({ path: pendingAnalysisPath, type: "file" });
      analyzeFileMutation.mutate({
        data: { projectId, filePath: pendingAnalysisPath, content: fileContent.content }
      });
      setPendingAnalysisPath(null);
    }
  }, [pendingAnalysisPath, selectedFile, fileContent, projectId, analyzeFileMutation]);


  const handleAnalyzeFolderClick = (path: string) => {
    setAiTarget({ path, type: "folder" });
    analyzeFolderMutation.mutate({
      data: { projectId, folderPath: path }
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
          Project not found.
        </div>
      </AppLayout>
    );
  }

  const isAiLoading = analyzeFileMutation.isPending || analyzeFolderMutation.isPending;
  const activeAnalysis = analyzeFileMutation.data || analyzeFolderMutation.data;

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
            <Button size="sm" variant="secondary" onClick={() => setGithubModalOpen(true)} className="gap-2 bg-background hover:bg-accent border border-border">
              <Github className="w-4 h-4" />
              Send to GitHub
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

            {/* Right Panel: AI Analysis */}
            <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
              <AiPanel 
                analysis={activeAnalysis} 
                isLoading={isAiLoading} 
                activePath={aiTarget?.path}
                activeType={aiTarget?.type}
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
