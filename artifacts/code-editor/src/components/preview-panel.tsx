import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Monitor,
  RefreshCw,
  ExternalLink,
  Play,
  Loader2,
  Smartphone,
  Tablet,
  FileCode,
  Eye,
  Package,
  Hammer,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PreviewStatus {
  ready: boolean;
  entry: string | null;
}

type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_WIDTHS: Record<Viewport, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

interface PreviewPanelProps {
  projectId: string;
  onRunBuild?: (cmd: string) => void;
  previewPath?: string;
}

export function PreviewPanel({ projectId, onRunBuild, previewPath }: PreviewPanelProps) {
  const [status, setStatus] = useState<PreviewStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
  const previewBase = `${base}/api/projects/${projectId}/preview`;

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/projects/${projectId}/preview/status`);
      const data: PreviewStatus = await res.json();
      setStatus(data);
    } catch {
      setStatus({ ready: false, entry: null });
    } finally {
      setLoading(false);
    }
  }, [projectId, base]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => { setIframeKey((k) => k + 1); }, [previewPath]);

  const reload = () => {
    fetchStatus();
    setIframeKey((k) => k + 1);
  };

  const isFilePreview = !!previewPath;
  const iframeUrl = isFilePreview
    ? `${previewBase}/${previewPath.replace(/^\//, "")}`
    : `${previewBase}/`;

  const entryLabel = isFilePreview ? previewPath : (status?.entry ?? null);
  const canShow = isFilePreview || status?.ready;

  return (
    <div className="h-full w-full flex flex-col bg-[#0d1117]">
      {/* Toolbar */}
      <div className="h-10 shrink-0 border-b border-[#30363d] bg-[#161b22] flex items-center px-3 gap-2">
        <Monitor className="w-4 h-4 text-[#8b949e] shrink-0" />
        <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider flex-1">
          Preview
        </span>

        {isFilePreview && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-[10px] text-blue-400 font-mono truncate max-w-[160px]">
            <Eye className="w-2.5 h-2.5 shrink-0" />
            {previewPath.split("/").pop()}
          </span>
        )}

        {/* Viewport switcher */}
        <div className="flex items-center gap-0.5 bg-[#0d1117] rounded px-0.5 py-0.5">
          {(["desktop", "tablet", "mobile"] as Viewport[]).map((v) => {
            const Icon = v === "desktop" ? Monitor : v === "tablet" ? Tablet : Smartphone;
            return (
              <button
                key={v}
                onClick={() => setViewport(v)}
                className={cn(
                  "p-1 rounded transition-colors",
                  viewport === v ? "bg-[#30363d] text-[#e6edf3]" : "text-[#8b949e] hover:text-[#e6edf3]"
                )}
                title={v.charAt(0).toUpperCase() + v.slice(1)}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>

        <div className="w-px h-4 bg-[#30363d]" />

        {onRunBuild && !status?.ready && !isFilePreview && (
          <button
            onClick={() => onRunBuild("npm run build")}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-colors"
            title="Executar build"
          >
            <Play className="w-3 h-3" />
            Build
          </button>
        )}

        <button
          onClick={reload}
          className="p-1.5 rounded text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] transition-colors"
          title="Recarregar preview"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {canShow && (
          <button
            onClick={() => window.open(iframeUrl, "_blank")}
            className="p-1.5 rounded text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] transition-colors"
            title="Abrir em nova aba"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Entry file indicator */}
      {entryLabel && (
        <div className="shrink-0 px-3 py-1 bg-[#161b22] border-b border-[#30363d] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
          <span className="text-[10px] text-[#8b949e] font-mono truncate">{entryLabel}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto flex items-start justify-center bg-[#1a1f26] p-0">
        {loading && !isFilePreview ? (
          <div className="flex-1 h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#8b949e]" />
          </div>
        ) : !canShow ? (
          <EmptyState onRunBuild={onRunBuild} onReload={reload} />
        ) : (
          <div
            className={cn(
              "h-full bg-white transition-all duration-300",
              viewport === "desktop" ? "w-full" : "shadow-2xl"
            )}
            style={{
              width: VIEWPORT_WIDTHS[viewport],
              minWidth: viewport !== "desktop" ? VIEWPORT_WIDTHS[viewport] : undefined,
            }}
          >
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={iframeUrl}
              className="w-full h-full border-0"
              title="Project Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  onRunBuild,
  onReload,
}: {
  onRunBuild?: (cmd: string) => void;
  onReload: () => void;
}) {
  const [installing, setInstalling] = useState(false);
  const [buildStep, setBuildStep] = useState<"idle" | "installing" | "building" | "done">("idle");

  const runInstallAndBuild = async () => {
    if (!onRunBuild) return;
    setBuildStep("installing");
    setInstalling(true);
    // Run npm install first (via terminal panel through onRunBuild)
    // We chain the commands with &&
    onRunBuild("npm install && npm run build");
    // Show progress UI for 30 seconds then reset
    setTimeout(() => {
      setBuildStep("building");
    }, 8000);
    setTimeout(() => {
      setBuildStep("done");
      setInstalling(false);
      onReload();
    }, 60000);
  };

  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center gap-5 text-[#8b949e] px-6 text-center max-w-sm mx-auto">
      <Monitor className="w-10 h-10 opacity-20" />

      <div>
        <p className="text-sm font-medium text-[#c9d1d9] mb-1">Preview não disponível</p>
        <p className="text-xs text-[#8b949e]">
          O projeto ainda não tem um arquivo HTML pronto para exibir.
        </p>
      </div>

      {/* Per-type quick actions */}
      <div className="w-full space-y-2 text-left">
        {/* HTML direto */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <FileCode className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="text-xs font-semibold text-[#c9d1d9]">HTML / CSS / JS puro</span>
          </div>
          <p className="text-[11px] text-[#8b949e] leading-relaxed">
            Abra o arquivo <code className="text-orange-300">.html</code> no editor — o botão{" "}
            <span className="text-blue-400 font-medium">👁 Visualizar</span> aparece na barra superior do código.
          </p>
        </div>

        {/* React / Vite com botão */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs font-semibold text-[#c9d1d9]">React / Vite / Vue / Angular</span>
          </div>
          <p className="text-[11px] text-[#8b949e] leading-relaxed">
            Precisa instalar as dependências e fazer o build antes de visualizar.
            Clique no botão abaixo — pode demorar alguns minutos:
          </p>

          {onRunBuild && (
            <div className="space-y-1.5">
              {buildStep === "idle" && (
                <button
                  onClick={runInstallAndBuild}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-colors text-xs font-medium"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Instalar dependências + Build
                </button>
              )}

              {buildStep === "installing" && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-[11px] text-yellow-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  Instalando pacotes (npm install)… pode demorar 2-5 min
                </div>
              )}
              {buildStep === "building" && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400">
                  <Hammer className="w-3.5 h-3.5 animate-bounce shrink-0" />
                  Fazendo build do projeto...
                </div>
              )}
              {buildStep === "done" && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-[11px] text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Concluído! Verificando preview...
                </div>
              )}

              <div className="flex gap-1.5">
                <button
                  onClick={() => onRunBuild("npm install")}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-[#30363d] hover:bg-[#3a4048] text-[10px] text-[#8b949e] hover:text-[#e6edf3] transition-colors border border-[#444c56]"
                >
                  <Package className="w-3 h-3" />
                  npm install
                </button>
                <button
                  onClick={() => onRunBuild("npm run build")}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-[#30363d] hover:bg-[#3a4048] text-[10px] text-[#8b949e] hover:text-[#e6edf3] transition-colors border border-[#444c56]"
                >
                  <Hammer className="w-3 h-3" />
                  npm run build
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Python / Node */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <FileCode className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span className="text-xs font-semibold text-[#c9d1d9]">Python / Node (servidor)</span>
          </div>
          <p className="text-[11px] text-[#8b949e] leading-relaxed">
            Use o terminal para iniciar o servidor. O preview só mostra conteúdo estático.
          </p>
        </div>
      </div>

      <button
        onClick={onReload}
        className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] text-xs transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Verificar preview novamente
      </button>
    </div>
  );
}
