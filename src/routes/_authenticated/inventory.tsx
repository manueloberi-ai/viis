import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ChangeEvent, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Euro, ImageIcon, PackagePlus, Pencil, Save, Search, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

const requiredString = (label: string) =>
  z.string().trim().min(1, `${label} è obbligatorio`).max(200, `${label} troppo lungo (max 200)`);
const requiredNumber = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} è obbligatorio`)
    .refine((v) => {
      const n = Number(v.replace(",", "."));
      return Number.isFinite(n);
    }, `${label} deve essere un numero valido`)
    .refine((v) => Number(v.replace(",", ".")) >= 0, `${label} non può essere negativo`);
const requiredDate = (label: string) =>
  z
    .string()
    .min(1, `${label} è obbligatorio`)
    .refine((v) => !Number.isNaN(new Date(v).getTime()), `${label} non è una data valida`);

const checkedSchema = z.object({
  stato_prodotto: requiredString("Stato prodotto"),
  nome_oggetto: requiredString("Nome oggetto"),
  categoria_prodotto: requiredString("Categoria"),
  data_vendita: requiredDate("Data vendita"),
  prezzo_vendita_valore: requiredNumber("Prezzo vendita"),
  spedizione: requiredString("Spedizione"),
  costo_spedizione: requiredNumber("Costo spedizione"),
  destinazione: requiredString("Destinazione"),
  tasse: requiredNumber("Tasse"),
  mese_vendita: requiredString("Mese vendita"),
});

type CheckedErrors = Partial<Record<(typeof CHECKED_KEYS)[number], string>>;

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { eur } from "@/lib/format";
import { PLATFORM_LIST } from "@/lib/platforms";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
});

type InventoryItem = Tables<"inventory_items">;
type TemplateRow = Tables<"inventory_template_fields">;

type FormState = {
  posizione_inventario: string;
  stato_prodotto: string;
  nome_oggetto: string;
  data_acquisto: string;
  fonte_acquisto: string;
  costo_acquisto: string;
  categoria_prodotto: string;
  note: string;
  data_vendita: string;
  prezzo_vendita_valore: string;
  piattaforma_vendita: string;
  spedizione: string;
  costo_spedizione: string;
  codice_tracciamento: string;
  destinazione: string;
  tasse: string;
  profitto: string;
  margine_profitto: string;
  mese_acquisto: string;
  mese_vendita: string;
  ricavi_netti: string;
  soldi_persi: string;
  titolo: string;
  descrizione: string;
  foto_url: string;
};

const STATO_OPTIONS = [
  "Acquisto monitorato",
  "Acquisto ritirato",
  "Acquisto reso",
  "Venduto spedito",
  "Venduto consegnato",
  "Venduto reso",
] as const;

const CATEGORIA_OPTIONS = [
  "Videogiochi",
  "Console",
  "Carte collezionabili",
  "Accessori",
  "Altro",
] as const;

const DESTINAZIONE_OPTIONS = ["Italia", "UE", "Extra UE", "Ritiro a mano"] as const;
const SPEDIZIONE_OPTIONS = ["Posta 1", "Piego di libri", "Corriere", "Locker", "Ritiro"] as const;
const CHECKED_KEYS = [
  "stato_prodotto",
  "nome_oggetto",
  "categoria_prodotto",
  "data_vendita",
  "prezzo_vendita_valore",
  "spedizione",
  "costo_spedizione",
  "destinazione",
  "tasse",
  "mese_vendita",
] as const;

const CHECKED_LABELS: Record<(typeof CHECKED_KEYS)[number], string> = {
  stato_prodotto: "Stato prodotto",
  nome_oggetto: "Nome oggetto",
  categoria_prodotto: "Categoria",
  data_vendita: "Data vendita",
  prezzo_vendita_valore: "Prezzo vendita",
  spedizione: "Spedizione",
  costo_spedizione: "Costo spedizione",
  destinazione: "Destinazione",
  tasse: "Tasse",
  mese_vendita: "Mese vendita",
};

const emptyForm: FormState = {
  posizione_inventario: "",
  stato_prodotto: "Acquisto monitorato",
  nome_oggetto: "",
  data_acquisto: "",
  fonte_acquisto: "",
  costo_acquisto: "",
  categoria_prodotto: "",
  note: "",
  data_vendita: "",
  prezzo_vendita_valore: "",
  piattaforma_vendita: "",
  spedizione: "",
  costo_spedizione: "",
  codice_tracciamento: "",
  destinazione: "",
  tasse: "",
  profitto: "",
  margine_profitto: "",
  mese_acquisto: "",
  mese_vendita: "",
  ricavi_netti: "",
  soldi_persi: "",
  titolo: "",
  descrizione: "",
  foto_url: "",
};

function InventoryPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<CheckedErrors>({});

  const inventoryQuery = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InventoryItem[];
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["inventory-template-fields"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_template_fields")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TemplateRow[];
    },
  });

  const filteredItems = useMemo(() => {
    const items = inventoryQuery.data ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [
        item.nome_oggetto,
        item.stato_prodotto,
        item.posizione_inventario,
        item.piattaforma_vendita,
        item.destinazione,
        item.codice_tracciamento,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(needle)),
    );
  }, [inventoryQuery.data, query]);


  const totals = useMemo(() => {
    const items = inventoryQuery.data ?? [];
    return items.reduce(
      (acc, item) => {
        acc.costo += Number(item.costo_acquisto ?? 0);
        acc.ricavi += Number(item.prezzo_vendita_valore ?? 0);
        acc.profitto += Number(item.profitto ?? 0);
        return acc;
      },
      { costo: 0, ricavi: 0, profitto: 0 },
    );
  }, [inventoryQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) throw new Error("Sessione non trovata");

      const itemPayload = buildItemPayload(payload, user.id);
      const itemResult = editing
        ? await supabase
            .from("inventory_items")
            .update(itemPayload)
            .eq("id", editing.id)
            .select()
            .single()
        : await supabase.from("inventory_items").insert(itemPayload).select().single();

      if (itemResult.error) throw itemResult.error;

      const checkedPayload = buildTemplatePayload(payload, user.id, itemResult.data.id);
      // Upsert by inventory_item_id so the unique constraint handles both insert and update
      // without depending on potentially stale cached template rows.
      const { error: tplError } = await supabase
        .from("inventory_template_fields")
        .upsert(checkedPayload, { onConflict: "inventory_item_id" });
      if (tplError) throw tplError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-template-fields"] });
      toast.success(editing ? "Articolo aggiornato" : "Articolo creato");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setErrors({});
    },
    onError: (error: Error) => {
      toast.error("Salvataggio non riuscito", { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: InventoryItem) => {
      const { error } = await supabase.from("inventory_items").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-template-fields"] });
      toast.success("Articolo eliminato");
    },
    onError: (error: Error) => {
      toast.error("Eliminazione non riuscita", { description: error.message });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setForm(formFromItem(item));
    setErrors({});
    setOpen(true);
  };

  const applyTemplate = (template: TemplateRow) => {
    setForm((prev) => ({
      ...prev,
      stato_prodotto: template.stato_prodotto ?? prev.stato_prodotto,
      nome_oggetto: template.nome_oggetto ?? prev.nome_oggetto,
      categoria_prodotto: template.categoria_prodotto ?? prev.categoria_prodotto,
      data_vendita: template.data_vendita ?? prev.data_vendita,
      prezzo_vendita_valore: stringifyNumber(template.prezzo_vendita),
      spedizione: template.spedizione ?? prev.spedizione,
      costo_spedizione: stringifyNumber(template.costo_spedizione),
      destinazione: template.destinazione ?? prev.destinazione,
      tasse: stringifyNumber(template.tasse),
      mese_vendita: template.mese_vendita ?? prev.mese_vendita,
    }));
    setErrors({});
    setOpen(true);
    toast.success("Campi spuntati applicati al form");
  };

  const handleSubmit = () => {
    const checkedValues = Object.fromEntries(
      CHECKED_KEYS.map((key) => [key, form[key]]),
    ) as Record<(typeof CHECKED_KEYS)[number], string>;
    const result = checkedSchema.safeParse(checkedValues);
    if (!result.success) {
      const fieldErrors: CheckedErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as (typeof CHECKED_KEYS)[number] | undefined;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Controlla i campi obbligatori (spunta V)", {
        description: `${Object.keys(fieldErrors).length} campo/i da correggere`,
      });
      return;
    }
    setErrors({});
    saveMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            Tabella operativa basata sui campi letti dallo sketch 005217, con salvataggio dedicato dei campi spuntati.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-[280px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per oggetto, stato, tracking..."
              className="h-10 pl-9"
            />
          </div>
          <Button onClick={openCreate} className="h-10">
            <PackagePlus className="h-4 w-4" />
            Nuovo articolo
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={<Boxes className="h-4 w-4" />} label="Righe inventario" value={String(inventoryQuery.data?.length ?? 0)} />
        <MetricCard icon={<Euro className="h-4 w-4" />} label="Costo acquisto" value={eur(totals.costo)} />
        <MetricCard icon={<Sparkles className="h-4 w-4" />} label="Ricavi vendita" value={eur(totals.ricavi)} />
        <MetricCard icon={<Save className="h-4 w-4" />} label="Profitto registrato" value={eur(totals.profitto)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="border-border bg-card p-0">
          <div className="border-b border-border px-5 py-4">
            <div className="text-sm font-semibold">Tabella inventario</div>
            <div className="text-xs text-muted-foreground">Solo campi dedotti dallo sketch, senza colonne aggiuntive inventate.</div>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[1480px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Posizione</TableHead>
                  <TableHead>Stato prodotto</TableHead>
                  <TableHead>Nome oggetto</TableHead>
                  <TableHead>Data acquisto</TableHead>
                  <TableHead>Fonte acquisto</TableHead>
                  <TableHead>Costo acquisto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Data vendita</TableHead>
                  <TableHead>Prezzo vendita</TableHead>
                  <TableHead>Piattaforma</TableHead>
                  <TableHead>Spedizione</TableHead>
                  <TableHead>Costo sped.</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Destinazione</TableHead>
                  <TableHead>Tasse</TableHead>
                  <TableHead>Profitto</TableHead>
                  <TableHead>Margine</TableHead>
                  <TableHead>Mese acquisto</TableHead>
                  <TableHead>Mese vendita</TableHead>
                  <TableHead>Ricavi netti</TableHead>
                  <TableHead>Soldi persi</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryQuery.isLoading
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <TableRow key={index}>
                        {Array.from({ length: 23 }).map((__, cell) => (
                          <TableCell key={cell}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.posizione_inventario ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-border bg-secondary/40">{item.stato_prodotto || "—"}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.nome_oggetto ?? "—"}</TableCell>
                        <TableCell>{formatDate(item.data_acquisto)}</TableCell>
                        <TableCell>{item.fonte_acquisto ?? "—"}</TableCell>
                        <TableCell className="num">{eur(item.costo_acquisto)}</TableCell>
                        <TableCell>{item.categoria_prodotto ?? "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.note ?? "—"}</TableCell>
                        <TableCell>{formatDate(item.data_vendita)}</TableCell>
                        <TableCell className="num">{eur(item.prezzo_vendita_valore)}</TableCell>
                        <TableCell>{item.piattaforma_vendita ?? "—"}</TableCell>
                        <TableCell>{item.spedizione ?? "—"}</TableCell>
                        <TableCell className="num">{eur(item.costo_spedizione)}</TableCell>
                        <TableCell>{item.codice_tracciamento ?? "—"}</TableCell>
                        <TableCell>{item.destinazione ?? "—"}</TableCell>
                        <TableCell className="num">{eur(item.tasse)}</TableCell>
                        <TableCell className="num">{eur(item.profitto)}</TableCell>
                        <TableCell>{formatPercent(item.margine_profitto)}</TableCell>
                        <TableCell>{item.mese_acquisto ?? "—"}</TableCell>
                        <TableCell>{item.mese_vendita ?? "—"}</TableCell>
                        <TableCell className="num">{eur(item.ricavi_netti)}</TableCell>
                        <TableCell className="num">{eur(item.soldi_persi)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Modifica">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(item)}
                              disabled={deleteMutation.isPending}
                              title="Elimina"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                {!inventoryQuery.isLoading && filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={23} className="py-12 text-center text-sm text-muted-foreground">
                      Nessun articolo trovato con questi filtri.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">Campi spuntati salvati</div>
              <div className="text-xs text-muted-foreground">Sezione apposita per riuso rapido nel prossimo prodotto.</div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {templatesQuery.isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            {!templatesQuery.isLoading && (templatesQuery.data?.length ?? 0) === 0 && (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Salverò qui i valori con la spunta a V dopo il primo inserimento.
              </div>
            )}
            {templatesQuery.data?.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
                className="w-full rounded-lg border border-border bg-background/40 p-4 text-left transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{template.nome_oggetto || "Template senza nome"}</div>
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Riusa</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {CHECKED_KEYS.map((key) => {
                    const value = readTemplateValue(template, key);
                    if (!value) return null;
                    return (
                      <span key={key} className="rounded-md border border-border px-2 py-1">
                        {CHECKED_LABELS[key]}: {value}
                      </span>
                    );
                  })}
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto border-border bg-card">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica articolo" : "Nuovo articolo"}</DialogTitle>
            <DialogDescription>
              Form costruito dai campi leggibili nello sketch 005217. I campi con spunta a V vengono anche salvati nella sezione riutilizzabile.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Posizione inventario"><Input value={form.posizione_inventario} onChange={bind(setForm, "posizione_inventario")} /></Field>
            <Field label="Stato prodotto" error={errors.stato_prodotto}>
              <Select value={form.stato_prodotto} onValueChange={(value) => setForm((prev) => ({ ...prev, stato_prodotto: value }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona stato" /></SelectTrigger>
                <SelectContent>
                  {STATO_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nome oggetto" error={errors.nome_oggetto}><Input value={form.nome_oggetto} onChange={bind(setForm, "nome_oggetto")} /></Field>
            <Field label="Data acquisto"><Input type="date" value={form.data_acquisto} onChange={bind(setForm, "data_acquisto")} /></Field>
            <Field label="Fonte acquisto"><Input value={form.fonte_acquisto} onChange={bind(setForm, "fonte_acquisto")} /></Field>
            <Field label="Costo acquisto"><Input inputMode="decimal" value={form.costo_acquisto} onChange={bind(setForm, "costo_acquisto")} /></Field>
            <Field label="Categoria" error={errors.categoria_prodotto}>
              <Select value={form.categoria_prodotto} onValueChange={(value) => setForm((prev) => ({ ...prev, categoria_prodotto: value }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIA_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Note"><Textarea value={form.note} onChange={bind(setForm, "note")} className="min-h-9" /></Field>
            <Field label="Data vendita" error={errors.data_vendita}><Input type="date" value={form.data_vendita} onChange={bind(setForm, "data_vendita")} /></Field>
            <Field label="Prezzo vendita" error={errors.prezzo_vendita_valore}><Input inputMode="decimal" value={form.prezzo_vendita_valore} onChange={bind(setForm, "prezzo_vendita_valore")} /></Field>
            <Field label="Piattaforma vendita">
              <Select value={form.piattaforma_vendita} onValueChange={(value) => setForm((prev) => ({ ...prev, piattaforma_vendita: value }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona piattaforma" /></SelectTrigger>
                <SelectContent>
                  {PLATFORM_LIST.map((platform) => <SelectItem key={platform.key} value={platform.name}>{platform.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Spedizione" error={errors.spedizione}>
              <Select value={form.spedizione} onValueChange={(value) => setForm((prev) => ({ ...prev, spedizione: value }))}>
                <SelectTrigger><SelectValue placeholder="Metodo spedizione" /></SelectTrigger>
                <SelectContent>
                  {SPEDIZIONE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Costo spedizione" error={errors.costo_spedizione}><Input inputMode="decimal" value={form.costo_spedizione} onChange={bind(setForm, "costo_spedizione")} /></Field>
            <Field label="Codice tracciamento"><Input value={form.codice_tracciamento} onChange={bind(setForm, "codice_tracciamento")} /></Field>
            <Field label="Destinazione" error={errors.destinazione}>
              <Select value={form.destinazione} onValueChange={(value) => setForm((prev) => ({ ...prev, destinazione: value }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona destinazione" /></SelectTrigger>
                <SelectContent>
                  {DESTINAZIONE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tasse" error={errors.tasse}><Input inputMode="decimal" value={form.tasse} onChange={bind(setForm, "tasse")} /></Field>
            <Field label="Profitto"><Input inputMode="decimal" value={form.profitto} onChange={bind(setForm, "profitto")} /></Field>
            <Field label="Margine profitto"><Input inputMode="decimal" value={form.margine_profitto} onChange={bind(setForm, "margine_profitto")} /></Field>
            <Field label="Mese acquisto"><Input value={form.mese_acquisto} onChange={bind(setForm, "mese_acquisto")} /></Field>
            <Field label="Mese vendita" error={errors.mese_vendita}><Input value={form.mese_vendita} onChange={bind(setForm, "mese_vendita")} /></Field>
            <Field label="Ricavi netti"><Input inputMode="decimal" value={form.ricavi_netti} onChange={bind(setForm, "ricavi_netti")} /></Field>
            <Field label="Soldi persi"><Input inputMode="decimal" value={form.soldi_persi} onChange={bind(setForm, "soldi_persi")} /></Field>
          </div>

          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="text-sm font-semibold text-primary">Campi con spunta a V</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {CHECKED_KEYS.map((key) => (
                <span key={key} className="rounded-md border border-primary/20 px-2 py-1">
                  {CHECKED_LABELS[key]}
                </span>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Salvataggio..." : "Salva articolo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card className="border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      </div>
      <div className="mt-3 text-2xl font-semibold num">{value}</div>
    </Card>
  );
}

function Field({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  const checked = Object.values(CHECKED_LABELS).includes(label);
  return (
    <label className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>{label}</span>
        {checked && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">V</span>}
      </div>
      <div className={error ? "[&_input]:border-destructive [&_button[role=combobox]]:border-destructive [&_textarea]:border-destructive" : undefined}>
        {children}
      </div>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </label>
  );
}

function formFromItem(item: InventoryItem): FormState {
  return {
    posizione_inventario: item.posizione_inventario ?? "",
    stato_prodotto: item.stato_prodotto ?? "Acquisto monitorato",
    nome_oggetto: item.nome_oggetto ?? "",
    data_acquisto: item.data_acquisto ?? "",
    fonte_acquisto: item.fonte_acquisto ?? "",
    costo_acquisto: stringifyNumber(item.costo_acquisto),
    categoria_prodotto: item.categoria_prodotto ?? "",
    note: item.note ?? "",
    data_vendita: item.data_vendita ?? "",
    prezzo_vendita_valore: stringifyNumber(item.prezzo_vendita_valore),
    piattaforma_vendita: item.piattaforma_vendita ?? "",
    spedizione: item.spedizione ?? "",
    costo_spedizione: stringifyNumber(item.costo_spedizione),
    codice_tracciamento: item.codice_tracciamento ?? "",
    destinazione: item.destinazione ?? "",
    tasse: stringifyNumber(item.tasse),
    profitto: stringifyNumber(item.profitto),
    margine_profitto: stringifyNumber(item.margine_profitto),
    mese_acquisto: item.mese_acquisto ?? "",
    mese_vendita: item.mese_vendita ?? "",
    ricavi_netti: stringifyNumber(item.ricavi_netti),
    soldi_persi: stringifyNumber(item.soldi_persi),
  };
}

function buildItemPayload(form: FormState, userId: string): TablesInsert<"inventory_items"> {
  return {
    user_id: userId,
    posizione_inventario: emptyToNull(form.posizione_inventario),
    stato_prodotto: form.stato_prodotto,
    nome_oggetto: emptyToNull(form.nome_oggetto),
    data_acquisto: emptyToNull(form.data_acquisto),
    fonte_acquisto: emptyToNull(form.fonte_acquisto),
    costo_acquisto: numberOrNull(form.costo_acquisto),
    categoria_prodotto: emptyToNull(form.categoria_prodotto),
    note: emptyToNull(form.note),
    data_vendita: emptyToNull(form.data_vendita),
    prezzo_vendita_valore: numberOrNull(form.prezzo_vendita_valore),
    piattaforma_vendita: emptyToNull(form.piattaforma_vendita),
    spedizione: emptyToNull(form.spedizione),
    costo_spedizione: numberOrNull(form.costo_spedizione),
    codice_tracciamento: emptyToNull(form.codice_tracciamento),
    destinazione: emptyToNull(form.destinazione),
    tasse: numberOrNull(form.tasse),
    profitto: numberOrNull(form.profitto),
    margine_profitto: numberOrNull(form.margine_profitto),
    mese_acquisto: emptyToNull(form.mese_acquisto),
    mese_vendita: emptyToNull(form.mese_vendita),
    ricavi_netti: numberOrNull(form.ricavi_netti),
    soldi_persi: numberOrNull(form.soldi_persi),
    campi_spuntati: buildCheckedJson(form),
  };
}

function buildTemplatePayload(form: FormState, userId: string, inventoryItemId: string) {
  return {
    user_id: userId,
    inventory_item_id: inventoryItemId,
    stato_prodotto: emptyToNull(form.stato_prodotto),
    nome_oggetto: emptyToNull(form.nome_oggetto),
    categoria_prodotto: emptyToNull(form.categoria_prodotto),
    data_vendita: emptyToNull(form.data_vendita),
    prezzo_vendita: numberOrNull(form.prezzo_vendita_valore),
    spedizione: emptyToNull(form.spedizione),
    costo_spedizione: numberOrNull(form.costo_spedizione),
    destinazione: emptyToNull(form.destinazione),
    tasse: numberOrNull(form.tasse),
    mese_vendita: emptyToNull(form.mese_vendita),
  };
}

function buildCheckedJson(form: FormState) {
  const numericKeys = new Set(["prezzo_vendita_valore", "costo_spedizione", "tasse"]);
  const entries = CHECKED_KEYS.map((key) => [
    key,
    numericKeys.has(key) ? numberOrNull(form[key]) : emptyToNull(form[key]),
  ]);
  return Object.fromEntries(entries.filter(([, value]) => value !== null));
}

function bind(setter: Dispatch<SetStateAction<FormState>>, key: keyof FormState) {
  return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setter((prev) => ({ ...prev, [key]: value }));
  };
}


function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringifyNumber(value: number | null) {
  return value == null ? "" : String(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT").format(new Date(value));
}

function formatPercent(value: number | null) {
  return value == null ? "—" : `${value}%`;
}

function readTemplateValue(template: TemplateRow, key: (typeof CHECKED_KEYS)[number]) {
  const map = {
    stato_prodotto: template.stato_prodotto,
    nome_oggetto: template.nome_oggetto,
    categoria_prodotto: template.categoria_prodotto,
    data_vendita: template.data_vendita,
    prezzo_vendita_valore: stringifyNumber(template.prezzo_vendita),
    spedizione: template.spedizione,
    costo_spedizione: stringifyNumber(template.costo_spedizione),
    destinazione: template.destinazione,
    tasse: stringifyNumber(template.tasse),
    mese_vendita: template.mese_vendita,
  } as const;
  return map[key];
}
