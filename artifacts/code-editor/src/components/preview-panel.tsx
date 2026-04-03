import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Monitor,
  RefreshCw,
  ExternalLink,
  Play,
  Loader2,
  AlertTriangle,
  Smartphone,
  Tablet,
  FileCode,
  Eye,
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
  /** When set, previews this specific file instead of the project entry point */
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

  // When previewPath changes, bump the iframe key to reload
  useEffect(() => { setIframeKey((k) => k + 1); }, [previewPath]);

  const reload = () => {
    fetchStatus();
    setIframeKey((k) => k + 1);
  };

  const openExternal = () => {
    window.open(iframeUrl, "_blank");
  };

  // If a specific file was requested, use it directly; otherwise use entry point
  const isFilePreview = !!previewPath;
  const iframeUrl = isFilePreview
    ? `${previewBase}/${previewPath.replace(/^\//, "")}`
    : `${previewBase}/`;

  // Entry label shown in the green indicator bar
  const entryLabel = isFilePreview ? previewPath : (status?.entry ?? null);

  // Whether we can actually show the iframe
  const canShow = isFilePreview || status?.ready;

  return (
    <div className="h-full w-full flex flex-col bg-[#0d1117]">
      {/* Toolbar */}
      <div className="h-10 shrink-0 border-b border-[#30363d] bg-[#161b22] flex items-center px-3 gap-2">
        <Monitor className="w-4 h-4 text-[#8b949e] shrink-0" />
        <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider flex-1">
          Preview
        </span>

        {/* File preview badge */}
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

        {/* Build button — only when no entry and no file override */}
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

        {/* Reload */}
        <button
          onClick={reload}
          className="p-1.5 rounded text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] transition-colors"
          title="Recarregar preview"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Open in new tab */}
        {canShow && (
          <button
            onClick={openExternal}
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

      {/* Viewport frame */}
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
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center gap-5 text-[#8b949e] px-8 text-center max-w-md mx-auto">
      <AlertTriangle className="w-10 h-10 opacity-30" />

      <div>
        <p className="text-sm font-medium text-[#c9d1d9] mb-1">Nenhum preview disponível</p>
        <p className="text-xs text-[#8b949e]">
          Abra um arquivo <code className="text-primary">.html</code> no editor e clique em{" "}
          <span className="text-blue-400 font-medium">Visualizar</span> para vê-lo aqui diretamente,
          ou use os atalhos abaixo.
        </p>
      </div>

      {/* Quick guide by project type */}
      <div className="w-full bg-[#161b22] border border-[#30363d] rounded-lg divide-y divide-[#30363d] text-left text-xs">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <FileCode className="w-3.5 h-3.5 text-orange-400" />
            <span className="font-semibold text-[#c9d1d9]">HTML / CSS / JS puro</span>
          </div>
          <p className="text-[#8b949e] leading-relaxed">
            Abra qualquer <code>.html</code> no editor → botão <span className="text-blue-400">👁 Visualizar</span> aparece na barra do arquivo.
          </p>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <FileCode className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-[#c9d1d9]">React / Vite / Vue / Angular</span>
          </div>
          <p className="text-[#8b949e] leading-relaxed">
            No terminal: <code className="text-green-400">npm install</code> → <code className="text-green-400">npm run build</code> → recarregue o preview.
          </p>
          {onRunBuild && (
            <button
              onClick={() => onRunBuild("npm run build")}
              className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-colors text-[11px]"
            >
              <Play className="w-3 h-3" />
              npm run build
            </button>
          )}
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <FileCode className="w-3.5 h-3.5 text-yellow-400" />
            <span className="font-semibold text-[#c9d1d9]">Python / Node (servidor)</span>
          </div>
          <p className="text-[#8b949e] leading-relaxed">
            Inicie o servidor no terminal. O preview exibe conteúdo estático — para apps com servidor use a aba Terminal.
          </p>
        </div>
      </div>

      <button
        onClick={onReload}
        className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] text-xs transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Verificar novamente
      </button>
    </div>
  );
}
