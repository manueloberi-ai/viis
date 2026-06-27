import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users, Plus, Search, Star, StarOff, Pencil, Trash2, Mail, Phone, MapPin,
  ShoppingBag, Filter, X,
} from "lucide-react";
import { toast } from "sonner";
import { PLATFORM_LIST } from "@/lib/platforms";

export const Route = createFileRoute("/_authenticated/contacts")({
  component: ContattiPage,
});

type Contact = Tables<"contacts">;

const TIPI = ["Cliente", "Fornitore", "Collaboratore", "Altro"] as const;
type Tipo = (typeof TIPI)[number];

const TIPO_COLORS: Record<Tipo, string> = {
  Cliente: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Fornitore: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Collaboratore: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  Altro: "bg-muted text-muted-foreground border-border",
};

type FormState = {
  nome: string;
  tipo: Tipo;
  piattaforma: string;
  username: string;
  email: string;
  telefono: string;
  citta: string;
  paese: string;
  note: string;
  preferito: boolean;
};

const EMPTY: FormState = {
  nome: "", tipo: "Cliente", piattaforma: "", username: "", email: "",
  telefono: "", citta: "", paese: "Italia", note: "", preferito: false,
};

function formatEUR(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?";
}

function ContattiPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [filterTipo, setFilterTipo] = useState<"all" | Tipo>("all");
  const [filterFav, setFilterFav] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [toDelete, setToDelete] = useState<Contact | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts").select("*")
        .order("preferito", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });

  const contacts = data ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (filterTipo !== "all" && c.tipo !== filterTipo) return false;
      if (filterFav && !c.preferito) return false;
      if (!q) return true;
      return [c.nome, c.username, c.email, c.telefono, c.citta, c.piattaforma]
        .filter(Boolean).some((s) => (s as string).toLowerCase().includes(q));
    });
  }, [contacts, query, filterTipo, filterFav]);

  const stats = useMemo(() => {
    const clienti = contacts.filter((c) => c.tipo === "Cliente").length;
    const fornitori = contacts.filter((c) => c.tipo === "Fornitore").length;
    const speso = contacts.reduce((sum, c) => sum + Number(c.totale_speso ?? 0), 0);
    return { totale: contacts.length, clienti, fornitori, speso };
  }, [contacts]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(c: Contact) {
    setEditing(c);
    setForm({
      nome: c.nome,
      tipo: (c.tipo as Tipo) ?? "Cliente",
      piattaforma: c.piattaforma ?? "",
      username: c.username ?? "",
      email: c.email ?? "",
      telefono: c.telefono ?? "",
      citta: c.citta ?? "",
      paese: c.paese ?? "",
      note: c.note ?? "",
      preferito: c.preferito,
    });
    setOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Il nome è obbligatorio");
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Utente non autenticato");
      const payload = {
        user_id: uid,
        nome: form.nome.trim(),
        tipo: form.tipo,
        piattaforma: form.piattaforma || null,
        username: form.username || null,
        email: form.email || null,
        telefono: form.telefono || null,
        citta: form.citta || null,
        paese: form.paese || null,
        note: form.note || null,
        preferito: form.preferito,
      };
      if (editing) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Contatto aggiornato" : "Contatto creato");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contatto eliminato");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleFav = useMutation({
    mutationFn: async (c: Contact) => {
      const { error } = await supabase
        .from("contacts").update({ preferito: !c.preferito }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const hasFilters = !!query || filterTipo !== "all" || filterFav;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contatti</h1>
            <p className="text-sm text-muted-foreground">
              Rubrica di clienti, fornitori e collaboratori dei tuoi marketplace.
            </p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Nuovo contatto
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Totale contatti" value={String(stats.totale)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Clienti" value={String(stats.clienti)} icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard label="Fornitori" value={String(stats.fornitori)} icon={<MapPin className="h-4 w-4" />} />
        <StatCard label="Totale speso/incassato" value={formatEUR(stats.speso)} icon={<Star className="h-4 w-4" />} />
      </div>

      <Card className="border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per nome, username, email, città…"
              className="pl-9"
            />
          </div>
          <Select value={filterTipo} onValueChange={(v) => setFilterTipo(v as "all" | Tipo)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tipi</SelectItem>
              {TIPI.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant={filterFav ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterFav((v) => !v)}
            className="gap-2"
          >
            <Star className="h-4 w-4" /> Preferiti
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setFilterTipo("all"); setFilterFav(false); }} className="gap-1">
              <X className="h-3.5 w-3.5" /> Reset
            </Button>
          )}
          <Badge variant="outline" className="ml-auto h-9 px-3">
            <Filter className="h-3 w-3 mr-1" /> {filtered.length} risultati
          </Badge>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border bg-card/50 p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
          <div className="mt-3 text-sm font-semibold">
            {hasFilters ? "Nessun contatto trovato" : "Nessun contatto ancora"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasFilters ? "Prova a modificare i filtri." : "Aggiungi il primo contatto della tua rubrica."}
          </p>
          {!hasFilters && (
            <Button onClick={openNew} className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> Aggiungi contatto
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="border-border bg-card p-4 transition hover:border-primary/40">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {initials(c.nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold">{c.nome}</div>
                    <button
                      type="button"
                      onClick={() => toggleFav.mutate(c)}
                      className="text-amber-400 hover:scale-110 transition"
                      aria-label="Preferito"
                    >
                      {c.preferito ? <Star className="h-3.5 w-3.5 fill-amber-400" /> : <StarOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={`text-[10px] ${TIPO_COLORS[(c.tipo as Tipo) ?? "Altro"]}`}>
                      {c.tipo}
                    </Badge>
                    {c.piattaforma && (
                      <Badge variant="outline" className="text-[10px]">{c.piattaforma}</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-xs">
                {c.username && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-3 w-3" /> <span className="truncate">@{c.username}</span>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <a href={`mailto:${c.email}`} className="truncate hover:text-primary">{c.email}</a>
                  </div>
                )}
                {c.telefono && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <a href={`tel:${c.telefono}`} className="truncate hover:text-primary">{c.telefono}</a>
                  </div>
                )}
                {(c.citta || c.paese) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{[c.citta, c.paese].filter(Boolean).join(", ")}</span>
                  </div>
                )}
              </div>

              {c.note && (
                <div className="mt-3 rounded-md bg-background/60 p-2 text-[11px] text-muted-foreground line-clamp-2">
                  {c.note}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                <div className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.totale_transazioni}</span> transazioni
                  {Number(c.totale_speso) > 0 && (
                    <> · <span className="font-semibold text-foreground">{formatEUR(Number(c.totale_speso))}</span></>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(c)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => setToDelete(c)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica contatto" : "Nuovo contatto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome *">
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Mario Rossi" />
            </Field>
            <Field label="Tipo">
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as Tipo })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPI.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Piattaforma">
              <Select value={form.piattaforma || "_none"} onValueChange={(v) => setForm({ ...form, piattaforma: v === "_none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nessuna</SelectItem>
                  {PLATFORM_LIST.map((p) => <SelectItem key={p.key} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Username">
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="mario_rossi" />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Telefono">
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </Field>
            <Field label="Città">
              <Input value={form.citta} onChange={(e) => setForm({ ...form, citta: e.target.value })} />
            </Field>
            <Field label="Paese">
              <Input value={form.paese} onChange={(e) => setForm({ ...form, paese: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Note">
                <Textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Annotazioni, preferenze, storico…" />
              </Field>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                id="fav" type="checkbox" checked={form.preferito}
                onChange={(e) => setForm({ ...form, preferito: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              <Label htmlFor="fav" className="text-sm">Aggiungi ai preferiti</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? "Salvataggio…" : editing ? "Salva modifiche" : "Crea contatto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il contatto?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare <strong>{toDelete?.nome}</strong>. L'azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMut.mutate(toDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="border-border bg-card p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
    </Card>
  );
}
