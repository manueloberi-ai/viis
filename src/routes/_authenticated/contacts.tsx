import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, CalendarPlus, UserPlus, BellPlus, Search, X, Pencil, Trash2,
  Calendar as CalendarIcon, Link2, LayoutList, CalendarDays, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/contacts")({
  component: ContattiPage,
});

type Kind = "contatto" | "evento" | "promemoria";
type Stato = "svolto" | "in_programma" | "posticipata" | "anticipata";

const PERSONA_OPTIONS = [
  "Fornitori",
  "Commercialista",
  "Clienti",
  "Organizzatori fiere/eventi",
  "Rivenditori",
] as const;

const STATO_OPTIONS: { value: Stato; label: string; className: string }[] = [
  { value: "in_programma", label: "In Programma",   className: "bg-info/15 text-info border-info/30" },
  { value: "svolto",       label: "Svolto",         className: "bg-success/15 text-success border-success/30" },
  { value: "posticipata",  label: "Posticipata",    className: "bg-warning/15 text-warning border-warning/30" },
  { value: "anticipata",   label: "Anticipata",     className: "bg-primary/15 text-primary border-primary/30" },
];

const KIND_META: Record<Kind, { label: string; icon: typeof UserPlus; color: string }> = {
  contatto:    { label: "Contatto",    icon: UserPlus,     color: "bg-primary/15 text-primary border-primary/30" },
  evento:      { label: "Evento",      icon: CalendarPlus, color: "bg-info/15 text-info border-info/30" },
  promemoria:  { label: "Promemoria",  icon: BellPlus,     color: "bg-warning/15 text-warning border-warning/30" },
};

type Row = {
  id: string;
  user_id: string;
  kind: Kind;
  nome: string;
  tipo: string;
  motivo: string | null;
  messaggio: string | null;
  data: string | null;
  note: string | null;
  stato_attivita: Stato;
  parent_id: string | null;
  email: string | null;
  telefono: string | null;
  updated_at: string;
};

const emptyForm = {
  kind: "contatto" as Kind,
  nome: "",
  tipo: "Clienti",
  motivo: "",
  messaggio: "",
  data: "",
  note: "",
  stato_attivita: "in_programma" as Stato,
  parent_id: "" as string,
  email: "",
  telefono: "",
};
type FormState = typeof emptyForm;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function ContattiPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Filters
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | Kind>("all");
  const [personaFilter, setPersonaFilter] = useState<"all" | string>("all");
  const [statoFilter, setStatoFilter] = useState<"all" | Stato>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const listQuery = useQuery({
    queryKey: ["contatti"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id,user_id,kind,nome,tipo,motivo,messaggio,data,note,stato_attivita,parent_id,email,telefono,updated_at")
        .order("data", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  // Auto-complete past activities as "svolto"
  useEffect(() => {
    const rows = listQuery.data;
    if (!rows) return;
    const today = todayISO();
    const stale = rows.filter(
      (r) => r.data && r.data < today && r.stato_attivita === "in_programma",
    );
    if (stale.length === 0) return;
    (async () => {
      const { error } = await supabase
        .from("contacts")
        .update({ stato_attivita: "svolto" } as never)
        .in("id", stale.map((r) => r.id));
      if (!error) qc.invalidateQueries({ queryKey: ["contatti"] });
    })();
  }, [listQuery.data, qc]);

  const upsertMut = useMutation({
    mutationFn: async (payload: FormState & { id?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessione non valida");
      const base = {
        user_id: auth.user.id,
        kind: payload.kind,
        nome: payload.nome.trim() || (payload.kind === "evento" ? "Evento" : payload.kind === "promemoria" ? "Promemoria" : "Contatto"),
        tipo: payload.tipo,
        motivo: payload.motivo.trim() || null,
        messaggio: payload.messaggio.trim() || null,
        data: payload.data || null,
        note: payload.note.trim() || null,
        stato_attivita: payload.stato_attivita,
        parent_id: payload.parent_id || null,
        email: payload.email.trim() || null,
        telefono: payload.telefono.trim() || null,
      };
      if (payload.id) {
        const { error } = await supabase.from("contacts").update(base as never).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(base as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contatti"] });
      toast.success(editingId ? "Voce aggiornata" : "Voce creata");
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message || "Errore di salvataggio"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contatti"] });
      toast.success("Voce eliminata");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = (kind: Kind) => {
    setEditingId(null);
    setForm({ ...emptyForm, kind, data: kind === "contatto" ? "" : todayISO() });
    setOpen(true);
  };

  const openEdit = (r: Row) => {
    setEditingId(r.id);
    setForm({
      kind: r.kind,
      nome: r.nome ?? "",
      tipo: r.tipo ?? "Clienti",
      motivo: r.motivo ?? "",
      messaggio: r.messaggio ?? "",
      data: r.data ?? "",
      note: r.note ?? "",
      stato_attivita: r.stato_attivita ?? "in_programma",
      parent_id: r.parent_id ?? "",
      email: r.email ?? "",
      telefono: r.telefono ?? "",
    });
    setOpen(true);
  };

  const rows = listQuery.data ?? [];

  const parentCandidates = useMemo(
    () => rows.filter((r) => r.kind !== "promemoria"),
    [rows],
  );
  const parentName = (id: string | null) =>
    id ? rows.find((r) => r.id === id)?.nome ?? "—" : "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return rows.filter((r) => {
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (personaFilter !== "all" && r.tipo !== personaFilter) return false;
      if (statoFilter !== "all" && r.stato_attivita !== statoFilter) return false;
      if (fromTs || toTs) {
        if (!r.data) return false;
        const t = new Date(r.data + "T12:00:00").getTime();
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
      }
      if (q) {
        const hay = `${r.nome} ${r.tipo} ${r.motivo ?? ""} ${r.messaggio ?? ""} ${r.note ?? ""} ${r.email ?? ""} ${r.telefono ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, kindFilter, personaFilter, statoFilter, dateFrom, dateTo]);

  const hasFilters = !!(search || dateFrom || dateTo || kindFilter !== "all" || personaFilter !== "all" || statoFilter !== "all");
  const resetFilters = () => {
    setSearch(""); setDateFrom(""); setDateTo("");
    setKindFilter("all"); setPersonaFilter("all"); setStatoFilter("all");
  };

  const counts = useMemo(() => {
    const c = { contatto: 0, evento: 0, promemoria: 0 } as Record<Kind, number>;
    for (const r of rows) c[r.kind] = (c[r.kind] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contatti</h1>
            <p className="text-sm text-muted-foreground">
              Pianifica e gestisci contatti, eventi e promemoria in un unico posto.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openNew("evento")} className="gap-2">
            <CalendarPlus className="h-4 w-4" /> Aggiungi Evento
          </Button>
          <Button onClick={() => openNew("contatto")} variant="secondary" className="gap-2">
            <UserPlus className="h-4 w-4" /> Aggiungi Contatto
          </Button>
          <Button onClick={() => openNew("promemoria")} variant="outline" className="gap-2">
            <BellPlus className="h-4 w-4" /> Aggiungi Promemoria
          </Button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(KIND_META) as Kind[]).map((k) => {
          const Icon = KIND_META[k].icon;
          return (
            <Card key={k} className="flex items-center gap-3 border-border bg-card p-3">
              <div className={`grid h-9 w-9 place-items-center rounded-md border ${KIND_META[k].color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{KIND_META[k].label}</div>
                <div className="text-lg font-bold">{counts[k] ?? 0}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Cerca</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome, motivo, messaggio, note, email…"
                className="pl-7 h-9 text-xs"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo voce</Label>
            <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as "all" | Kind)}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="contatto">Contatto</SelectItem>
                <SelectItem value="evento">Evento</SelectItem>
                <SelectItem value="promemoria">Promemoria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Persona</Label>
            <Select value={personaFilter} onValueChange={(v) => setPersonaFilter(v)}>
              <SelectTrigger className="w-52 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                {PERSONA_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Stato</Label>
            <Select value={statoFilter} onValueChange={(v) => setStatoFilter(v as "all" | Stato)}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                {STATO_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Dal</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[140px] text-xs" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Al</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[140px] text-xs" />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 gap-1">
              <X className="h-3.5 w-3.5" /> Reset
            </Button>
          )}
          <Badge variant="outline" className="h-9 px-3 ml-auto">
            {filtered.length} / {rows.length}
          </Badge>
        </div>
      </Card>

      {/* Table */}
      <Card className="border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Tipo</th>
                <th className="px-3 py-2.5 font-semibold">Nome</th>
                <th className="px-3 py-2.5 font-semibold">Persona</th>
                <th className="px-3 py-2.5 font-semibold">Motivo</th>
                <th className="px-3 py-2.5 font-semibold">Messaggio</th>
                <th className="px-3 py-2.5 font-semibold">Data</th>
                <th className="px-3 py-2.5 font-semibold">Stato</th>
                <th className="px-3 py-2.5 font-semibold">Collegato a</th>
                <th className="px-3 py-2.5 font-semibold">Note</th>
                <th className="px-3 py-2.5 font-semibold text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <tr><td colSpan={10} className="p-8 text-center text-xs text-muted-foreground">Caricamento…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="p-10 text-center text-xs text-muted-foreground">
                  {hasFilters ? "Nessun risultato con i filtri attivi." : "Nessuna voce. Aggiungi un Contatto, un Evento o un Promemoria."}
                </td></tr>
              ) : filtered.map((r) => {
                const stato = STATO_OPTIONS.find((s) => s.value === r.stato_attivita) ?? STATO_OPTIONS[0];
                const meta = KIND_META[r.kind];
                const Icon = meta.icon;
                return (
                  <tr key={r.id} className="border-t border-border/60 hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={`gap-1 ${meta.color}`}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-medium">{r.nome}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.tipo}</td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[160px] truncate" title={r.motivo ?? ""}>{r.motivo ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate" title={r.messaggio ?? ""}>{r.messaggio ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {r.data ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {new Date(r.data + "T12:00:00").toLocaleDateString("it-IT")}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={stato.className}>{stato.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[140px] truncate">
                      {r.parent_id ? (
                        <span className="inline-flex items-center gap-1"><Link2 className="h-3 w-3" />{parentName(r.parent_id)}</span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[180px] truncate" title={r.note ?? ""}>{r.note ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Eliminare questa voce?")) deleteMut.mutate(r.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setEditingId(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifica" : "Aggiungi"} {KIND_META[form.kind].label}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Tipo voce</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as Kind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contatto">Contatto</SelectItem>
                  <SelectItem value="evento">Evento</SelectItem>
                  <SelectItem value="promemoria">Promemoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="es. Fiera Romics, Mario Rossi…" />
            </div>

            <div>
              <Label>Persona</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERSONA_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>

            <div className="sm:col-span-2">
              <Label>Motivo</Label>
              <Input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="es. Consegna fattura, pre-ordine carte…" />
            </div>

            <div className="sm:col-span-2">
              <Label>Messaggio</Label>
              <Textarea rows={2} value={form.messaggio} onChange={(e) => setForm({ ...form, messaggio: e.target.value })} placeholder="Comunicazione associata" />
            </div>

            <div>
              <Label>Stato attività</Label>
              <Select value={form.stato_attivita} onValueChange={(v) => setForm({ ...form, stato_attivita: v as Stato })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATO_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.kind === "promemoria" && (
              <div>
                <Label>Collegato a</Label>
                <Select
                  value={form.parent_id || "__none__"}
                  onValueChange={(v) => setForm({ ...form, parent_id: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Seleziona evento/attività" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessuno</SelectItem>
                    {parentCandidates.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        [{KIND_META[p.kind].label}] {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.kind === "contatto" && (
              <>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label>Telefono</Label>
                  <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <Label>Note</Label>
              <Textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpen(false); setEditingId(null); }}>Annulla</Button>
            <Button
              disabled={upsertMut.isPending || !form.nome.trim()}
              onClick={() => upsertMut.mutate({ ...form, id: editingId ?? undefined })}
            >
              {upsertMut.isPending ? "Salvataggio…" : editingId ? "Aggiorna" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
