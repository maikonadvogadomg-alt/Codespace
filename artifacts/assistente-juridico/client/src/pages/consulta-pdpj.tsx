import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Shield,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  Search,
  Mail,
  Users,
  FileText,
  UserCheck,
  Wifi,
  WifiOff,
  Globe,
  Building2,
  RefreshCw,
  Bell,
  Server,
  Zap,
  BookOpen,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const TRIBUNAIS = [
  { value: "TJMG", label: "TJMG" },
  { value: "TJSP", label: "TJSP" },
  { value: "TJRJ", label: "TJRJ" },
  { value: "TJRS", label: "TJRS" },
  { value: "TJPR", label: "TJPR" },
  { value: "TJSC", label: "TJSC" },
  { value: "TJBA", label: "TJBA" },
  { value: "TJPE", label: "TJPE" },
  { value: "TJCE", label: "TJCE" },
  { value: "TJGO", label: "TJGO" },
  { value: "TJDF", label: "TJDF" },
  { value: "TRT2", label: "TRT2" },
  { value: "TRT3", label: "TRT3" },
  { value: "TRF1", label: "TRF1" },
  { value: "TRF3", label: "TRF3" },
  { value: "CNJ", label: "CNJ" },
];

type TabType = "conexao" | "comunicacoes" | "representados" | "habilitacao" | "pessoa" | "notificacoes";

export default function ConsultaPdpj() {
  const { toast } = useToast();
  const [pemConfigured, setPemConfigured] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("conexao");
  const [cpf, setCpf] = useState(() => localStorage.getItem("pdpj_cpf") || "");
  const [tribunal, setTribunal] = useState(() => localStorage.getItem("pdpj_tribunal") || "TJMG");
  const [modo, setModo] = useState<"pdpj" | "pjud">(() => (localStorage.getItem("pdpj_modo") as any) || "pdpj");
  const [ambiente, setAmbiente] = useState<"homologacao" | "producao">(() => (localStorage.getItem("pdpj_ambiente") as any) || "homologacao");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectionResult, setConnectionResult] = useState<any>(null);
  const [comunicacoes, setComunicacoes] = useState<any>(null);
  const [representados, setRepresentados] = useState<any>(null);
  const [habilitacaoResult, setHabilitacaoResult] = useState<any>(null);
  const [pessoaResult, setPessoaResult] = useState<any>(null);
  const [docBusca, setDocBusca] = useState("");
  const [tipoPessoa, setTipoPessoa] = useState<"fisica" | "juridica">("fisica");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [pagina, setPagina] = useState(0);
  const [notifServicos, setNotifServicos] = useState<any>(null);
  const [notifEventos, setNotifEventos] = useState<any>(null);
  const [notifInscricoes, setNotifInscricoes] = useState<any>(null);
  const [notifInscricoesUsuario, setNotifInscricoesUsuario] = useState<any>(null);
  const [notifTemplates, setNotifTemplates] = useState<any>(null);
  const [notifAdminConsultas, setNotifAdminConsultas] = useState<any>(null);
  const [notifSubscritorConsultas, setNotifSubscritorConsultas] = useState<any>(null);
  const [notifTribunais, setNotifTribunais] = useState<any>(null);
  const [notifSelectedServico, setNotifSelectedServico] = useState<string>("");
  const [notifSelectedEvento, setNotifSelectedEvento] = useState<string>("");
  const [notifSubTab, setNotifSubTab] = useState<"servicos" | "eventos" | "inscricoes" | "minhas" | "templates" | "admin" | "subscritor" | "tribunais">("servicos");

  useEffect(() => {
    fetch("/api/pdpj/status")
      .then(r => r.json())
      .then(d => setPemConfigured(d.configured))
      .catch(() => setPemConfigured(false));
  }, []);

  useEffect(() => {
    if (cpf) localStorage.setItem("pdpj_cpf", cpf);
    if (tribunal) localStorage.setItem("pdpj_tribunal", tribunal);
    if (modo) localStorage.setItem("pdpj_modo", modo);
    if (ambiente) localStorage.setItem("pdpj_ambiente", ambiente);
  }, [cpf, tribunal, modo, ambiente]);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const cleanCpf = cpf.replace(/\D/g, "");
  const cpfValid = cleanCpf.length === 11;

  const baseBody = () => ({
    cpf: cleanCpf,
    modo,
    tribunal,
    ambiente,
  });

  const testConnection = async () => {
    if (!cpfValid) { toast({ title: "CPF invalido", variant: "destructive" }); return; }
    setLoading(true);
    setConnectionResult(null);
    try {
      const res = await fetch("/api/pdpj/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseBody()),
      });
      const data = await res.json();
      setConnectionResult(data);
      toast({ title: data.connected ? "Conexao estabelecida!" : "Falha na conexao", variant: data.connected ? "default" : "destructive" });
    } catch (err: any) {
      setConnectionResult({ connected: false, message: err.message });
      toast({ title: "Erro de conexao", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchComunicacoes = async () => {
    if (!cpfValid) { toast({ title: "CPF invalido", variant: "destructive" }); return; }
    setLoading(true);
    setComunicacoes(null);
    try {
      const res = await fetch("/api/pdpj/comunicacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody(), dataInicio, dataFim, pagina }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.message || "Erro", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setComunicacoes(data);
      toast({ title: "Comunicacoes carregadas!" });
    } catch (err: any) {
      toast({ title: "Erro: " + err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchRepresentados = async () => {
    if (!cpfValid) { toast({ title: "CPF invalido", variant: "destructive" }); return; }
    setLoading(true);
    setRepresentados(null);
    try {
      const res = await fetch("/api/pdpj/representados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody(), dataInicio, dataFim }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.message || "Erro", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setRepresentados(data);
      toast({ title: "Representados carregados!" });
    } catch (err: any) {
      toast({ title: "Erro: " + err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const checkHabilitacao = async () => {
    if (!cpfValid) { toast({ title: "CPF invalido", variant: "destructive" }); return; }
    const cleanDoc = docBusca.replace(/\D/g, "");
    if (!cleanDoc || (cleanDoc.length !== 11 && cleanDoc.length !== 14)) {
      toast({ title: "Documento invalido (CPF ou CNPJ)", variant: "destructive" });
      return;
    }
    setLoading(true);
    setHabilitacaoResult(null);
    try {
      const res = await fetch("/api/pdpj/habilitacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody(), documento: cleanDoc }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.message || "Erro", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setHabilitacaoResult(data);
    } catch (err: any) {
      toast({ title: "Erro: " + err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchPessoa = async () => {
    if (!cpfValid) { toast({ title: "CPF invalido", variant: "destructive" }); return; }
    const cleanDoc = docBusca.replace(/\D/g, "");
    if (!cleanDoc) {
      toast({ title: "Informe o documento", variant: "destructive" });
      return;
    }
    setLoading(true);
    setPessoaResult(null);
    try {
      const res = await fetch("/api/pdpj/pessoa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody(), documento: cleanDoc, tipoPessoa }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.message || "Erro", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setPessoaResult(data);
    } catch (err: any) {
      toast({ title: "Erro: " + err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const notifFetch = async (endpoint: string, extraBody: Record<string, any> = {}) => {
    if (!cpfValid) { toast({ title: "CPF invalido", variant: "destructive" }); return null; }
    setLoading(true);
    try {
      const res = await fetch(`/api/pdpj/notificacoes/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody(), ...extraBody }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.message || "Erro", variant: "destructive" });
        return null;
      }
      const data = await res.json();
      return data;
    } catch (err: any) {
      toast({ title: "Erro: " + err.message, variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifServicos = async () => {
    const data = await notifFetch("servicos");
    if (data) { setNotifServicos(data); toast({ title: "Servicos carregados!" }); }
  };

  const fetchNotifEventos = async (servicoId?: string) => {
    const data = await notifFetch("eventos", servicoId ? { servicoId: Number(servicoId) } : {});
    if (data) { setNotifEventos(data); toast({ title: "Eventos carregados!" }); }
  };

  const fetchNotifInscricoes = async (servicoId?: string, eventoId?: string) => {
    const extra: Record<string, any> = {};
    if (servicoId) extra.servicoId = Number(servicoId);
    if (eventoId) extra.eventoId = Number(eventoId);
    const data = await notifFetch("inscricoes", extra);
    if (data) { setNotifInscricoes(data); toast({ title: "Inscricoes carregadas!" }); }
  };

  const fetchNotifInscricoesUsuario = async () => {
    const data = await notifFetch("inscricoes/usuario");
    if (data) { setNotifInscricoesUsuario(data); toast({ title: "Minhas inscricoes carregadas!" }); }
  };

  const fetchNotifTemplates = async (eventoId: string) => {
    if (!eventoId) { toast({ title: "Selecione um evento", variant: "destructive" }); return; }
    const data = await notifFetch("templates", { eventoId: Number(eventoId) });
    if (data) { setNotifTemplates(data); toast({ title: "Templates carregados!" }); }
  };

  const fetchNotifAdmin = async () => {
    const data = await notifFetch("admin-consultas");
    if (data) { setNotifAdminConsultas(data); toast({ title: "Admin consultas carregadas!" }); }
  };

  const fetchNotifSubscritor = async (servicoId?: string) => {
    const data = await notifFetch("subscritor-consultas", servicoId ? { servicoId: Number(servicoId) } : {});
    if (data) { setNotifSubscritorConsultas(data); toast({ title: "Subscricoes carregadas!" }); }
  };

  const fetchNotifTribunais = async () => {
    const data = await notifFetch("tribunais");
    if (data) { setNotifTribunais(data); toast({ title: "Tribunais carregados!" }); }
  };

  const copyJson = async (data: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      toast({ title: "Dados copiados!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: "conexao", label: "Conexao", icon: Wifi },
    { id: "comunicacoes", label: "Comunicacoes", icon: Mail },
    { id: "representados", label: "Representados", icon: Users },
    { id: "habilitacao", label: "Habilitacao", icon: UserCheck },
    { id: "pessoa", label: "Pessoa", icon: Search },
    { id: "notificacoes", label: "Notificacoes", icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between gap-2 p-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="link-back-home">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold">Consulta PDPJ</h1>
            </div>
            <Badge variant="outline" className="text-xs">Domicilio Eletronico</Badge>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {pemConfigured === false && (
          <Card className="p-4 border-destructive" data-testid="card-pem-not-configured">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Chave PEM nao configurada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Para acessar as APIs do PDPJ, configure a chave privada PEM no segredo PDPJ_PEM_PRIVATE_KEY.
                  Use a pagina <Link href="/token" className="underline text-primary">Gerador de Token</Link> para mais detalhes.
                </p>
              </div>
            </div>
          </Card>
        )}

        {pemConfigured === true && (
          <Card className="p-4 border-green-500/30" data-testid="card-pem-configured">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">Chave PEM configurada</span>
            </div>
          </Card>
        )}

        <Card className="p-4 space-y-3" data-testid="card-config">
          <p className="text-sm font-medium text-muted-foreground">Configuracao de Acesso</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">CPF (autenticacao)</label>
              <Input
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                data-testid="input-cpf"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tribunal</label>
              <Select value={tribunal} onValueChange={setTribunal}>
                <SelectTrigger data-testid="select-tribunal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIBUNAIS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Modo</label>
              <Select value={modo} onValueChange={(v) => setModo(v as any)}>
                <SelectTrigger data-testid="select-modo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdpj">PDPJ (Swagger)</SelectItem>
                  <SelectItem value="pjud">PJUD (API)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ambiente</label>
              <Select value={ambiente} onValueChange={(v) => setAmbiente(v as any)}>
                <SelectTrigger data-testid="select-ambiente">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologacao</SelectItem>
                  <SelectItem value="producao">Producao</SelectItem>
                  <SelectItem value="mock1">Mock Swagger (MAIKON 1)</SelectItem>
                  <SelectItem value="mock2">Mock Swagger (MAIKON 12)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <div className="flex gap-1 flex-wrap border-b pb-2">
          {tabs.map(tab => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className="gap-1.5 text-xs"
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === "conexao" && (
          <Card className="p-4 space-y-4" data-testid="panel-conexao">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Testar Conexao</h3>
                <p className="text-sm text-muted-foreground">
                  Verifica se o token JWT e aceito pela API do Domicilio Eletronico
                </p>
              </div>
              <Button onClick={testConnection} disabled={loading || !cpfValid || !pemConfigured} data-testid="button-test-connection">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                <span className="ml-2">Testar</span>
              </Button>
            </div>

            {connectionResult && (
              <Card className={`p-3 ${connectionResult.connected ? "border-green-500/30" : "border-destructive/30"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {connectionResult.connected ? (
                    <><Wifi className="w-4 h-4 text-green-600" /><span className="font-medium text-green-600">Conectado</span></>
                  ) : (
                    <><WifiOff className="w-4 h-4 text-destructive" /><span className="font-medium text-destructive">Falha</span></>
                  )}
                  {connectionResult.ambiente && <Badge variant="outline" className="text-xs">{connectionResult.ambiente}</Badge>}
                </div>
                {connectionResult.message && (
                  <p className="text-sm text-muted-foreground">{connectionResult.message}</p>
                )}
                {connectionResult.data && (
                  <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={() => copyJson(connectionResult.data)} data-testid="button-copy-connection">
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span className="ml-1">Copiar dados</span>
                    </Button>
                    {connectionResult.debug_token_payload && (
                      <div className="mt-3 p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
                        <p className="text-[10px] font-bold text-yellow-600 uppercase mb-1">Debug Token Payload (JWT)</p>
                        <pre className="text-[10px] text-muted-foreground font-mono">
                          {JSON.stringify(connectionResult.debug_token_payload, null, 2)}
                        </pre>
                      </div>
                    )}
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-60">
                      {JSON.stringify(connectionResult.data, null, 2)}
                    </pre>
                  </div>
                )}
              </Card>
            )}

            <Card className="p-3 bg-muted/50">
              <div className="flex items-start gap-2">
                <Globe className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Nota:</strong> As APIs do PDPJ so funcionam a partir de IPs brasileiros.</p>
                  <p>Se a conexao falhar com erro 403, pode ser restricao geografica. Apos publicar o app em servidor brasileiro, deve funcionar normalmente.</p>
                  <p>Se falhar com erro 401, a chave PEM pode nao estar registrada no PDPJ. Envie o email de registro pela pagina <Link href="/token" className="underline text-primary">Gerador de Token</Link>.</p>
                </div>
              </div>
            </Card>
          </Card>
        )}

        {activeTab === "comunicacoes" && (
          <Card className="p-4 space-y-4" data-testid="panel-comunicacoes">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Comunicacoes Processuais
              </h3>
              <p className="text-sm text-muted-foreground">
                Citacoes e intimacoes dos seus representados no Domicilio Judicial Eletronico
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Data Inicio</label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} data-testid="input-data-inicio-com" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Data Fim</label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} data-testid="input-data-fim-com" />
              </div>
              <div className="flex items-end">
                <Button onClick={fetchComunicacoes} disabled={loading || !cpfValid || !pemConfigured} className="w-full" data-testid="button-fetch-comunicacoes">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                  Consultar
                </Button>
              </div>
            </div>

            {comunicacoes && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{Array.isArray(comunicacoes) ? comunicacoes.length : comunicacoes?.content?.length || 0} resultados</Badge>
                  <Button size="sm" variant="outline" onClick={() => copyJson(comunicacoes)} data-testid="button-copy-comunicacoes">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span className="ml-1">Copiar tudo</span>
                  </Button>
                </div>
                <div className="space-y-2 max-h-[500px] overflow-auto">
                  {(Array.isArray(comunicacoes) ? comunicacoes : comunicacoes?.content || []).map((com: any, i: number) => (
                    <Card key={i} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          {com.numeroProcesso && <p className="text-sm font-mono font-medium">{com.numeroProcesso}</p>}
                          {com.nomeTribunal && <p className="text-xs text-muted-foreground">{com.nomeTribunal}</p>}
                          {com.tipoComunicacao && <Badge variant="secondary" className="text-xs">{com.tipoComunicacao}</Badge>}
                          {com.dataDisponibilizacao && <p className="text-xs text-muted-foreground">Disponibilizado: {com.dataDisponibilizacao}</p>}
                          {com.dataLimite && <p className="text-xs text-muted-foreground">Prazo: {com.dataLimite}</p>}
                          {com.situacao && <Badge variant={com.situacao === "PENDENTE" ? "destructive" : "outline"} className="text-xs">{com.situacao}</Badge>}
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => copyJson(com)} className="flex-shrink-0" data-testid={`button-copy-com-${i}`}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
                {comunicacoes?.totalPages > 1 && (
                  <div className="flex items-center gap-2 justify-center pt-2">
                    <Button size="sm" variant="outline" disabled={pagina <= 0} onClick={() => { setPagina(p => p - 1); fetchComunicacoes(); }}>Anterior</Button>
                    <span className="text-sm text-muted-foreground">Pagina {pagina + 1} de {comunicacoes.totalPages}</span>
                    <Button size="sm" variant="outline" disabled={pagina >= comunicacoes.totalPages - 1} onClick={() => { setPagina(p => p + 1); fetchComunicacoes(); }}>Proxima</Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {activeTab === "representados" && (
          <Card className="p-4 space-y-4" data-testid="panel-representados">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Meus Representados
              </h3>
              <p className="text-sm text-muted-foreground">
                Lista de pessoas fisicas e juridicas que voce representa como advogado
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Data Inicio</label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} data-testid="input-data-inicio-rep" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Data Fim</label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} data-testid="input-data-fim-rep" />
              </div>
              <div className="flex items-end">
                <Button onClick={fetchRepresentados} disabled={loading || !cpfValid || !pemConfigured} className="w-full" data-testid="button-fetch-representados">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Users className="w-4 h-4 mr-2" />}
                  Consultar
                </Button>
              </div>
            </div>

            {representados && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{Array.isArray(representados) ? representados.length : 0} representados</Badge>
                  <Button size="sm" variant="outline" onClick={() => copyJson(representados)} data-testid="button-copy-representados">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span className="ml-1">Copiar tudo</span>
                  </Button>
                </div>
                <div className="space-y-2 max-h-[500px] overflow-auto">
                  {(Array.isArray(representados) ? representados : []).map((rep: any, i: number) => (
                    <Card key={i} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          {rep.nome && <p className="text-sm font-medium">{rep.nome}</p>}
                          {rep.documento && <p className="text-xs font-mono text-muted-foreground">{rep.documento}</p>}
                          {rep.tipo && <Badge variant="outline" className="text-xs">{rep.tipo}</Badge>}
                          {rep.quantidadeComunicacoes !== undefined && (
                            <p className="text-xs text-muted-foreground">{rep.quantidadeComunicacoes} comunicacoes</p>
                          )}
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => copyJson(rep)} className="flex-shrink-0" data-testid={`button-copy-rep-${i}`}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
                {!Array.isArray(representados) && representados && (
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60">{JSON.stringify(representados, null, 2)}</pre>
                )}
              </div>
            )}
          </Card>
        )}

        {activeTab === "habilitacao" && (
          <Card className="p-4 space-y-4" data-testid="panel-habilitacao">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                Verificar Habilitacao
              </h3>
              <p className="text-sm text-muted-foreground">
                Verifica se uma pessoa esta habilitada no Domicilio Judicial Eletronico
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">CPF ou CNPJ para verificar</label>
                <Input
                  value={docBusca}
                  onChange={(e) => setDocBusca(e.target.value.replace(/[^\d.-/]/g, ""))}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  data-testid="input-doc-habilitacao"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={checkHabilitacao} disabled={loading || !cpfValid || !pemConfigured} className="w-full" data-testid="button-check-habilitacao">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
                  Verificar
                </Button>
              </div>
            </div>

            {habilitacaoResult && (
              <Card className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">Resultado</span>
                  <Button size="sm" variant="outline" onClick={() => copyJson(habilitacaoResult)} data-testid="button-copy-habilitacao">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span className="ml-1">Copiar</span>
                  </Button>
                </div>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60">{JSON.stringify(habilitacaoResult, null, 2)}</pre>
              </Card>
            )}
          </Card>
        )}

        {activeTab === "pessoa" && (
          <Card className="p-4 space-y-4" data-testid="panel-pessoa">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                <Search className="w-4 h-4" />
                Consultar Pessoa
              </h3>
              <p className="text-sm text-muted-foreground">
                Busca dados de pessoa fisica ou juridica na base do PDPJ
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Tipo</label>
                <Select value={tipoPessoa} onValueChange={(v) => setTipoPessoa(v as any)}>
                  <SelectTrigger data-testid="select-tipo-pessoa">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fisica">Pessoa Fisica</SelectItem>
                    <SelectItem value="juridica">Pessoa Juridica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{tipoPessoa === "juridica" ? "CNPJ" : "CPF"}</label>
                <Input
                  value={docBusca}
                  onChange={(e) => setDocBusca(e.target.value.replace(/[^\d.-/]/g, ""))}
                  placeholder={tipoPessoa === "juridica" ? "00.000.000/0000-00" : "000.000.000-00"}
                  data-testid="input-doc-pessoa"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={fetchPessoa} disabled={loading || !cpfValid || !pemConfigured} className="w-full" data-testid="button-fetch-pessoa">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                  Consultar
                </Button>
              </div>
            </div>

            {pessoaResult && (
              <Card className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">Resultado</span>
                  <Button size="sm" variant="outline" onClick={() => copyJson(pessoaResult)} data-testid="button-copy-pessoa">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span className="ml-1">Copiar</span>
                  </Button>
                </div>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60">{JSON.stringify(pessoaResult, null, 2)}</pre>
              </Card>
            )}
          </Card>
        )}

        {activeTab === "notificacoes" && (
          <Card className="p-4 space-y-4" data-testid="panel-notificacoes">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Servico de Notificacoes PDPJ
              </h3>
              <p className="text-sm text-muted-foreground">
                Gerencie servicos, eventos, inscricoes e templates de notificacao do PDPJ
              </p>
            </div>

            <div className="flex gap-1 flex-wrap border-b pb-2">
              {([
                { id: "servicos" as const, label: "Servicos", icon: Server },
                { id: "eventos" as const, label: "Eventos", icon: Zap },
                { id: "inscricoes" as const, label: "Inscricoes", icon: Bell },
                { id: "minhas" as const, label: "Minhas Inscricoes", icon: UserCheck },
                { id: "templates" as const, label: "Templates", icon: FileText },
                { id: "admin" as const, label: "Admin", icon: Shield },
                { id: "subscritor" as const, label: "Subscritor", icon: BookOpen },
                { id: "tribunais" as const, label: "Tribunais", icon: Building2 },
              ]).map(sub => (
                <Button
                  key={sub.id}
                  variant={notifSubTab === sub.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setNotifSubTab(sub.id)}
                  className="gap-1 text-[11px]"
                  data-testid={`notif-tab-${sub.id}`}
                >
                  <sub.icon className="w-3 h-3" />
                  {sub.label}
                </Button>
              ))}
            </div>

            {notifSubTab === "servicos" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Lista todos os servicos registrados no PDPJ</p>
                  <Button onClick={fetchNotifServicos} disabled={loading || !cpfValid || !pemConfigured} size="sm" data-testid="button-fetch-notif-servicos">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span className="ml-1.5">Carregar</span>
                  </Button>
                </div>
                {notifServicos && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{(notifServicos?.dados || notifServicos || []).length || 0} servicos</Badge>
                      <Button size="sm" variant="outline" onClick={() => copyJson(notifServicos)}>
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span className="ml-1">Copiar</span>
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-auto">
                      {(notifServicos?.dados || (Array.isArray(notifServicos) ? notifServicos : [])).map((srv: any, i: number) => (
                        <Card key={i} className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0 flex-1">
                              <p className="text-sm font-medium">{srv.nome || `Servico #${srv.id}`}</p>
                              {srv.descricao && <p className="text-xs text-muted-foreground">{srv.descricao}</p>}
                              <div className="flex gap-1.5 flex-wrap">
                                {srv.versao && <Badge variant="outline" className="text-[10px]">v{srv.versao}</Badge>}
                                <Badge variant={srv.ativo ? "default" : "secondary"} className="text-[10px]">{srv.ativo ? "Ativo" : "Inativo"}</Badge>
                                {srv.id && <Badge variant="outline" className="text-[10px]">ID: {srv.id}</Badge>}
                              </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => { setNotifSelectedServico(String(srv.id)); setNotifSubTab("eventos"); fetchNotifEventos(String(srv.id)); }}>
                              <Zap className="w-3 h-3 mr-1" />Eventos
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {notifSubTab === "eventos" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground flex-1">Eventos de um servico</p>
                  <Input
                    value={notifSelectedServico}
                    onChange={(e) => setNotifSelectedServico(e.target.value)}
                    placeholder="ID do Servico"
                    className="w-32"
                    data-testid="input-notif-servico-id"
                  />
                  <Button onClick={() => fetchNotifEventos(notifSelectedServico)} disabled={loading || !cpfValid || !pemConfigured} size="sm" data-testid="button-fetch-notif-eventos">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span className="ml-1.5">Buscar</span>
                  </Button>
                </div>
                {notifEventos && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{(notifEventos?.dados || notifEventos || []).length || 0} eventos</Badge>
                      <Button size="sm" variant="outline" onClick={() => copyJson(notifEventos)}>
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span className="ml-1">Copiar</span>
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-auto">
                      {(notifEventos?.dados || (Array.isArray(notifEventos) ? notifEventos : [])).map((evt: any, i: number) => (
                        <Card key={i} className="p-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{evt.nome || `Evento #${evt.id}`}</p>
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={() => { setNotifSelectedEvento(String(evt.id)); fetchNotifTemplates(String(evt.id)); setNotifSubTab("templates"); }} className="text-[10px] h-6">
                                  <FileText className="w-3 h-3 mr-1" />Templates
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setNotifSelectedEvento(String(evt.id)); fetchNotifInscricoes(undefined, String(evt.id)); setNotifSubTab("inscricoes"); }} className="text-[10px] h-6">
                                  <Bell className="w-3 h-3 mr-1" />Inscricoes
                                </Button>
                              </div>
                            </div>
                            {evt.descricao && <p className="text-xs text-muted-foreground">{evt.descricao}</p>}
                            <div className="flex gap-1.5 flex-wrap">
                              <Badge variant={evt.ativo ? "default" : "secondary"} className="text-[10px]">{evt.ativo ? "Ativo" : "Inativo"}</Badge>
                              {evt.id && <Badge variant="outline" className="text-[10px]">ID: {evt.id}</Badge>}
                              {evt.objetoAfetadoPrincipal && <Badge variant="outline" className="text-[10px]">{evt.objetoAfetadoPrincipal}</Badge>}
                              {evt.nomeDTO && <Badge variant="outline" className="text-[10px]">DTO: {evt.nomeDTO}</Badge>}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {notifSubTab === "inscricoes" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground flex-1">Inscricoes em eventos</p>
                  <Input
                    value={notifSelectedServico}
                    onChange={(e) => setNotifSelectedServico(e.target.value)}
                    placeholder="ID Servico"
                    className="w-28"
                  />
                  <Input
                    value={notifSelectedEvento}
                    onChange={(e) => setNotifSelectedEvento(e.target.value)}
                    placeholder="ID Evento"
                    className="w-28"
                  />
                  <Button onClick={() => fetchNotifInscricoes(notifSelectedServico, notifSelectedEvento)} disabled={loading || !cpfValid || !pemConfigured} size="sm">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span className="ml-1.5">Buscar</span>
                  </Button>
                </div>
                {notifInscricoes && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{(notifInscricoes?.dados || notifInscricoes || []).length || 0} inscricoes</Badge>
                      <Button size="sm" variant="outline" onClick={() => copyJson(notifInscricoes)}>
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span className="ml-1">Copiar</span>
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-auto">
                      {(notifInscricoes?.dados || (Array.isArray(notifInscricoes) ? notifInscricoes : [])).map((insc: any, i: number) => (
                        <Card key={i} className="p-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{insc.nome || `Inscricao #${insc.id}`}</p>
                            <div className="flex gap-1.5 flex-wrap">
                              <Badge variant={insc.ativo ? "default" : "secondary"} className="text-[10px]">{insc.ativo ? "Ativa" : "Inativa"}</Badge>
                              {insc.formato && <Badge variant="outline" className="text-[10px]">{insc.formato}</Badge>}
                              {insc.jtr && <Badge variant="outline" className="text-[10px]">JTR: {insc.jtr}</Badge>}
                              {insc.endpointWebhook && <Badge variant="outline" className="text-[10px] max-w-[200px] truncate">Webhook: {insc.endpointWebhook}</Badge>}
                              {insc.email && <Badge variant="outline" className="text-[10px]">Email: {insc.email}</Badge>}
                            </div>
                            {insc.dataInscricao && <p className="text-[10px] text-muted-foreground">Inscrito: {new Date(insc.dataInscricao).toLocaleDateString("pt-BR")}</p>}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {notifSubTab === "minhas" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Todas as suas inscricoes nos tribunais</p>
                  <Button onClick={fetchNotifInscricoesUsuario} disabled={loading || !cpfValid || !pemConfigured} size="sm">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span className="ml-1.5">Carregar</span>
                  </Button>
                </div>
                {notifInscricoesUsuario && (
                  <div className="space-y-2">
                    <Button size="sm" variant="outline" onClick={() => copyJson(notifInscricoesUsuario)}>
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span className="ml-1">Copiar</span>
                    </Button>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-[400px]">{JSON.stringify(notifInscricoesUsuario, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}

            {notifSubTab === "templates" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground flex-1">Templates de um evento</p>
                  <Input
                    value={notifSelectedEvento}
                    onChange={(e) => setNotifSelectedEvento(e.target.value)}
                    placeholder="ID do Evento"
                    className="w-32"
                  />
                  <Button onClick={() => fetchNotifTemplates(notifSelectedEvento)} disabled={loading || !cpfValid || !pemConfigured || !notifSelectedEvento} size="sm">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span className="ml-1.5">Buscar</span>
                  </Button>
                </div>
                {notifTemplates && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{(notifTemplates?.dados || notifTemplates || []).length || 0} templates</Badge>
                      <Button size="sm" variant="outline" onClick={() => copyJson(notifTemplates)}>
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span className="ml-1">Copiar</span>
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-auto">
                      {(notifTemplates?.dados || (Array.isArray(notifTemplates) ? notifTemplates : [])).map((tpl: any, i: number) => (
                        <Card key={i} className="p-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{tpl.nome || `Template #${tpl.id}`}</p>
                            <div className="flex gap-1.5 flex-wrap">
                              <Badge variant={tpl.ativo ? "default" : "secondary"} className="text-[10px]">{tpl.ativo ? "Ativo" : "Inativo"}</Badge>
                              {tpl.formato && <Badge variant="outline" className="text-[10px]">{tpl.formato}</Badge>}
                              {tpl.descricaoDocumento && <Badge variant="outline" className="text-[10px]">{tpl.descricaoDocumento}</Badge>}
                              {tpl.sigiloNome && <Badge variant="outline" className="text-[10px]">Sigilo: {tpl.sigiloNome}</Badge>}
                            </div>
                            {tpl.textoParametrizado && (
                              <pre className="text-[10px] bg-muted p-1.5 rounded mt-1 overflow-auto max-h-20">{tpl.textoParametrizado}</pre>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {notifSubTab === "admin" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Visao administrativa: servicos, eventos e templates</p>
                  <Button onClick={fetchNotifAdmin} disabled={loading || !cpfValid || !pemConfigured} size="sm">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span className="ml-1.5">Carregar</span>
                  </Button>
                </div>
                {notifAdminConsultas && (
                  <div className="space-y-2">
                    <Button size="sm" variant="outline" onClick={() => copyJson(notifAdminConsultas)}>
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span className="ml-1">Copiar</span>
                    </Button>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-[400px]">{JSON.stringify(notifAdminConsultas, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}

            {notifSubTab === "subscritor" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground flex-1">Consulta subscricoes por servico</p>
                  <Input
                    value={notifSelectedServico}
                    onChange={(e) => setNotifSelectedServico(e.target.value)}
                    placeholder="ID do Servico (opcional)"
                    className="w-48"
                  />
                  <Button onClick={() => fetchNotifSubscritor(notifSelectedServico)} disabled={loading || !cpfValid || !pemConfigured} size="sm">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span className="ml-1.5">Buscar</span>
                  </Button>
                </div>
                {notifSubscritorConsultas && (
                  <div className="space-y-2">
                    <Button size="sm" variant="outline" onClick={() => copyJson(notifSubscritorConsultas)}>
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span className="ml-1">Copiar</span>
                    </Button>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-[400px]">{JSON.stringify(notifSubscritorConsultas, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}

            {notifSubTab === "tribunais" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Tribunais associados ao seu usuario</p>
                  <Button onClick={fetchNotifTribunais} disabled={loading || !cpfValid || !pemConfigured} size="sm">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span className="ml-1.5">Carregar</span>
                  </Button>
                </div>
                {notifTribunais && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{(notifTribunais?.dados || notifTribunais || []).length || 0} tribunais</Badge>
                      <Button size="sm" variant="outline" onClick={() => copyJson(notifTribunais)}>
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span className="ml-1">Copiar</span>
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-auto">
                      {(notifTribunais?.dados || (Array.isArray(notifTribunais) ? notifTribunais : [])).map((trib: any, i: number) => (
                        <Card key={i} className="p-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-primary" />
                            <p className="text-sm font-medium">{trib.nome || `Tribunal #${trib.id}`}</p>
                            {trib.id && <Badge variant="outline" className="text-[10px]">ID: {trib.id}</Badge>}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Card className="p-3 bg-muted/50">
              <div className="flex items-start gap-2">
                <Globe className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>API de Notificacoes:</strong> Servico para gerenciar inscricoes em eventos do PDPJ (SISBAJUD, PJe, etc).</p>
                  <p>Voce pode se inscrever para receber notificacoes via webhook, email ou documento quando eventos ocorrem nos processos.</p>
                  <p>Formatos disponiveis: RAW (dados brutos), ALERTA, DOCUMENTO e EMAIL.</p>
                </div>
              </div>
            </Card>
          </Card>
        )}
      </main>
    </div>
  );
}
