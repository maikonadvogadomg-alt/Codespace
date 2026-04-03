import React from "react";
import { Sparkles, Loader2, Info } from "lucide-react";
import type { AiAnalysisResult } from "@workspace/api-client-react";

interface AiPanelProps {
  analysis: AiAnalysisResult | undefined;
  isLoading: boolean;
  activePath?: string;
  activeType?: "file" | "folder";
}

export function AiPanel({ analysis, isLoading, activePath, activeType }: AiPanelProps) {
  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-card text-muted-foreground p-6 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          <Sparkles className="w-8 h-8 text-primary animate-pulse relative z-10" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">Analyzing {activeType === "folder" ? "folder" : "file"}...</p>
        <p className="text-xs max-w-[200px] truncate">{activePath}</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-card text-muted-foreground p-6 text-center">
        <Sparkles className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm">No analysis active</p>
        <p className="text-xs opacity-70 mt-1 max-w-[200px]">Right-click any file or folder to run AI analysis</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-card overflow-hidden border-l border-border">
      <div className="h-10 shrink-0 border-b border-border bg-background/50 flex items-center px-4 gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">AI Analysis</span>
        <span className="ml-auto text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-accent">
          {analysis.model}
        </span>
      </div>
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border/50 text-sm text-muted-foreground">
          <Info className="w-4 h-4 shrink-0" />
          <span className="truncate" title={activePath}>Target: {activePath}</span>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap font-sans">
          {analysis.analysis}
        </div>
      </div>
    </div>
  );
}
