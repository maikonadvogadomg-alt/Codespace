import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  FileCode,
  Folder,
  FolderOpen,
  FileText,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileNode } from "@workspace/api-client-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useIsMobile } from "@/hooks/use-mobile";

interface FileTreeProps {
  node: FileNode;
  onSelectFile: (path: string) => void;
  onAnalyzeFile: (path: string) => void;
  onAnalyzeFolder: (path: string) => void;
  selectedPath?: string;
  level?: number;
}

export function FileTree({
  node,
  onSelectFile,
  onAnalyzeFile,
  onAnalyzeFolder,
  selectedPath,
  level = 0,
}: FileTreeProps) {
  const [isOpen, setIsOpen] = useState(level === 0);
  const [showActions, setShowActions] = useState(false);
  const isMobile = useIsMobile();
  const isDirectory = node.type === "directory";
  const isSelected = selectedPath === node.path;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) {
      setIsOpen(!isOpen);
    } else {
      onSelectFile(node.path);
    }
  };

  const getFileIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.match(/\.(png|jpg|jpeg|gif|svg|ico)$/))
      return <ImageIcon className="w-4 h-4 text-blue-400" />;
    if (lower.match(/\.(ts|tsx|js|jsx)$/))
      return <FileCode className="w-4 h-4 text-yellow-400" />;
    if (lower.match(/\.(css|scss|sass|less)$/))
      return <FileCode className="w-4 h-4 text-blue-500" />;
    if (lower.match(/\.(html|htm)$/))
      return <FileCode className="w-4 h-4 text-orange-500" />;
    if (lower.match(/\.(json|md|txt)$/))
      return <FileText className="w-4 h-4 text-muted-foreground" />;
    return <FileText className="w-4 h-4 text-muted-foreground" />;
  };

  const sortedChildren = React.useMemo(() => {
    if (!node.children) return [];
    return [...node.children].sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [node.children]);

  const rowContent = (
    <div
      className={cn(
        "flex items-center gap-1.5 py-2 px-2 hover:bg-accent/50 cursor-pointer rounded-sm text-sm group relative",
        isSelected && "bg-accent text-accent-foreground",
        !isSelected && "text-muted-foreground",
        isMobile && "py-3"
      )}
      style={{ paddingLeft: `${level * 14 + 8}px` }}
      onClick={handleToggle}
    >
      {isDirectory ? (
        <span className="flex items-center gap-1.5 flex-1 overflow-hidden">
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 opacity-70 shrink-0" />
          )}
          {isOpen ? (
            <FolderOpen className="w-4 h-4 text-blue-400 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span className="truncate font-medium">{node.name}</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 flex-1 overflow-hidden ml-5">
          {getFileIcon(node.name)}
          <span className="truncate">{node.name}</span>
        </span>
      )}

      {/* Action button — always visible on mobile, hover on desktop */}
      {isMobile ? (
        <button
          className="shrink-0 ml-1 p-1.5 rounded text-primary/70 active:bg-primary/20"
          onClick={(e) => {
            e.stopPropagation();
            if (isDirectory) onAnalyzeFolder(node.path);
            else onAnalyzeFile(node.path);
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          className="shrink-0 ml-1 p-1 rounded text-primary/70 opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            if (isDirectory) onAnalyzeFolder(node.path);
            else onAnalyzeFile(node.path);
          }}
          title="Analisar com IA"
        >
          <Sparkles className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  // On mobile, no context menu — use inline buttons instead
  if (isMobile) {
    return (
      <div className="select-none">
        {rowContent}
        {isDirectory && isOpen && sortedChildren.length > 0 && (
          <div className="flex flex-col">
            {sortedChildren.map((child) => (
              <FileTree
                key={child.path}
                node={child}
                onSelectFile={onSelectFile}
                onAnalyzeFile={onAnalyzeFile}
                onAnalyzeFolder={onAnalyzeFolder}
                selectedPath={selectedPath}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Desktop: context menu
  return (
    <div className="select-none">
      <ContextMenu>
        <ContextMenuTrigger>{rowContent}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {isDirectory ? (
            <ContextMenuItem
              onClick={() => onAnalyzeFolder(node.path)}
              className="gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Analisar Pasta</span>
            </ContextMenuItem>
          ) : (
            <ContextMenuItem
              onClick={() => onAnalyzeFile(node.path)}
              className="gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Analisar Arquivo</span>
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {isDirectory && isOpen && sortedChildren.length > 0 && (
        <div className="flex flex-col">
          {sortedChildren.map((child) => (
            <FileTree
              key={child.path}
              node={child}
              onSelectFile={onSelectFile}
              onAnalyzeFile={onAnalyzeFile}
              onAnalyzeFolder={onAnalyzeFolder}
              selectedPath={selectedPath}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
