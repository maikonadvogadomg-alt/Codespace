import React, { useMemo } from "react";
import { Loader2, FileX } from "lucide-react";
import type { FileContent } from "@workspace/api-client-react";

interface CodeViewerProps {
  file: FileContent | undefined;
  isLoading: boolean;
}

export function CodeViewer({ file, isLoading }: CodeViewerProps) {
  const lines = useMemo(
    () => (file?.content ?? "").split("\n"),
    [file?.content]
  );

  const lineNumWidth = useMemo(
    () => Math.max(String(lines.length).length, 2),
    [lines.length]
  );

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-card">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-card text-muted-foreground">
        <FileX className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm">Selecione um arquivo para ver o conteúdo</p>
      </div>
    );
  }

  if (file.isBinary) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-card text-muted-foreground">
        <FileX className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm">Arquivo binário não pode ser exibido</p>
        <p className="text-xs opacity-70 mt-1">{file.path}</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#0d1117] overflow-hidden">
      {/* Tab bar */}
      <div className="h-10 shrink-0 border-b border-[#30363d] bg-[#161b22] flex items-center px-4 gap-3">
        <span className="text-sm text-[#c9d1d9] font-mono truncate">
          {file.path.split("/").pop()}
        </span>
        <span className="text-[10px] text-[#8b949e] truncate hidden sm:block">
          {file.path}
        </span>
        {file.language && (
          <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold text-[#8b949e] shrink-0">
            {file.language}
          </span>
        )}
        <span className="text-[10px] text-[#8b949e] shrink-0 tabular-nums">
          {lines.length} linhas
        </span>
      </div>

      {/* Code with line numbers */}
      <div className="flex-1 overflow-auto">
        <table
          className="w-full border-collapse font-mono text-sm leading-relaxed"
          style={{ tabSize: 2 }}
        >
          <tbody>
            {lines.map((line, i) => (
              <tr
                key={i}
                className="hover:bg-white/[0.03] group"
              >
                {/* Line number */}
                <td
                  className="select-none text-right pr-4 pl-4 py-0 text-[#8b949e] text-[12px] tabular-nums align-top border-r border-[#30363d] w-px whitespace-nowrap"
                  style={{ minWidth: `${lineNumWidth + 2}ch` }}
                >
                  {i + 1}
                </td>
                {/* Code line */}
                <td className="pl-4 pr-4 py-0 text-[#c9d1d9] align-top whitespace-pre">
                  {line || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
