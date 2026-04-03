import React, { useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { format } from "date-fns";
import {
  useListProjects,
  useUploadProject,
  useDeleteProject,
  useImportFromGithub,
  getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  FolderArchive,
  Loader2,
  Clock,
  HardDrive,
  FileCode2,
  Github,
  Upload,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");

  const { data: projects, isLoading } = useListProjects({
    query: {
      queryKey: getListProjectsQueryKey(),
    },
  });

  const uploadMutation = useUploadProject({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Projeto enviado com sucesso" });
        setLocation(`/projects/${data.id}`);
      },
      onError: (error) => {
        toast({
          title: "Falha no upload",
          description: error.error || "Erro desconhecido",
          variant: "destructive",
        });
      },
    },
  });

  const importGithubMutation = useImportFromGithub({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: `Repositório "${data.name}" importado com sucesso` });
        setGithubDialogOpen(false);
        setRepoUrl("");
        setBranch("");
        setLocation(`/projects/${data.id}`);
      },
      onError: (error) => {
        toast({
          title: "Falha ao importar",
          description: error.error || "Erro desconhecido",
          variant: "destructive",
        });
      },
    },
  });

  const deleteMutation = useDeleteProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Projeto excluído" });
      },
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".zip")) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Por favor, envie um arquivo .zip",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({
      data: { file, name: file.name.replace(".zip", "") },
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Tem certeza que deseja excluir este projeto?")) {
      deleteMutation.mutate({ projectId: id });
    }
  };

  const handleGithubImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    importGithubMutation.mutate({
      data: {
        repoUrl: repoUrl.trim(),
        branch: branch.trim() || null,
      },
    });
  };

  const isUploading = uploadMutation.isPending || importGithubMutation.isPending;

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto bg-background/50 p-8 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Workspace
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Selecione um projeto ou adicione um novo
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".zip"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                onClick={() => setGithubDialogOpen(true)}
                disabled={isUploading}
                className="gap-2"
              >
                <Github className="w-4 h-4" />
                Importar do GitHub
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="gap-2"
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Upload ZIP
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-40 rounded-lg border border-border bg-card animate-pulse"
                />
              ))}
            </div>
          ) : projects && projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="group relative flex flex-col h-full rounded-lg border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          {project.name.includes("/") ? (
                            <Github className="w-5 h-5" />
                          ) : (
                            <FolderArchive className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3
                            className="font-medium text-foreground truncate max-w-[180px]"
                            title={project.name}
                          >
                            {project.name.includes("/")
                              ? project.name.split("/")[1]
                              : project.name}
                          </h3>
                          {project.name.includes("/") && (
                            <p className="text-xs text-muted-foreground truncate">
                              {project.name.split("/")[0]}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDelete(e, project.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="mt-auto grid grid-cols-2 gap-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(project.createdAt), "dd/MM/yyyy")}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5" />
                        {formatBytes(project.sizeBytes)}
                      </div>
                      <div className="flex items-center gap-1.5 col-span-2">
                        <FileCode2 className="w-3.5 h-3.5" />
                        {project.fileCount} arquivos
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl bg-card/50">
              <FolderArchive className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                Nenhum projeto ainda
              </h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                Envie um arquivo ZIP ou importe diretamente do GitHub para começar.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setGithubDialogOpen(true)}
                  variant="outline"
                  className="gap-2"
                >
                  <Github className="w-4 h-4" />
                  Importar do GitHub
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Upload ZIP
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GitHub Import Dialog */}
      <Dialog open={githubDialogOpen} onOpenChange={setGithubDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Github className="w-5 h-5" />
              Importar do GitHub
            </DialogTitle>
            <DialogDescription>
              Cole a URL de um repositório público, ou privado se seu token GitHub estiver
              configurado em Configurações.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGithubImport}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="repoUrl">URL do Repositório</Label>
                <Input
                  id="repoUrl"
                  placeholder="https://github.com/usuario/repositorio"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  disabled={importGithubMutation.isPending}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch">
                  Branch{" "}
                  <span className="text-muted-foreground font-normal">
                    (opcional, padrão: branch principal)
                  </span>
                </Label>
                <Input
                  id="branch"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  disabled={importGithubMutation.isPending}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setGithubDialogOpen(false)}
                disabled={importGithubMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!repoUrl.trim() || importGithubMutation.isPending}
                className="gap-2"
              >
                {importGithubMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Github className="w-4 h-4" />
                    Importar
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
