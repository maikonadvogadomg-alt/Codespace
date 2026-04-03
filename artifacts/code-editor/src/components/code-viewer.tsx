import React from "react";
import { Loader2, FileX } from "lucide-react";
import type { FileContent } from "@workspace/api-client-react";

interface CodeViewerProps {
  file: FileContent | undefined;
  isLoading: boolean;
}

export function CodeViewer({ file, isLoading }: CodeViewerProps) {
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
        <p className="text-sm">Select a file to view its contents</p>
      </div>
    );
  }

  if (file.isBinary) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-card text-muted-foreground">
        <FileX className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm">Binary file cannot be displayed</p>
        <p className="text-xs opacity-70 mt-1">{file.path}</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-card overflow-hidden">
      <div className="h-10 shrink-0 border-b border-border bg-background/50 flex items-center px-4">
        <span className="text-sm text-muted-foreground">{file.path}</span>
        {file.language && (
          <span className="ml-auto text-xs uppercase tracking-wider font-semibold text-muted-foreground opacity-50">
            {file.language}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-auto bg-[#0d1117] p-4 text-sm font-mono leading-relaxed">
        <pre className="text-gray-300 w-full h-full">
          <code style={{ tabSize: 2 }}>{file.content}</code>
        </pre>
      </div>
    </div>
  );
}
