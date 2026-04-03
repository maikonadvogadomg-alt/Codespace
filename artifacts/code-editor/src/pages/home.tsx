import React, { useRef } from "react";
import { useLocation, Link } from "wouter";
import { format } from "date-fns";
import { useListProjects, useUploadProject, useDeleteProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, FolderArchive, ArrowRight, Loader2, Clock, HardDrive, FileCode2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: projects, isLoading } = useListProjects({
    query: {
      queryKey: getListProjectsQueryKey()
    }
  });

  const uploadMutation = useUploadProject({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Project uploaded successfully" });
        setLocation(`/projects/${data.id}`);
      },
      onError: (error) => {
        toast({ 
          title: "Upload failed", 
          description: error.error || "An unknown error occurred",
          variant: "destructive" 
        });
      }
    }
  });

  const deleteMutation = useDeleteProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Project deleted" });
      }
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a .zip file",
        variant: "destructive"
      });
      return;
    }

    uploadMutation.mutate({
      data: { file, name: file.name.replace('.zip', '') }
    });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); // Prevent navigating to project
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this project?")) {
      deleteMutation.mutate({ projectId: id });
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto bg-background/50 p-8 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workspace</h1>
              <p className="text-sm text-muted-foreground mt-1">Select a project or upload a new one to begin</p>
            </div>
            
            <div>
              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".zip" 
                className="hidden" 
                onChange={handleFileSelect}
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                className="gap-2"
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Upload ZIP
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-40 rounded-lg border border-border bg-card animate-pulse" />
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
                          <FolderArchive className="w-5 h-5" />
                        </div>
                        <h3 className="font-medium text-foreground truncate max-w-[180px]" title={project.name}>
                          {project.name}
                        </h3>
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
                        {format(new Date(project.createdAt), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5" />
                        {formatBytes(project.sizeBytes)}
                      </div>
                      <div className="flex items-center gap-1.5 col-span-2">
                        <FileCode2 className="w-3.5 h-3.5" />
                        {project.fileCount} files
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl bg-card/50">
              <FolderArchive className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No projects yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Upload a ZIP file containing your code to get started.</p>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                Browse Files
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
