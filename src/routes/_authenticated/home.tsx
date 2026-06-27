import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { eur, pct, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

const kpis = [
  { label: "Revenue Mensile",   value: 3520, fmt: eur, delta: 12.4, icon: Wallet,      tint: "from-indigo-500/20 to-indigo-500/0",  color: "text-indigo-300" },
  { label: "Profitto Mensile",  value: 1584, fmt: eur, delta: 9.8,  icon: PiggyBank,   tint: "from-emerald-500/20 to-emerald-500/0", color: "text-emerald-300" },
  { label: "Margine Medio",     value: 45,   fmt: (v: number) => pct(v, 0), delta: 2.1, icon: Percent,     tint: "from-amber-500/20 to-amber-500/0",   color: "text-amber-300" },
  { label: "Annunci Attivi",    value: 47,   fmt: num, delta: -3.2, icon: PackageCheck, tint: "from-rose-500/20 to-rose-500/0",     color: "text-rose-300" },
];

const platformRevenue = [
  { name: "eBay",       value: 2010, color: "#E53238" },
  { name: "Vinted",     value: 1480, color: "#09B1BA" },
  { name: "Subito",     value: 980,  color: "#E4002B" },
  { name: "Cardmarket", value: 720,  color: "#3B5BDB" },
  { name: "Wallapop",   value: 410,  color: "#13C1AC" },
];

const categoryRevenue = [
  { name: "Videogiochi",       value: 1820, color: "#6366F1" },
  { name: "Console",           value: 1240, color: "#8B5CF6" },
  { name: "Carte Collez.",     value: 980,  color: "#10B981" },
  { name: "Accessori",         value: 420,  color: "#F59E0B" },
  { name: "Altro",             value: 180,  color: "#64748B" },
];

const monthly = [
  { name: "Mag", value: 2480 },
  { name: "Giu", value: 2940 },
  { name: "Lug", value: 3120 },
  { name: "Ago", value: 2780 },
  { name: "Set", value: 3340 },
  { name: "Ott", value: 3520 },
];

function HomePage() {
  const [q, setQ] = useState("");
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Panoramica delle tue vendite multicanale.</p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca articolo, ordine, contatto..."
            className="h-11 pl-10 bg-card border-border"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="h-11 gap-2"><Filter className="h-4 w-4" />Quick Filters</Button>
          <Button variant="outline" className="h-11 gap-2"><SlidersHorizontal className="h-4 w-4" />Advanced</Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const positive = k.delta >= 0;
          return (
            <Card key={k.label} className="relative overflow-hidden border-border bg-card p-5">
              <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${k.tint} blur-2xl`} />
              <div className="relative flex items-start justify-between">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {k.label}
                </div>
                <div className={`grid h-9 w-9 place-items-center rounded-lg bg-background/40 ${k.color}`}>
                  <Icon className="h-4.5 w-4.5 h-5 w-5" />
                </div>
              </div>
              <div className="relative mt-3 text-3xl font-bold num">{k.fmt(k.value)}</div>
              <div className="relative mt-2 flex items-center gap-1.5 text-xs">
                {positive ? (
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                )}
                <span className={positive ? "text-success font-semibold" : "text-destructive font-semibold"}>
                  {positive ? "+" : ""}{k.delta}%
                </span>
                <span className="text-muted-foreground">vs mese scorso</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Revenue x Piattaforma" subtitle="ultimi 30 giorni">
          <HBar data={platformRevenue} />
        </ChartCard>
        <ChartCard title="Revenue x Categoria" subtitle="ultimi 30 giorni">
          <HBar data={categoryRevenue} />
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
              <div className="text-sm font-semibold">Profitti ultimi 30gg</div>
              <div className="text-xs text-muted-foreground">Margine sulle vendite chiuse</div>
            </div>
          </div>
          <div className="relative mt-6 flex items-end gap-4">
            <div className="text-5xl font-bold tracking-tight num text-emerald-300">{eur(1584)}</div>
            <div className="mb-2 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              {pct(45, 0)} margine
            </div>
          </div>
        </Card>

        <Card className="border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 text-rose-300">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Costi ultimi 30gg</div>
              <div className="text-xs text-muted-foreground">Suddivisione spese</div>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <CostRow icon={<ShoppingCart className="h-4 w-4" />} label="Acquisti" value={1240} pct={64} />
            <CostRow icon={<Truck className="h-4 w-4" />} label="Spedizioni" value={385} pct={20} />
            <CostRow icon={<Percent className="h-4 w-4" />} label="Fee & Tasse" value={311} pct={16} />
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Totale</span>
            <span className="text-xl font-bold num">{eur(1936)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
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
          width={88}
        />
        <Tooltip
          cursor={{ fill: "oklch(0.3 0.04 275 / 0.25)" }}
          contentStyle={{ background: "oklch(0.22 0.018 265)", border: "1px solid oklch(0.32 0.02 265)", borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => [eur(v), "Revenue"]}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CostRow({ icon, label, value, pct: percent }: { icon: React.ReactNode; label: string; value: number; pct: number }) {
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
