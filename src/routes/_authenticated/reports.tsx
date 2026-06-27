import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Euro, Percent, ShoppingBag, BarChart3, ArrowUpRight, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format as formatDateFn } from "date-fns";
import { it as itLocale } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

type SoldRow = {
  prezzo_vendita_valore: number | null;
  costo_acquisto: number | null;
  costo_spedizione: number | null;
  tasse: number | null;
  fee_piattaforma: number | null;
  profitto: number | null;
  margine_profitto: number | null;
  categoria_prodotto: string | null;
  piattaforma_vendita: string | null;
  data_vendita: string | null;
  data_acquisto: string | null;
  stato_prodotto: string | null;
};

const RANGES = {
  "30": "Ultimi 30 giorni",
  "90": "Ultimi 90 giorni",
  "180": "Ultimi 6 mesi",
  "365": "Ultimo anno",
  all: "Tutto",
} as const;
type RangeKey = keyof typeof RANGES;

const PLATFORM_COLORS: Record<string, string> = {
  vinted: "#09B1BA",
  ebay: "#E53238",
  wallapop: "#13C1AC",
  subito: "#E63312",
  cardmarket: "#F59E0B",
};
const PLATFORM_LABEL: Record<string, string> = {
  vinted: "Vinted",
  ebay: "eBay",
  wallapop: "Wallapop",
  subito: "Subito",
  cardmarket: "Cardmarket",
};

const CATEGORY_COLORS = ["#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#06B6D4"];

const MONTH_LABELS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

function num(v: number | null | undefined): number {
  return typeof v === "number" && !isNaN(v) ? v : 0;
}

// Detail dialog filter spec
type DetailFilter = {
  title: string;
  platformKey?: string;
  category?: string;
  monthKey?: string; // YYYY-MM
};

function ReportsPage() {
  const [range, setRange] = useState<RangeKey>("180");
  const [detail, setDetail] = useState<DetailFilter | null>(null);

  const query = useQuery({
    queryKey: ["reports-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select(
          "prezzo_vendita_valore, costo_acquisto, costo_spedizione, tasse, fee_piattaforma, profitto, margine_profitto, categoria_prodotto, piattaforma_vendita, data_vendita, data_acquisto, stato_prodotto"
        );
      if (error) throw error;
      return (data ?? []) as SoldRow[];
    },
  });

  const rows = query.data ?? [];

  const cutoff = useMemo(() => {
    if (range === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(range));
    return d;
  }, [range]);

  const cutoffISO = cutoff ? cutoff.toISOString().slice(0, 10) : null;

  const soldFiltered = useMemo(() => {
    return rows.filter((r) => {
      if (!r.data_vendita) return false;
      if (!cutoff) return true;
      return new Date(r.data_vendita) >= cutoff;
    });
  }, [rows, cutoff]);

  // KPIs
  const totals = useMemo(() => {
    const revenue = soldFiltered.reduce((s, r) => s + num(r.prezzo_vendita_valore), 0);
    const profitArr = soldFiltered.map((r) => num(r.profitto));
    const profitSum = profitArr.reduce((s, v) => s + v, 0);
    const marginArr = soldFiltered
      .map((r) => num(r.margine_profitto))
      .filter((v) => v !== 0);
    const avgProfit = soldFiltered.length ? profitSum / soldFiltered.length : 0;
    const avgMargin = marginArr.length ? marginArr.reduce((s, v) => s + v, 0) / marginArr.length : 0;
    return {
      revenue,
      profitSum,
      avgProfit,
      avgMargin,
      sales: soldFiltered.length,
    };
  }, [soldFiltered]);

  const groupSum = (key: keyof SoldRow, valueOf: (r: SoldRow) => number) => {
    const m = new Map<string, number>();
    soldFiltered.forEach((r) => {
      const k = (r[key] as string | null) ?? "—";
      m.set(k, (m.get(k) ?? 0) + valueOf(r));
    });
    return m;
  };

  const revenueByPlatform = useMemo(() => {
    const m = groupSum("piattaforma_vendita", (r) => num(r.prezzo_vendita_valore));
    return Array.from(m.entries())
      .map(([k, v]) => ({ name: PLATFORM_LABEL[k] ?? k, key: k, value: Math.round(v) }))
      .sort((a, b) => b.value - a.value);
  }, [soldFiltered]);

  const profitByPlatform = useMemo(() => {
    const m = groupSum("piattaforma_vendita", (r) => num(r.profitto));
    return Array.from(m.entries())
      .map(([k, v]) => ({ name: PLATFORM_LABEL[k] ?? k, key: k, value: Math.round(v) }))
      .sort((a, b) => b.value - a.value);
  }, [soldFiltered]);

  const revenueByCategory = useMemo(() => {
    const m = groupSum("categoria_prodotto", (r) => num(r.prezzo_vendita_valore));
    return Array.from(m.entries())
      .map(([k, v]) => ({ name: k, value: Math.round(v) }))
      .sort((a, b) => b.value - a.value);
  }, [soldFiltered]);

  const profitByCategory = useMemo(() => {
    const m = groupSum("categoria_prodotto", (r) => num(r.profitto));
    return Array.from(m.entries())
      .map(([k, v]) => ({ name: k, value: Math.round(v) }))
      .sort((a, b) => b.value - a.value);
  }, [soldFiltered]);

  const revenueByMonth = useMemo(() => {
    const m = new Map<string, number>();
    soldFiltered.forEach((r) => {
      if (!r.data_vendita) return;
      const d = new Date(r.data_vendita);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      m.set(key, (m.get(key) ?? 0) + num(r.prezzo_vendita_valore));
    });
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        const [, mm] = k.split("-");
        return { name: MONTH_LABELS[Number(mm) - 1], monthKey: k, value: Math.round(v) };
      });
  }, [soldFiltered]);

  const shelfLifeByCategory = useMemo(() => {
    const m = new Map<string, { sum: number; count: number }>();
    soldFiltered.forEach((r) => {
      if (!r.data_acquisto || !r.data_vendita) return;
      const a = new Date(r.data_acquisto).getTime();
      const v = new Date(r.data_vendita).getTime();
      if (isNaN(a) || isNaN(v) || v < a) return;
      const days = Math.round((v - a) / 86400000);
      const key = r.categoria_prodotto ?? "—";
      const cur = m.get(key) ?? { sum: 0, count: 0 };
      m.set(key, { sum: cur.sum + days, count: cur.count + 1 });
    });
    return Array.from(m.entries())
      .map(([k, { sum, count }]) => ({ name: k, value: Math.round(sum / count) }))
      .sort((a, b) => b.value - a.value);
  }, [soldFiltered]);

  const fmtEuro = (v: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

  const openDetail = (f: DetailFilter) => setDetail(f);
  const rangeLabel = RANGES[range];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Clicca su una barra o sull'intestazione del grafico per aprire il dettaglio.
          </p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RANGES).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Euro className="h-4 w-4" />} label="Revenue totale" value={fmtEuro(totals.revenue)} sub={`${totals.sales} vendite`} />
        <KpiCard icon={<BarChart3 className="h-4 w-4" />} label="Profitto medio" value={fmtEuro(totals.avgProfit)} sub={`Totale ${fmtEuro(totals.profitSum)}`} />
        <KpiCard icon={<Percent className="h-4 w-4" />} label="Margine medio" value={`${totals.avgMargin.toFixed(1)}%`} sub="Su prezzo di vendita" />
        <KpiCard icon={<ShoppingBag className="h-4 w-4" />} label="Vendite" value={String(totals.sales)} sub="Nel periodo selezionato" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Revenue per Marketplace" onSeeAll={() => openDetail({ title: `Vendite per marketplace · ${rangeLabel}` })}>
          <BarsByPlatform data={revenueByPlatform} fmt={fmtEuro} onBarClick={(d) => openDetail({ title: `Vendite su ${d.name} · ${rangeLabel}`, platformKey: d.key })} />
        </ChartCard>
        <ChartCard title="Revenue per Categoria" onSeeAll={() => openDetail({ title: `Vendite per categoria · ${rangeLabel}` })}>
          <BarsHorizontal data={revenueByCategory} fmt={fmtEuro} onBarClick={(d) => openDetail({ title: `Vendite in "${d.name}" · ${rangeLabel}`, category: d.name })} />
        </ChartCard>
        <ChartCard title="Revenue Mensile" onSeeAll={() => openDetail({ title: `Vendite mensili · ${rangeLabel}` })}>
          <BarsByMonth data={revenueByMonth} fmt={fmtEuro} onBarClick={(d) => openDetail({ title: `Vendite ${d.name} (${d.monthKey})`, monthKey: d.monthKey })} />
        </ChartCard>

        <ChartCard title="Profitto per Marketplace" onSeeAll={() => openDetail({ title: `Profitto per marketplace · ${rangeLabel}` })}>
          <BarsByPlatform data={profitByPlatform} fmt={fmtEuro} onBarClick={(d) => openDetail({ title: `Profitto su ${d.name} · ${rangeLabel}`, platformKey: d.key })} />
        </ChartCard>
        <ChartCard title="Profitto per Categoria" onSeeAll={() => openDetail({ title: `Profitto per categoria · ${rangeLabel}` })}>
          <BarsHorizontal data={profitByCategory} fmt={fmtEuro} onBarClick={(d) => openDetail({ title: `Profitto in "${d.name}" · ${rangeLabel}`, category: d.name })} />
        </ChartCard>
        <ChartCard title="Shelf Life per Categoria (giorni in magazzino)" onSeeAll={() => openDetail({ title: `Shelf life per categoria · ${rangeLabel}` })}>
          <BarsHorizontal data={shelfLifeByCategory} fmt={(v) => `${v}g`} colorIndex={3} onBarClick={(d) => openDetail({ title: `Articoli in "${d.name}" · ${rangeLabel}`, category: d.name })} />
        </ChartCard>
      </div>

      {query.isLoading && (
        <p className="text-center text-sm text-muted-foreground">Caricamento dati…</p>
      )}
      {!query.isLoading && soldFiltered.length === 0 && (
        <Card className="border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Nessuna vendita registrata nel periodo selezionato. Aggiungi articoli venduti in Inventario per popolare i grafici.
        </Card>
      )}

      <DetailDialog
        filter={detail}
        cutoffISO={cutoffISO}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}

function KpiCard({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">{icon}</div>
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function ChartCard({
  title, children, onSeeAll,
}: { title: string; children: React.ReactNode; onSeeAll?: () => void }) {
  return (
    <Card className="border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {onSeeAll && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-primary hover:text-primary" onClick={onSeeAll}>
            Dettaglio <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="h-[240px] w-full">{children}</div>
    </Card>
  );
}

function tooltipStyle() {
  return {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  } as const;
}

function BarsByPlatform({
  data, fmt, onBarClick,
}: { data: { name: string; key: string; value: number }[]; fmt: (n: number) => string; onBarClick?: (d: { name: string; key: string }) => void }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmt(v)} />
        <Tooltip contentStyle={tooltipStyle()} formatter={(v: number) => fmt(v)} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} onClick={(d) => onBarClick?.(d as { name: string; key: string })} style={{ cursor: onBarClick ? "pointer" : "default" }}>
          {data.map((d, i) => (
            <Cell key={i} fill={PLATFORM_COLORS[d.key] ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function BarsByMonth({
  data, fmt, onBarClick,
}: { data: { name: string; monthKey: string; value: number }[]; fmt: (n: number) => string; onBarClick?: (d: { name: string; monthKey: string }) => void }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmt(v)} />
        <Tooltip contentStyle={tooltipStyle()} formatter={(v: number) => fmt(v)} />
        <Bar dataKey="value" fill="#6366F1" radius={[6, 6, 0, 0]} onClick={(d) => onBarClick?.(d as { name: string; monthKey: string })} style={{ cursor: onBarClick ? "pointer" : "default" }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BarsHorizontal({
  data, fmt, colorIndex = 0, onBarClick,
}: { data: { name: string; value: number }[]; fmt: (n: number) => string; colorIndex?: number; onBarClick?: (d: { name: string }) => void }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmt(v)} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={90} />
        <Tooltip contentStyle={tooltipStyle()} formatter={(v: number) => fmt(v)} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} onClick={(d) => onBarClick?.(d as { name: string })} style={{ cursor: onBarClick ? "pointer" : "default" }}>
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORY_COLORS[(i + colorIndex) % CATEGORY_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return (
    <div className="grid h-full place-items-center text-xs text-muted-foreground">
      Nessun dato disponibile
    </div>
  );
}

// ------------------------------------------------------------------
// Detail dialog with server-side pagination via Supabase
// ------------------------------------------------------------------
const PAGE_SIZE = 10;

function DetailDialog({
  filter, cutoffISO, onClose,
}: { filter: DetailFilter | null; cutoffISO: string | null; onClose: () => void }) {
  const [page, setPage] = useState(0);

  // Reset page when filter changes
  useEffect(() => { setPage(0); }, [filter?.title]);

  const open = !!filter;

  const detailQuery = useQuery({
    queryKey: ["reports-detail", filter, cutoffISO, page],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("inventory_items")
        .select(
          "id, nome_oggetto, piattaforma_vendita, categoria_prodotto, data_vendita, prezzo_vendita_valore, costo_acquisto, profitto, margine_profitto",
          { count: "exact" }
        )
        .not("data_vendita", "is", null)
        .order("data_vendita", { ascending: false });

      if (cutoffISO) q = q.gte("data_vendita", cutoffISO);
      if (filter?.platformKey) q = q.eq("piattaforma_vendita", filter.platformKey);
      if (filter?.category) q = q.eq("categoria_prodotto", filter.category);
      if (filter?.monthKey) {
        const [y, m] = filter.monthKey.split("-").map(Number);
        const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
        const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
        q = q.gte("data_vendita", start).lt("data_vendita", end);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await q.range(from, to);
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const fmtEuro = (v: number | null) =>
    v == null ? "—" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v);

  const total = detailQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = detailQuery.data?.rows ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{filter?.title ?? "Dettaglio"}</DialogTitle>
          <DialogDescription>
            Dati filtrati dal tuo inventario. {total > 0 && `${total} risultati.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Articolo</TableHead>
                <TableHead>Piattaforma</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Prezzo</TableHead>
                <TableHead className="text-right">Profitto</TableHead>
                <TableHead className="text-right">Margine</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailQuery.isLoading && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Caricamento…</TableCell></TableRow>
              )}
              {detailQuery.isError && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-destructive">Errore nel caricamento dei dati.</TableCell></TableRow>
              )}
              {!detailQuery.isLoading && !detailQuery.isError && rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Nessun articolo trovato per questo filtro.</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.data_vendita ? formatDateFn(new Date(r.data_vendita), "d MMM yyyy", { locale: itLocale }) : "—"}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate font-medium">{r.nome_oggetto ?? "—"}</TableCell>
                  <TableCell>
                    {r.piattaforma_vendita ? (
                      <Badge variant="outline" className="capitalize">{PLATFORM_LABEL[r.piattaforma_vendita] ?? r.piattaforma_vendita}</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{r.categoria_prodotto ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtEuro(r.prezzo_vendita_valore)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${num(r.profitto) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtEuro(r.profitto)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.margine_profitto == null ? "—" : `${Number(r.margine_profitto).toFixed(1)}%`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            Pagina {page + 1} di {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || detailQuery.isFetching}>
              <ChevronLeft className="h-4 w-4" /> Precedente
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || detailQuery.isFetching}>
              Successiva <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
