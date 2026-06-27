import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  History,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  clearRlsEvents,
  listRlsEvents,
  subscribeRlsEvents,
  type RlsEvent,
} from "@/lib/rls-events";

export const Route = createFileRoute("/_authenticated/audit-log")({
  component: AuditLogPage,
});

type AuditAction = "INSERT" | "UPDATE" | "DELETE";
type AuditRow = {
  id: string;
  inventory_item_id: string | null;
  user_id: string;
  action: AuditAction;
  changed_fields: Record<string, unknown> | null;
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
  created_at: string;
};

const PAGE_SIZE = 20;

function itemLabel(row: AuditRow): string {
  const src = row.new_row ?? row.old_row ?? {};
  const name = (src as Record<string, unknown>).nome_oggetto;
  return typeof name === "string" && name ? name : row.inventory_item_id?.slice(0, 8) ?? "—";
}

function changedSummary(row: AuditRow): string {
  if (row.action === "INSERT") return "Articolo creato";
  if (row.action === "DELETE") return "Articolo eliminato";
  const keys = row.changed_fields ? Object.keys(row.changed_fields) : [];
  if (keys.length === 0) return "Nessuna modifica";
  const filtered = keys.filter((k) => k !== "updated_at");
  if (filtered.length === 0) return "Aggiornamento tecnico";
  return filtered.slice(0, 5).join(", ") + (filtered.length > 5 ? ` +${filtered.length - 5}` : "");
}

function actionBadge(action: AuditAction) {
  const map: Record<AuditAction, { label: string; cls: string }> = {
    INSERT: { label: "Creato", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    UPDATE: { label: "Modificato", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
    DELETE: { label: "Eliminato", cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  };
  const m = map[action];
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function AuditLogPage() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [action, setAction] = useState<"all" | AuditAction>("all");
  const [productQuery, setProductQuery] = useState<string>("");
  const [page, setPage] = useState(0);

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0); }, [from, to, action, productQuery]);

  // RLS events (local)
  const [rlsEvents, setRlsEvents] = useState<RlsEvent[]>([]);
  useEffect(() => {
    setRlsEvents(listRlsEvents());
    return subscribeRlsEvents(() => setRlsEvents(listRlsEvents()));
  }, []);

  // Resolve product filter -> inventory_item ids (current user only via RLS)
  const productIdsQuery = useQuery({
    queryKey: ["audit-product-ids", productQuery],
    enabled: productQuery.trim().length > 0,
    queryFn: async () => {
      const q = productQuery.trim();
      // try uuid match else name search
      const isUuid = /^[0-9a-f-]{36}$/i.test(q);
      const { data, error } = isUuid
        ? await supabase.from("inventory_items").select("id").eq("id", q)
        : await supabase.from("inventory_items").select("id").ilike("nome_oggetto", `%${q}%`).limit(200);
      if (error) throw error;
      return (data ?? []).map((r) => r.id);
    },
  });

  const auditQuery = useQuery({
    queryKey: ["audit-log", { from, to, action, productIds: productIdsQuery.data ?? null, page }],
    queryFn: async () => {
      let q = supabase
        .from("inventory_audit_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (from) q = q.gte("created_at", new Date(from).toISOString());
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }
      if (action !== "all") q = q.eq("action", action);
      if (productQuery.trim().length > 0) {
        const ids = productIdsQuery.data ?? [];
        if (ids.length === 0) return { rows: [] as AuditRow[], count: 0 };
        q = q.in("inventory_item_id", ids);
      }

      const start = page * PAGE_SIZE;
      const { data, error, count } = await q.range(start, start + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: (data ?? []) as AuditRow[], count: count ?? 0 };
    },
  });

  const rows = auditQuery.data?.rows ?? [];
  const total = auditQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const recentRls = useMemo(() => rlsEvents.slice(0, 5), [rlsEvents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Log Attività Inventario
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cronologia di tutte le creazioni, modifiche ed eliminazioni dei tuoi prodotti.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => auditQuery.refetch()} disabled={auditQuery.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${auditQuery.isFetching ? "animate-spin" : ""}`} />
          Aggiorna
        </Button>
      </div>

      {recentRls.length > 0 && (
        <Alert className="border-rose-500/40 bg-rose-500/5">
          <ShieldAlert className="h-4 w-4 text-rose-400" />
          <AlertTitle className="flex items-center justify-between">
            <span>Tentativi bloccati dalla protezione dati ({rlsEvents.length})</span>
            <Button variant="ghost" size="sm" onClick={() => clearRlsEvents()}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Pulisci
            </Button>
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-xs">
              {recentRls.map((e) => (
                <li key={e.id} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-rose-400" />
                  <span>
                    <span className="font-medium">{e.action}</span> su <span className="font-mono">{e.table}</span>
                    {e.itemLabel ? ` · ${e.itemLabel}` : ""} ·{" "}
                    <span className="text-muted-foreground">
                      {format(new Date(e.at), "d MMM HH:mm", { locale: it })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Da</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">A</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Azione</label>
            <Select value={action} onValueChange={(v) => setAction(v as typeof action)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                <SelectItem value="INSERT">Creazioni</SelectItem>
                <SelectItem value="UPDATE">Modifiche</SelectItem>
                <SelectItem value="DELETE">Eliminazioni</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Prodotto (nome o ID)</label>
            <Input
              placeholder="Es. Pokémon Smeraldo"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
          </div>
        </div>
        {(from || to || action !== "all" || productQuery) && (
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); setAction("all"); setProductQuery(""); }}>
              Reimposta filtri
            </Button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Data</TableHead>
              <TableHead className="w-[120px]">Azione</TableHead>
              <TableHead>Prodotto</TableHead>
              <TableHead>Modifiche</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditQuery.isLoading && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Caricamento…</TableCell></TableRow>
            )}
            {!auditQuery.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nessun evento trovato.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">
                  {format(new Date(r.created_at), "d MMM yyyy HH:mm:ss", { locale: it })}
                </TableCell>
                <TableCell>{actionBadge(r.action)}</TableCell>
                <TableCell>
                  {r.inventory_item_id ? (
                    <Link
                      to="/inventory"
                      className="font-medium hover:underline text-primary"
                    >
                      {itemLabel(r)}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{itemLabel(r)}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{changedSummary(r)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {total === 0 ? "0 eventi" : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} di ${total}`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Indietro
            </Button>
            <span className="text-xs text-muted-foreground">
              Pagina {page + 1} di {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Avanti <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
