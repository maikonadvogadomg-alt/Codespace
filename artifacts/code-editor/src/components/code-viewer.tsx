import React, { useMemo } from "react";
import { Loader2, FileX, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import type { FileContent } from "@workspace/api-client-react";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";

interface CodeViewerProps {
  file: FileContent | undefined;
  isLoading: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onBack?: () => void;
  onForward?: () => void;
  /** Called when user clicks "Visualizar" on an HTML file */
  onPreview?: (filePath: string) => void;
}

const PREVIEWABLE_EXTS = new Set(["html", "htm", "svg"]);

// Map our language names to highlight.js aliases
const LANG_MAP: Record<string, string> = {
  typescript: "typescript",
  tsx: "typescript",
  javascript: "javascript",
  jsx: "javascript",
  python: "python",
  rust: "rust",
  go: "go",
  java: "java",
  css: "css",
  scss: "scss",
  html: "html",
  xml: "xml",
  json: "json",
  yaml: "yaml",
  markdown: "markdown",
  md: "markdown",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  sql: "sql",
  php: "php",
  ruby: "ruby",
  cpp: "cpp",
  c: "c",
  csharp: "csharp",
  swift: "swift",
  kotlin: "kotlin",
  dart: "dart",
  toml: "ini",
  dockerfile: "dockerfile",
};

export function CodeViewer({
  file,
  isLoading,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onPreview,
}: CodeViewerProps) {
  const ext = file?.path?.split(".").pop()?.toLowerCase() ?? "";
  const isPreviewable = PREVIEWABLE_EXTS.has(ext);
  const { highlighted, lineCount } = useMemo(() => {
    if (!file?.content) return { highlighted: "", lineCount: 0 };
    const lang = file.language ? LANG_MAP[file.language.toLowerCase()] : undefined;
    try {
      const result =
        lang && hljs.getLanguage(lang)
          ? hljs.highlight(file.content, { language: lang })
          : hljs.highlightAuto(file.content);
      return {
        highlighted: result.value,
        lineCount: (file.content.match(/\n/g)?.length ?? 0) + 1,
      };
    } catch {
      return {
        highlighted: hljs.escapeHTML(file.content),
        lineCount: (file.content.match(/\n/g)?.length ?? 0) + 1,
      };
    }
  }, [file?.content, file?.language]);

  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1),
    [lineCount]
  );

  const lineNumWidth = Math.max(String(lineCount).length, 2);

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#0d1117]">
        <Loader2 className="w-6 h-6 animate-spin text-[#8b949e]" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#0d1117] text-[#8b949e]">
        <FileX className="w-12 h-12 mb-4 opacity-40" />
        <p className="text-sm">Selecione um arquivo para ver o conteúdo</p>
      </div>
    );
  }

  if (file.isBinary) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#0d1117] text-[#8b949e]">
        <FileX className="w-12 h-12 mb-4 opacity-40" />
        <p className="text-sm">Arquivo binário não pode ser exibido</p>
        <p className="text-xs opacity-70 mt-1 font-mono">{file.path}</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#0d1117] overflow-hidden">
      {/* Tab bar */}
      <div className="h-10 shrink-0 border-b border-[#30363d] bg-[#161b22] flex items-center px-2 gap-1">
        {/* Back / Forward */}
        <button
          onClick={onBack}
          disabled={!canGoBack}
          className="p-1.5 rounded text-[#8b949e] hover:text-[#e6edf3] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Arquivo anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onForward}
          disabled={!canGoForward}
          className="p-1.5 rounded text-[#8b949e] hover:text-[#e6edf3] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Próximo arquivo"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-[#30363d] mx-1 shrink-0" />

        <span className="text-sm text-[#c9d1d9] font-mono truncate flex-1">
          {file.path.split("/").pop()}
        </span>
        <span className="text-[10px] text-[#8b949e] truncate hidden md:block max-w-[200px]">
          {file.path}
        </span>

        <div className="w-px h-5 bg-[#30363d] mx-1 shrink-0" />

        {/* Visualizar button for HTML/SVG files */}
        {isPreviewable && onPreview && (
          <button
            onClick={() => onPreview(file.path)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-colors shrink-0"
            title="Visualizar este arquivo no painel de Preview"
          >
            <Eye className="w-3 h-3" />
            Visualizar
          </button>
        )}

        {file.language && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8b949e] shrink-0">
            {file.language}
          </span>
        )}
        <span className="text-[10px] text-[#8b949e] shrink-0 tabular-nums ml-2">
          {lineCount} ln
        </span>
      </div>

      {/* Code with line numbers */}
      <div className="flex-1 overflow-auto flex">
        {/* Line numbers column */}
        <div
          className="select-none text-right text-[#8b949e] text-[12px] font-mono leading-relaxed pt-3 pb-3 pr-3 pl-4 border-r border-[#30363d] shrink-0"
          style={{ minWidth: `${lineNumWidth + 3}ch` }}
          aria-hidden="true"
        >
          {lineNumbers.map((n) => (
            <div key={n} className="leading-relaxed hover:text-[#c9d1d9]">
              {n}
            </div>
          ))}
        </div>

        {/* Highlighted code */}
        <pre
          className="flex-1 pl-4 pr-6 pt-3 pb-3 text-sm font-mono leading-relaxed overflow-x-auto m-0 bg-transparent"
          style={{ tabSize: 2 }}
        >
          <code
            className="hljs"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      </div>
    </div>
  );
}
