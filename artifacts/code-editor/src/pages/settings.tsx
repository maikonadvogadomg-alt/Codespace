import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings2, CheckCircle2, ShieldAlert } from "lucide-react";

const settingsSchema = z.object({
  aiApiKey: z.string().optional(),
  aiBaseUrl: z.string().optional(),
  aiModel: z.string().optional(),
  githubToken: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetSettings({
    query: {
      queryKey: getGetSettingsQueryKey()
    }
  });

  const updateMutation = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Settings saved successfully" });
      },
      onError: (error) => {
        toast({
          title: "Failed to save settings",
          description: error.error || "An unknown error occurred",
          variant: "destructive"
        });
      }
    }
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      aiApiKey: "",
      aiBaseUrl: settings?.aiBaseUrl || "",
      aiModel: settings?.aiModel || "",
      githubToken: "",
    },
  });

  // Update default values when settings load
  React.useEffect(() => {
    if (settings) {
      form.reset({
        aiApiKey: "", // Don't populate passwords
        aiBaseUrl: settings.aiBaseUrl || "",
        aiModel: settings.aiModel || "",
        githubToken: "", // Don't populate passwords
      });
    }
  }, [settings, form]);

  const onSubmit = (data: SettingsFormValues) => {
    updateMutation.mutate({
      data: {
        aiApiKey: data.aiApiKey || undefined,
        aiBaseUrl: data.aiBaseUrl || undefined,
        aiModel: data.aiModel || undefined,
        githubToken: data.githubToken || undefined,
      }
    });
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto bg-background p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground mt-1">Configure AI providers and integrations</p>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-card rounded-lg border border-border" />
              ))}
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* AI Configuration Section */}
                <div className="p-6 rounded-xl border border-border bg-card/50 space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-lg font-medium text-foreground">AI Configuration</h2>
                  </div>

                  <FormField
                    control={form.control}
                    name="aiApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>API Key</FormLabel>
                          {settings?.aiApiKeySet && (
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-primary flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Configured
                            </span>
                          )}
                        </div>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder={settings?.aiApiKeySet ? "••••••••••••••••" : "sk-..."} 
                            {...field} 
                            className="bg-background"
                          />
                        </FormControl>
                        <FormDescription>
                          Leave blank to keep existing key.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="aiBaseUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://api.openai.com/v1" {...field} className="bg-background" />
                          </FormControl>
                          <FormDescription>
                            Custom API endpoint (optional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="aiModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input placeholder="gpt-4o" {...field} className="bg-background" />
                          </FormControl>
                          <FormDescription>
                            Override default model
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Integrations Section */}
                <div className="p-6 rounded-xl border border-border bg-card/50 space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-lg font-medium text-foreground">Integrations</h2>
                  </div>

                  <FormField
                    control={form.control}
                    name="githubToken"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>GitHub Personal Access Token</FormLabel>
                          {settings?.githubTokenSet ? (
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-primary flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Configured
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> Not Configured
                            </span>
                          )}
                        </div>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder={settings?.githubTokenSet ? "••••••••••••••••" : "ghp_..."} 
                            {...field} 
                            className="bg-background"
                          />
                        </FormControl>
                        <FormDescription>
                          Required for exporting projects to GitHub. Needs 'repo' scope.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={updateMutation.isPending} className="min-w-[120px]">
                    {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Settings
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
