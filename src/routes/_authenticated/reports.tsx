import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { Euro, Percent, ShoppingBag, BarChart3 } from "lucide-react";
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

function ReportsPage() {
  const [range, setRange] = useState<RangeKey>("180");

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

  const soldFiltered = useMemo(() => {
    return rows.filter((r) => {
      const isSold = r.stato_prodotto === "venduto" || r.stato_prodotto === "venduto_consegnato" || r.data_vendita;
      if (!isSold || !r.data_vendita) return false;
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

  // Helpers
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
        return { name: MONTH_LABELS[Number(mm) - 1], value: Math.round(v) };
      });
  }, [soldFiltered]);

  // Shelf life: days between purchase and sale, average per category
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Analitiche di vendita aggregate dal tuo inventario.
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

      {/* KPI ROW */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Euro className="h-4 w-4" />}
          label="Revenue totale"
          value={fmtEuro(totals.revenue)}
          sub={`${totals.sales} vendite`}
        />
        <KpiCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Profitto medio"
          value={fmtEuro(totals.avgProfit)}
          sub={`Totale ${fmtEuro(totals.profitSum)}`}
        />
        <KpiCard
          icon={<Percent className="h-4 w-4" />}
          label="Margine medio"
          value={`${totals.avgMargin.toFixed(1)}%`}
          sub="Su prezzo di vendita"
        />
        <KpiCard
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Vendite"
          value={String(totals.sales)}
          sub="Nel periodo selezionato"
        />
      </div>

      {/* CHARTS GRID */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Revenue per Marketplace">
          <BarsByPlatform data={revenueByPlatform} fmt={fmtEuro} />
        </ChartCard>
        <ChartCard title="Revenue per Categoria">
          <BarsHorizontal data={revenueByCategory} fmt={fmtEuro} />
        </ChartCard>
        <ChartCard title="Revenue Mensile">
          <BarsByMonth data={revenueByMonth} fmt={fmtEuro} />
        </ChartCard>

        <ChartCard title="Profitto per Marketplace">
          <BarsByPlatform data={profitByPlatform} fmt={fmtEuro} />
        </ChartCard>
        <ChartCard title="Profitto per Categoria">
          <BarsHorizontal data={profitByCategory} fmt={fmtEuro} />
        </ChartCard>
        <ChartCard title="Shelf Life per Categoria (giorni in magazzino)">
          <BarsHorizontal data={shelfLifeByCategory} fmt={(v) => `${v}g`} colorIndex={3} />
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
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
  data, fmt,
}: { data: { name: string; key: string; value: number }[]; fmt: (n: number) => string }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmt(v)} />
        <Tooltip contentStyle={tooltipStyle()} formatter={(v: number) => fmt(v)} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={PLATFORM_COLORS[d.key] ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function BarsByMonth({
  data, fmt,
}: { data: { name: string; value: number }[]; fmt: (n: number) => string }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmt(v)} />
        <Tooltip contentStyle={tooltipStyle()} formatter={(v: number) => fmt(v)} />
        <Bar dataKey="value" fill="#6366F1" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BarsHorizontal({
  data, fmt, colorIndex = 0,
}: { data: { name: string; value: number }[]; fmt: (n: number) => string; colorIndex?: number }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmt(v)} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={90} />
        <Tooltip contentStyle={tooltipStyle()} formatter={(v: number) => fmt(v)} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
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
