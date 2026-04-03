import React, { useState, useMemo } from "react";
import {
  Package,
  Play,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useExecCommand } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import type { FileNode } from "@workspace/api-client-react";

// ─── Project-type detection ──────────────────────────────────────────────────

interface PackageManager {
  label: string;
  color: string;
  installCmd: (pkg: string) => string;
  runCmds: { label: string; cmd: string }[];
  hint: string;
  markerFile: string;
}

const MANAGERS: PackageManager[] = [
  {
    markerFile: "pyproject.toml",
    label: "Poetry (Python)",
    color: "text-blue-400",
    installCmd: (p) => `poetry add ${p}`,
    runCmds: [
      { label: "Instalar deps", cmd: "poetry install" },
      { label: "Executar", cmd: "poetry run python main.py" },
      { label: "Testes", cmd: "poetry run pytest" },
    ],
    hint: "ex: requests, pandas, fastapi",
  },
  {
    markerFile: "Pipfile",
    label: "Pipenv (Python)",
    color: "text-blue-400",
    installCmd: (p) => `pipenv install ${p}`,
    runCmds: [
      { label: "Instalar deps", cmd: "pipenv install" },
      { label: "Executar", cmd: "pipenv run python main.py" },
    ],
    hint: "ex: requests, django, flask",
  },
  {
    markerFile: "requirements.txt",
    label: "pip (Python)",
    color: "text-yellow-400",
    installCmd: (p) => `pip install ${p}`,
    runCmds: [
      { label: "Instalar requirements", cmd: "pip install -r requirements.txt" },
      { label: "Executar", cmd: "python main.py" },
      { label: "Testes", cmd: "python -m pytest" },
    ],
    hint: "ex: requests, pandas, flask, numpy",
  },
  {
    markerFile: "package.json",
    label: "npm (Node/React/Next)",
    color: "text-green-400",
    installCmd: (p) => `npm install ${p}`,
    runCmds: [
      { label: "Instalar deps", cmd: "npm install" },
      { label: "Dev server", cmd: "npm run dev" },
      { label: "Build", cmd: "npm run build" },
      { label: "Testes", cmd: "npm test" },
      { label: "Iniciar", cmd: "npm start" },
    ],
    hint: "ex: axios, lodash, dayjs, zustand",
  },
  {
    markerFile: "Cargo.toml",
    label: "Cargo (Rust)",
    color: "text-orange-400",
    installCmd: (p) => `cargo add ${p}`,
    runCmds: [
      { label: "Build", cmd: "cargo build" },
      { label: "Executar", cmd: "cargo run" },
      { label: "Testes", cmd: "cargo test" },
    ],
    hint: "ex: serde, tokio, reqwest",
  },
  {
    markerFile: "go.mod",
    label: "Go Modules",
    color: "text-cyan-400",
    installCmd: (p) => `go get ${p}`,
    runCmds: [
      { label: "Build", cmd: "go build ./..." },
      { label: "Executar", cmd: "go run ." },
      { label: "Testes", cmd: "go test ./..." },
    ],
    hint: "ex: github.com/gin-gonic/gin",
  },
  {
    markerFile: "composer.json",
    label: "Composer (PHP)",
    color: "text-purple-400",
    installCmd: (p) => `composer require ${p}`,
    runCmds: [
      { label: "Instalar deps", cmd: "composer install" },
    ],
    hint: "ex: guzzlehttp/guzzle",
  },
  {
    markerFile: "Gemfile",
    label: "Bundler (Ruby)",
    color: "text-red-400",
    installCmd: (p) => `bundle add ${p}`,
    runCmds: [
      { label: "Instalar gems", cmd: "bundle install" },
      { label: "Executar", cmd: "bundle exec ruby app.rb" },
    ],
    hint: "ex: rails, sinatra, nokogiri",
  },
];

// Walk tree looking for marker files
function detectManager(node: FileNode): PackageManager | null {
  const names = collectFileNames(node);
  for (const m of MANAGERS) {
    if (names.has(m.markerFile)) return m;
  }
  return null;
}

function collectFileNames(node: FileNode, out = new Set<string>()): Set<string> {
  out.add(node.name);
  node.children?.forEach((c) => collectFileNames(c, out));
  return out;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PackagesPanelProps {
  projectId: string;
  fileTree: FileNode;
  onRunCommand: (cmd: string) => void;
}

export function PackagesPanel({ projectId, fileTree, onRunCommand }: PackagesPanelProps) {
  const [open, setOpen] = useState(false);
  const [pkg, setPkg] = useState("");

  const manager = useMemo(() => detectManager(fileTree), [fileTree]);
  const execMutation = useExecCommand();

  const handleInstall = () => {
    if (!pkg.trim() || !manager) return;
    const cmd = manager.installCmd(pkg.trim());
    onRunCommand(cmd);
    setPkg("");
  };

  const handleRunCmd = (cmd: string) => {
    onRunCommand(cmd);
  };

  return (
    <div className="border-t border-border/40 mt-1">
      {/* Toggle header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        )}
        <Package className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left">Pacotes</span>
        {manager && (
          <span className={cn("text-[10px] normal-case font-normal mr-1", manager.color)}>
            {manager.label.split(" ")[0]}
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {!manager ? (
            <p className="text-[11px] text-muted-foreground py-1">
              Nenhum gerenciador detectado. Abra um projeto com{" "}
              <code className="text-primary">package.json</code>,{" "}
              <code className="text-primary">requirements.txt</code>,{" "}
              <code className="text-primary">Cargo.toml</code> etc.
            </p>
          ) : (
            <>
              {/* Detected badge */}
              <div className={cn("text-[11px] font-medium", manager.color)}>
                {manager.label}
              </div>

              {/* Install package */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground">Instalar pacote</p>
                <div className="flex gap-1.5">
                  <Input
                    value={pkg}
                    onChange={(e) => setPkg(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInstall()}
                    placeholder={manager.hint}
                    className="h-7 text-xs bg-background/50 border-border/60"
                  />
                  <Button
                    size="sm"
                    className="h-7 px-2 shrink-0"
                    onClick={handleInstall}
                    disabled={!pkg.trim() || execMutation.isPending}
                  >
                    {execMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Quick commands */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Comandos rápidos</p>
                <div className="flex flex-col gap-1">
                  {manager.runCmds.map(({ label, cmd }) => (
                    <button
                      key={cmd}
                      onClick={() => handleRunCmd(cmd)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11px] bg-background/40 hover:bg-accent/40 border border-border/40 hover:border-primary/30 transition-colors group"
                    >
                      <Play className="w-3 h-3 text-green-400 shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="flex-1 text-foreground/80 font-medium">{label}</span>
                      <code className="text-muted-foreground text-[9px] truncate max-w-[100px]">{cmd}</code>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
