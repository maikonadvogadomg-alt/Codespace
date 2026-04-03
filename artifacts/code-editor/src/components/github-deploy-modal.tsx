import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateGithubRepo } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Github, Loader2 } from "lucide-react";

const repoSchema = z.object({
  repoName: z.string().min(1, "Repository name is required").regex(/^[a-zA-Z0-9_.-]+$/, "Invalid repository name format"),
  description: z.string().optional(),
  isPrivate: z.boolean().default(true),
});

type RepoFormValues = z.infer<typeof repoSchema>;

interface GithubDeployModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  defaultName?: string;
}

export function GithubDeployModal({ open, onOpenChange, projectId, defaultName = "codelens-project" }: GithubDeployModalProps) {
  const { toast } = useToast();

  const form = useForm<RepoFormValues>({
    resolver: zodResolver(repoSchema),
    defaultValues: {
      repoName: defaultName.replace(/[^a-zA-Z0-9_.-]/g, "-"),
      description: "Exported from CodeLens",
      isPrivate: true,
    },
  });

  // Reset form when opened with new default name
  React.useEffect(() => {
    if (open) {
      form.reset({
        repoName: defaultName.replace(/[^a-zA-Z0-9_.-]/g, "-"),
        description: "Exported from CodeLens",
        isPrivate: true,
      });
    }
  }, [open, defaultName, form]);

  const deployMutation = useCreateGithubRepo({
    mutation: {
      onSuccess: (data) => {
        toast({ 
          title: "Repository created!", 
          description: `Successfully committed ${data.filesCommitted} files.`,
        });
        window.open(data.repoUrl, "_blank");
        onOpenChange(false);
      },
      onError: (error) => {
        toast({
          title: "Failed to deploy",
          description: error.error || "An unknown error occurred. Have you set your GitHub token in settings?",
          variant: "destructive"
        });
      }
    }
  });

  const onSubmit = (data: RepoFormValues) => {
    deployMutation.mutate({
      data: {
        projectId,
        repoName: data.repoName,
        description: data.description || undefined,
        isPrivate: data.isPrivate,
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            Send to GitHub
          </DialogTitle>
          <DialogDescription>
            Create a new repository and push all project files directly to GitHub.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="repoName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repository Name</FormLabel>
                  <FormControl>
                    <Input placeholder="my-awesome-project" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="A short description of this repository" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isPrivate"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-card/50">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Private Repository</FormLabel>
                    <FormDescription>
                      Only you can see this repository
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={deployMutation.isPending} className="gap-2">
                {deployMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create & Push
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
