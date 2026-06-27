import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  SlidersHorizontal,
  Filter,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Percent,
  PackageCheck,
  Truck,
  ShoppingCart,
  Receipt,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { eur, pct, num } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

type Item = Tables<"inventory_items">;

const PLATFORM_COLORS: Record<string, string> = {
  ebay: "#E53238",
  vinted: "#09B1BA",
  subito: "#E4002B",
  cardmarket: "#3B5BDB",
  wallapop: "#13C1AC",
};
const CATEGORY_COLORS = ["#6366F1", "#8B5CF6", "#10B981", "#F59E0B", "#64748B", "#EC4899"];
const MONTHS_IT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

type Filters = {
  query: string;
  platforms: string[]; // empty = all
  from: string;
  to: string;
  categoria: string; // "" = all
  stato: string; // "" = all
};

const EMPTY_FILTERS: Filters = {
  query: "",
  platforms: [],
  from: "",
  to: "",
  categoria: "",
  stato: "",
};

function HomePage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [quickOpen, setQuickOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);

  const itemsQuery = useQuery({
    queryKey: ["inventory-items-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });
  const allItems = itemsQuery.data ?? [];

  const items = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const fromTs = filters.from ? new Date(filters.from).getTime() : null;
    const toTs = filters.to ? new Date(filters.to).getTime() + 86_399_999 : null;
    return allItems.filter((it) => {
      if (q) {
        const hay = [it.titolo, it.nome_oggetto, it.note, it.codice_tracciamento]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.platforms.length > 0) {
        const p = (it.piattaforma_vendita ?? "").toLowerCase();
        if (!filters.platforms.includes(p)) return false;
      }
      if (filters.categoria && it.categoria_prodotto !== filters.categoria) return false;
      if (filters.stato && it.stato_prodotto !== filters.stato) return false;
      const ref = it.data_vendita ?? it.data_acquisto;
      if ((fromTs || toTs) && ref) {
        const ts = new Date(ref).getTime();
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
      } else if ((fromTs || toTs) && !ref) {
        return false;
      }
      return true;
    });
  }, [allItems, filters]);

  const kpis = useMemo(() => {
    let revenue = 0, costo = 0, sped = 0, tasse = 0;
    let attivi = 0;
    for (const it of items) {
      const sale = Number(it.prezzo_vendita_valore ?? 0);
      revenue += sale;
      costo += Number(it.costo_acquisto ?? 0);
      sped += Number(it.costo_spedizione ?? 0);
      tasse += Number(it.tasse ?? 0);
      if (!it.data_vendita) attivi++;
    }
    const profit = revenue - costo - sped - tasse;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, profit, margin, attivi, costo, sped, tasse };
  }, [items]);

  const platformRevenue = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      if (!it.prezzo_vendita_valore) continue;
      const p = (it.piattaforma_vendita ?? "Altro").trim() || "Altro";
      m.set(p, (m.get(p) ?? 0) + Number(it.prezzo_vendita_valore));
    }
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value, color: PLATFORM_COLORS[name.toLowerCase()] ?? "#6366F1" }))
      .sort((a, b) => b.value - a.value);
  }, [items]);

  const categoryRevenue = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      if (!it.prezzo_vendita_valore) continue;
      const c = (it.categoria_prodotto ?? "Altro").trim() || "Altro";
      m.set(c, (m.get(c) ?? 0) + Number(it.prezzo_vendita_valore));
    }
    return Array.from(m.entries())
      .map(([name, value], i) => ({ name, value, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [items]);

  const monthly = useMemo(() => {
    const buckets = new Map<string, { name: string; value: number; sort: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      buckets.set(key, { name: MONTHS_IT[d.getMonth()], value: 0, sort: d.getTime() });
    }
    for (const it of items) {
      if (!it.data_vendita || !it.prezzo_vendita_valore) continue;
      const d = new Date(it.data_vendita);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.get(key);
      if (b) b.value += Number(it.prezzo_vendita_valore);
    }
    return Array.from(buckets.values()).sort((a, b) => a.sort - b.sort);
  }, [items]);

  const categorie = useMemo(() => {
    const s = new Set<string>();
    for (const it of allItems) if (it.categoria_prodotto) s.add(it.categoria_prodotto);
    return Array.from(s).sort();
  }, [allItems]);
  const stati = useMemo(() => {
    const s = new Set<string>();
    for (const it of allItems) if (it.stato_prodotto) s.add(it.stato_prodotto);
    return Array.from(s).sort();
  }, [allItems]);

  const activeCount =
    (filters.query ? 1 : 0) +
    (filters.platforms.length > 0 ? 1 : 0) +
    (filters.from || filters.to ? 1 : 0) +
    (filters.categoria ? 1 : 0) +
    (filters.stato ? 1 : 0);

  const togglePlatform = (p: string) =>
    setFilters((f) => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p],
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Panoramica delle tue vendite multicanale.
          {activeCount > 0 && (
            <span className="ml-2 text-foreground">
              · {items.length} di {allItems.length} articoli con i filtri attivi
            </span>
          )}
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
            placeholder="Cerca articolo, nota, tracking..."
            className="h-11 pl-10 bg-card border-border"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Popover open={quickOpen} onOpenChange={setQuickOpen}>
            <PopoverTrigger asChild>
              <Button variant="secondary" className="h-11 gap-2">
                <Filter className="h-4 w-4" />
                Quick Filters
                {(filters.platforms.length > 0 || filters.from || filters.to) && (
                  <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px]">
                    {filters.platforms.length + (filters.from || filters.to ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Piattaforma</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {Object.keys(PLATFORM_COLORS).map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={filters.platforms.includes(p)}
                        onCheckedChange={() => togglePlatform(p)}
                      />
                      <span className="capitalize">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Data da</Label>
                  <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Data a</Label>
                  <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div className="flex justify-between gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setFilters((f) => ({ ...f, platforms: [], from: "", to: "" }))}>
                  Azzera
                </Button>
                <Button size="sm" onClick={() => setQuickOpen(false)}>Applica</Button>
              </div>
            </PopoverContent>
          </Popover>

          <Dialog open={advOpen} onOpenChange={setAdvOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-11 gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Advanced
                {(filters.categoria || filters.stato) && (
                  <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px]">
                    {(filters.categoria ? 1 : 0) + (filters.stato ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Filtri avanzati</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Articolo (titolo, nome, note)</Label>
                  <Input
                    value={filters.query}
                    onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                    placeholder="Cerca per testo libero..."
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={filters.categoria || "__all"}
                    onValueChange={(v) => setFilters((f) => ({ ...f, categoria: v === "__all" ? "" : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Tutte</SelectItem>
                      {categorie.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Stato prodotto</Label>
                  <Select
                    value={filters.stato || "__all"}
                    onValueChange={(v) => setFilters((f) => ({ ...f, stato: v === "__all" ? "" : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Tutti" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Tutti</SelectItem>
                      {stati.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Data da</Label>
                    <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Data a</Label>
                    <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Azzera tutti</Button>
                <Button onClick={() => setAdvOpen(false)}>Applica</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {activeCount > 0 && (
            <Button variant="ghost" className="h-11 gap-2" onClick={() => setFilters(EMPTY_FILTERS)}>
              <X className="h-4 w-4" />
              Pulisci
            </Button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Revenue" value={eur(kpis.revenue)} icon={Wallet} tint="from-indigo-500/20 to-indigo-500/0" color="text-indigo-300" />
        <Kpi label="Profitto" value={eur(kpis.profit)} icon={PiggyBank} tint="from-emerald-500/20 to-emerald-500/0" color="text-emerald-300" delta={kpis.profit >= 0 ? 1 : -1} />
        <Kpi label="Margine Medio" value={pct(kpis.margin, 1)} icon={Percent} tint="from-amber-500/20 to-amber-500/0" color="text-amber-300" />
        <Kpi label="Articoli Attivi" value={num(kpis.attivi)} icon={PackageCheck} tint="from-rose-500/20 to-rose-500/0" color="text-rose-300" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Revenue x Piattaforma" subtitle="filtri applicati">
          {platformRevenue.length === 0 ? <Empty /> : <HBar data={platformRevenue} />}
        </ChartCard>
        <ChartCard title="Revenue x Categoria" subtitle="filtri applicati">
          {categoryRevenue.length === 0 ? <Empty /> : <HBar data={categoryRevenue} />}
        </ChartCard>
        <ChartCard title="Revenue Mensile" subtitle="ultimi 6 mesi">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
              <XAxis dataKey="name" stroke="oklch(0.7 0.025 255)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="oklch(0.7 0.025 255)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "oklch(0.3 0.04 275 / 0.25)" }}
                contentStyle={{ background: "oklch(0.22 0.018 265)", border: "1px solid oklch(0.32 0.02 265)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [eur(v), "Revenue"]}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="oklch(0.62 0.21 275)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Profitti + Costi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="relative overflow-hidden border-border bg-card p-6">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <PiggyBank className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Profitti — filtri applicati</div>
              <div className="text-xs text-muted-foreground">Margine sulle vendite chiuse</div>
            </div>
          </div>
          <div className="relative mt-6 flex items-end gap-4">
            <div className={`text-5xl font-bold tracking-tight num ${kpis.profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{eur(kpis.profit)}</div>
            <div className="mb-2 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              {pct(kpis.margin, 1)} margine
            </div>
          </div>
        </Card>

        <Card className="border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 text-rose-300">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Costi — filtri applicati</div>
              <div className="text-xs text-muted-foreground">Suddivisione spese</div>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <CostRow icon={<ShoppingCart className="h-4 w-4" />} label="Acquisti" value={kpis.costo} total={kpis.costo + kpis.sped + kpis.tasse} />
            <CostRow icon={<Truck className="h-4 w-4" />} label="Spedizioni" value={kpis.sped} total={kpis.costo + kpis.sped + kpis.tasse} />
            <CostRow icon={<Percent className="h-4 w-4" />} label="Fee & Tasse" value={kpis.tasse} total={kpis.costo + kpis.sped + kpis.tasse} />
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Totale</span>
            <span className="text-xl font-bold num">{eur(kpis.costo + kpis.sped + kpis.tasse)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label, value, icon: Icon, tint, color, delta,
}: { label: string; value: string; icon: typeof Wallet; tint: string; color: string; delta?: number }) {
  return (
    <Card className="relative overflow-hidden border-border bg-card p-5">
      <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${tint} blur-2xl`} />
      <div className="relative flex items-start justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`grid h-9 w-9 place-items-center rounded-lg bg-background/40 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="relative mt-3 text-3xl font-bold num">{value}</div>
      {delta !== undefined && (
        <div className="relative mt-2 flex items-center gap-1.5 text-xs">
          {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-success" /> : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
          <span className={delta >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
            {delta >= 0 ? "In utile" : "In perdita"}
          </span>
        </div>
      )}
    </Card>
  );
}

function ChartCard({
  title, subtitle, children,
}: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card className="border-border bg-card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-semibold tracking-tight">{title}</h3>
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
      </div>
      {children}
    </Card>
  );
}

function Empty() {
  return (
    <div className="grid h-[240px] place-items-center text-xs text-muted-foreground">
      Nessun dato per i filtri attivi.
    </div>
  );
}

function HBar({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          stroke="oklch(0.78 0.02 255)"
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={92}
        />
        <Tooltip
          cursor={{ fill: "oklch(0.3 0.04 275 / 0.25)" }}
          contentStyle={{ background: "oklch(0.22 0.018 265)", border: "1px solid oklch(0.32 0.02 265)", borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => [eur(v), "Revenue"]}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CostRow({ icon, label, value, total }: { icon: React.ReactNode; label: string; value: number; total: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="text-foreground/70">{icon}</span>
          {label}
        </span>
        <span className="font-semibold num">{eur(value)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
