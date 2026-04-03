import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Package,
  Play,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Search,
  Download,
  X,
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
  preInstalled?: boolean;
  supportsSearch?: boolean; // supports npm registry search
}

const MANAGERS: PackageManager[] = [
  {
    markerFile: "package.json",
    label: "npm (Node/React/Next)",
    color: "text-green-400",
    preInstalled: true,
    supportsSearch: true,
    installCmd: (p) => `npm install ${p}`,
    runCmds: [
      { label: "Instalar deps", cmd: "npm install" },
      { label: "Dev server", cmd: "npm run dev" },
      { label: "Build", cmd: "npm run build" },
      { label: "Testes", cmd: "npm test" },
      { label: "Iniciar", cmd: "npm start" },
    ],
    hint: "Buscar pacote npm…",
  },
  {
    markerFile: "pyproject.toml",
    label: "Poetry (Python)",
    color: "text-blue-400",
    installCmd: (p) => `poetry add ${p}`,
    runCmds: [
      { label: "Instalar deps", cmd: "poetry install" },
      { label: "Executar", cmd: "poetry run python3 main.py" },
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
      { label: "Executar", cmd: "pipenv run python3 main.py" },
    ],
    hint: "ex: requests, django, flask",
  },
  {
    markerFile: "requirements.txt",
    label: "pip / Python",
    color: "text-yellow-400",
    installCmd: (p) => `pip3 install ${p}`,
    runCmds: [
      { label: "Instalar requirements", cmd: "pip3 install -r requirements.txt" },
      { label: "Executar", cmd: "python3 main.py" },
      { label: "Testes", cmd: "python3 -m pytest" },
    ],
    hint: "ex: requests, pandas, flask, numpy",
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

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

// ─── npm search ───────────────────────────────────────────────────────────────

interface NpmPackage {
  name: string;
  description: string;
  version: string;
  weeklyDownloads?: number;
}

async function searchNpm(query: string): Promise<NpmPackage[]> {
  if (!query.trim()) return [];
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=8`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao buscar pacotes");
  const data = await res.json() as {
    objects: Array<{
      package: { name: string; description: string; version: string };
      downloads?: { weekly: number };
    }>;
  };
  return data.objects.map((o) => ({
    name: o.package.name,
    description: o.package.description ?? "",
    version: o.package.version,
    weeklyDownloads: o.downloads?.weekly,
  }));
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PackagesPanelProps {
  projectId: string;
  fileTree: FileNode;
  onRunCommand: (cmd: string) => void;
}

export function PackagesPanel({ projectId, fileTree, onRunCommand }: PackagesPanelProps) {
  const [open, setOpen] = useState(true);
  const [pkg, setPkg] = useState("");
  const [searchResults, setSearchResults] = useState<NpmPackage[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const manager = useMemo(() => detectManager(fileTree), [fileTree]);
  const execMutation = useExecCommand();

  // npm search works for npm projects OR when no manager detected (show npm as default)
  const canSearchNpm = manager?.supportsSearch || !manager;

  // Debounced npm search
  useEffect(() => {
    if (!canSearchNpm) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!pkg.trim() || pkg.trim().length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const results = await searchNpm(pkg.trim());
        setSearchResults(results);
      } catch {
        setSearchError("Não foi possível buscar pacotes agora.");
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [pkg, manager]);

  const handleInstallDirect = () => {
    if (!pkg.trim() || !manager) return;
    onRunCommand(manager.installCmd(pkg.trim()));
    setPkg("");
    setSearchResults([]);
  };

  const handleInstallPackage = (name: string) => {
    if (!manager) return;
    onRunCommand(manager.installCmd(name));
    setPkg("");
    setSearchResults([]);
  };

  return (
    <div className="border-t border-border/40 mt-1">
      {/* Toggle header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
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
            <div className="space-y-3">
              <div className="text-[11px] text-muted-foreground bg-accent/20 border border-border/40 rounded px-2.5 py-2 leading-relaxed">
                Nenhum <code className="text-primary">package.json</code> detectado.{" "}
                <button
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                  onClick={() => onRunCommand("npm init -y")}
                >
                  Inicializar projeto npm
                </button>{" "}
                ou busque um pacote abaixo para começar.
              </div>

              {/* npm search even without package.json */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground">Buscar pacote npm</p>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                  <Input
                    value={pkg}
                    onChange={(e) => setPkg(e.target.value)}
                    placeholder="Buscar pacote npm…"
                    className="h-7 text-xs bg-background/50 border-border/60 pl-7 pr-6"
                  />
                  {pkg && (
                    <button
                      onClick={() => { setPkg(""); setSearchResults([]); }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {searching && (
                  <div className="flex items-center gap-2 py-1 text-[11px] text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Buscando no npm...
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    {searchResults.map((p) => (
                      <div key={p.name} className="flex items-start gap-2 p-2 rounded border border-border/40 bg-background/40 hover:bg-accent/30 group transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-mono font-semibold text-foreground">{p.name}</span>
                            <span className="text-[9px] text-muted-foreground">v{p.version}</span>
                            {p.weeklyDownloads && (
                              <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                                <Download className="w-2.5 h-2.5" />{formatDownloads(p.weeklyDownloads)}/sem
                              </span>
                            )}
                          </div>
                          {p.description && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => { onRunCommand(`npm install ${p.name}`); setPkg(""); setSearchResults([]); }}
                          className="shrink-0 flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Plus className="w-3 h-3" /> Instalar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Detected badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-[11px] font-medium", manager.color)}>{manager.label}</span>
                {manager.preInstalled ? (
                  <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                    <CheckCircle2 className="w-2.5 h-2.5" /> disponível
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
                    <AlertTriangle className="w-2.5 h-2.5" /> verificar instalação
                  </span>
                )}
              </div>

              {/* Search / install input */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground">
                  {manager.supportsSearch ? "Buscar e instalar pacote" : "Instalar pacote"}
                </p>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                    <Input
                      value={pkg}
                      onChange={(e) => setPkg(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !searchResults.length && handleInstallDirect()}
                      placeholder={manager.hint}
                      className="h-7 text-xs bg-background/50 border-border/60 pl-7 pr-6"
                    />
                    {pkg && (
                      <button
                        onClick={() => { setPkg(""); setSearchResults([]); }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {!manager.supportsSearch && (
                    <Button
                      size="sm"
                      className="h-7 px-2 shrink-0"
                      onClick={handleInstallDirect}
                      disabled={!pkg.trim()}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* npm search results */}
                {manager.supportsSearch && (
                  <div>
                    {searching && (
                      <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Buscando no npm...
                      </div>
                    )}
                    {searchError && (
                      <p className="text-[11px] text-red-400 py-1">{searchError}</p>
                    )}
                    {searchResults.length > 0 && (
                      <div className="mt-1 space-y-1 max-h-64 overflow-y-auto">
                        {searchResults.map((p) => (
                          <div
                            key={p.name}
                            className="flex items-start gap-2 p-2 rounded border border-border/40 bg-background/40 hover:bg-accent/30 hover:border-primary/30 transition-colors group"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-mono font-semibold text-foreground truncate">
                                  {p.name}
                                </span>
                                <span className="text-[9px] text-muted-foreground shrink-0">v{p.version}</span>
                                {p.weeklyDownloads && (
                                  <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground shrink-0">
                                    <Download className="w-2.5 h-2.5" />
                                    {formatDownloads(p.weeklyDownloads)}/sem
                                  </span>
                                )}
                              </div>
                              {p.description && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                                  {p.description}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleInstallPackage(p.name)}
                              className="shrink-0 flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors opacity-0 group-hover:opacity-100"
                              title={`npm install ${p.name}`}
                            >
                              <Plus className="w-3 h-3" />
                              Instalar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {!searching && !searchError && pkg.trim().length >= 2 && searchResults.length === 0 && (
                      <p className="text-[11px] text-muted-foreground py-1">
                        Nenhum pacote encontrado. Tente outro termo.
                      </p>
                    )}
                    {/* Install exact name button when there are no search results yet */}
                    {pkg.trim() && !searching && searchResults.length === 0 && pkg.trim().length < 2 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-full text-xs mt-1"
                        onClick={handleInstallDirect}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        npm install {pkg.trim()}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Quick commands */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Comandos rápidos</p>
                <div className="flex flex-col gap-1">
                  {manager.runCmds.map(({ label, cmd }) => (
                    <button
                      key={cmd}
                      onClick={() => onRunCommand(cmd)}
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
