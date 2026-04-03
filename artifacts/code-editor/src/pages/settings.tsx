import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useGetSettings,
  useUpdateSettings,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
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
import {
  Loader2,
  Settings2,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Provider detection ──────────────────────────────────────────────────────

interface Provider {
  name: string;
  color: string;
  baseUrl: string;
  model: string;
  hint: string;
}

const PROVIDERS: { match: (key: string) => boolean; provider: Provider }[] = [
  {
    match: (k) => k.startsWith("sk-ant-"),
    provider: {
      name: "Anthropic",
      color: "text-orange-400 bg-orange-400/10 border-orange-400/30",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-3-5-sonnet-20241022",
      hint: "Claude 3.5 Sonnet",
    },
  },
  {
    match: (k) => k.startsWith("AIzaSy"),
    provider: {
      name: "Google Gemini",
      color: "text-blue-400 bg-blue-400/10 border-blue-400/30",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
      model: "gemini-2.0-flash",
      hint: "Gemini 2.0 Flash",
    },
  },
  {
    match: (k) => k.startsWith("gsk_"),
    provider: {
      name: "Groq",
      color: "text-purple-400 bg-purple-400/10 border-purple-400/30",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b-versatile",
      hint: "Llama 3.3 70B",
    },
  },
  {
    match: (k) => k.startsWith("xai-"),
    provider: {
      name: "xAI (Grok)",
      color: "text-gray-300 bg-gray-300/10 border-gray-300/30",
      baseUrl: "https://api.x.ai/v1",
      model: "grok-2-latest",
      hint: "Grok 2",
    },
  },
  {
    match: (k) => k.startsWith("sk-or-"),
    provider: {
      name: "OpenRouter",
      color: "text-green-400 bg-green-400/10 border-green-400/30",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "anthropic/claude-3.5-sonnet",
      hint: "Claude 3.5 via OpenRouter",
    },
  },
  {
    match: (k) =>
      k.startsWith("sk-") &&
      !k.startsWith("sk-ant-") &&
      !k.startsWith("sk-or-"),
    provider: {
      name: "OpenAI",
      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      hint: "GPT-4o",
    },
  },
  {
    match: (k) =>
      k.length > 20 &&
      (k.includes("mistral") || k.match(/^[a-zA-Z0-9]{32,}$/) !== null),
    provider: {
      name: "Mistral",
      color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
      baseUrl: "https://api.mistral.ai/v1",
      model: "mistral-large-latest",
      hint: "Mistral Large",
    },
  },
];

function detectProvider(key: string): Provider | null {
  if (!key || key.length < 8) return null;
  for (const { match, provider } of PROVIDERS) {
    if (match(key)) return provider;
  }
  return null;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  aiApiKey: z.string().optional(),
  aiBaseUrl: z.string().optional(),
  aiModel: z.string().optional(),
  githubToken: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [detectedProvider, setDetectedProvider] = useState<Provider | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [showGhToken, setShowGhToken] = useState(false);

  const { data: settings, isLoading } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() },
  });

  const updateMutation = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Configurações salvas com sucesso" });
      },
      onError: (error) => {
        toast({
          title: "Erro ao salvar",
          description: error.error || "Erro desconhecido",
          variant: "destructive",
        });
      },
    },
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { aiApiKey: "", aiBaseUrl: "", aiModel: "", githubToken: "" },
  });

  React.useEffect(() => {
    if (settings) {
      form.reset({
        aiApiKey: "",
        aiBaseUrl: settings.aiBaseUrl || "",
        aiModel: settings.aiModel || "",
        githubToken: "",
      });
    }
  }, [settings, form]);

  // Auto-detect provider when key changes
  const handleKeyChange = (value: string, fieldOnChange: (v: string) => void) => {
    fieldOnChange(value);
    const provider = detectProvider(value.trim());
    setDetectedProvider(provider);
    if (provider) {
      form.setValue("aiBaseUrl", provider.baseUrl);
      form.setValue("aiModel", provider.model);
    }
  };

  const onSubmit = (data: SettingsFormValues) => {
    updateMutation.mutate({
      data: {
        aiApiKey: data.aiApiKey || undefined,
        aiBaseUrl: data.aiBaseUrl || undefined,
        aiModel: data.aiModel || undefined,
        githubToken: data.githubToken || undefined,
      },
    });
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto bg-background p-4 sm:p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                Configurações
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure sua IA e integrações
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-card rounded-lg border border-border" />
              ))}
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* AI Section */}
                <div className="p-5 sm:p-6 rounded-xl border border-border bg-card/50 space-y-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h2 className="text-base font-medium text-foreground">
                      Configuração da IA
                    </h2>
                  </div>

                  {/* API Key with auto-detect */}
                  <FormField
                    control={form.control}
                    name="aiApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Chave de API</FormLabel>
                          {settings?.aiApiKeySet && !field.value && (
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-primary flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Configurada
                            </span>
                          )}
                        </div>

                        {/* Detected provider badge */}
                        {detectedProvider && (
                          <div
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium mb-1",
                              detectedProvider.color
                            )}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              <strong>{detectedProvider.name}</strong> detectado —{" "}
                              URL e modelo preenchidos automaticamente
                              {" "}({detectedProvider.hint})
                            </span>
                          </div>
                        )}

                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showKey ? "text" : "password"}
                              placeholder={
                                settings?.aiApiKeySet
                                  ? "••••••••••••••••  (cole para substituir)"
                                  : "Cole sua chave aqui — sk-..., AIzaSy..., gsk_..."
                              }
                              {...field}
                              onChange={(e) =>
                                handleKeyChange(e.target.value, field.onChange)
                              }
                              className="bg-background pr-10 font-mono text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setShowKey((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                            >
                              {showKey ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Cole sua chave — o provedor é detectado automaticamente.
                          Deixe em branco para manter a chave atual.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Providers quick guide */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { name: "OpenAI", prefix: "sk-…", color: "text-emerald-400" },
                      { name: "Anthropic", prefix: "sk-ant-…", color: "text-orange-400" },
                      { name: "Gemini", prefix: "AIzaSy…", color: "text-blue-400" },
                      { name: "Groq", prefix: "gsk_…", color: "text-purple-400" },
                      { name: "OpenRouter", prefix: "sk-or-…", color: "text-green-400" },
                      { name: "xAI (Grok)", prefix: "xai-…", color: "text-gray-300" },
                    ].map(({ name, prefix, color }) => (
                      <div
                        key={name}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-background/60 border border-border/40 text-[11px]"
                      >
                        <span className={cn("font-semibold shrink-0", color)}>{name}</span>
                        <code className="text-muted-foreground truncate">{prefix}</code>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FormField
                      control={form.control}
                      name="aiBaseUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL Base</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://api.openai.com/v1"
                              {...field}
                              className="bg-background font-mono text-xs"
                            />
                          </FormControl>
                          <FormDescription>
                            Preenchida automaticamente
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
                          <FormLabel>Modelo</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="gpt-4o"
                              {...field}
                              className="bg-background font-mono text-xs"
                            />
                          </FormControl>
                          <FormDescription>
                            Preenchido automaticamente
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* GitHub Section */}
                <div className="p-5 sm:p-6 rounded-xl border border-border bg-card/50 space-y-5">
                  <h2 className="text-base font-medium text-foreground">GitHub</h2>

                  <FormField
                    control={form.control}
                    name="githubToken"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Token de Acesso Pessoal</FormLabel>
                          {settings?.githubTokenSet ? (
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-primary flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Configurado
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> Não configurado
                            </span>
                          )}
                        </div>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showGhToken ? "text" : "password"}
                              placeholder={
                                settings?.githubTokenSet
                                  ? "••••••••••••••••  (cole para substituir)"
                                  : "ghp_..."
                              }
                              {...field}
                              className="bg-background pr-10 font-mono text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setShowGhToken((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                            >
                              {showGhToken ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Necessário para exportar projetos ao GitHub. Precisa da
                          permissão <code>repo</code>.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end pb-6">
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="min-w-[140px]"
                  >
                    {updateMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Salvar configurações
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
