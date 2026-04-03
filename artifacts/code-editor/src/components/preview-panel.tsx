import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Monitor,
  RefreshCw,
  ExternalLink,
  Play,
  Square,
  Loader2,
  AlertTriangle,
  Smartphone,
  Tablet,
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
}

export function PreviewPanel({ projectId, onRunBuild }: PreviewPanelProps) {
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

  const reload = () => {
    fetchStatus();
    setIframeKey((k) => k + 1);
  };

  const openExternal = () => {
    window.open(`${previewBase}/`, "_blank");
  };

  // Detect build command from entry path
  const buildCmd = status?.entry?.startsWith("dist/") || status?.entry?.startsWith("build/")
    ? null // already built
    : "npm run build";

  const iframeUrl = `${previewBase}/`;

  return (
    <div className="h-full w-full flex flex-col bg-[#0d1117]">
      {/* Toolbar */}
      <div className="h-10 shrink-0 border-b border-[#30363d] bg-[#161b22] flex items-center px-3 gap-2">
        <Monitor className="w-4 h-4 text-[#8b949e] shrink-0" />
        <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider flex-1">
          Preview
        </span>

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
                  viewport === v
                    ? "bg-[#30363d] text-[#e6edf3]"
                    : "text-[#8b949e] hover:text-[#e6edf3]"
                )}
                title={v.charAt(0).toUpperCase() + v.slice(1)}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>

        <div className="w-px h-4 bg-[#30363d]" />

        {/* Build button */}
        {onRunBuild && !status?.ready && (
          <button
            onClick={() => onRunBuild("npm run build")}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-colors"
            title="Executar build"
          >
            <Play className="w-3 h-3" />
            Build
          </button>
        )}

        {/* Reload */}
        <button
          onClick={reload}
          className="p-1.5 rounded text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] transition-colors"
          title="Recarregar preview"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Open in new tab */}
        <button
          onClick={openExternal}
          className="p-1.5 rounded text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] transition-colors"
          title="Abrir em nova aba"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Entry file indicator */}
      {status?.entry && (
        <div className="shrink-0 px-3 py-1 bg-[#161b22] border-b border-[#30363d] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
          <span className="text-[10px] text-[#8b949e] font-mono truncate">{status.entry}</span>
        </div>
      )}

      {/* Viewport frame */}
      <div className="flex-1 overflow-auto flex items-start justify-center bg-[#1a1f26] p-0">
        {loading ? (
          <div className="flex-1 h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#8b949e]" />
          </div>
        ) : !status?.ready ? (
          <div className="flex-1 h-full flex flex-col items-center justify-center gap-4 text-[#8b949e] px-6 text-center">
            <AlertTriangle className="w-10 h-10 opacity-40" />
            <div>
              <p className="text-sm font-medium text-[#c9d1d9] mb-1">Sem preview disponível</p>
              <p className="text-xs text-[#8b949e]">
                Não foi encontrado nenhum <code className="text-primary">index.html</code> neste projeto.
              </p>
            </div>
            {onRunBuild && (
              <div className="space-y-2">
                <p className="text-[11px] text-[#8b949e]">
                  Para projetos React/Vite — rode o build primeiro:
                </p>
                <button
                  onClick={() => { onRunBuild("npm run build"); }}
                  className="flex items-center gap-2 px-3 py-2 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 text-xs transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  npm run build
                </button>
                <button
                  onClick={reload}
                  className="flex items-center gap-2 px-3 py-2 rounded bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] text-xs transition-colors w-full justify-center"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Verificar novamente após o build
                </button>
              </div>
            )}
          </div>
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
