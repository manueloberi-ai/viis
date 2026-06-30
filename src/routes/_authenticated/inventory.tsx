import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Euro, History, ImageIcon, PackagePlus, Pencil, Save, Search, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { recordRlsEvent, isRlsError } from "@/lib/rls-events";
import { format as formatDateFn } from "date-fns";
import { it as itLocale } from "date-fns/locale";

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

type PlatformMap = Record<string, string>;

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
  titolo: string;
  descrizione: string;
  foto_url: string;
  titoli_piattaforma: PlatformMap;
  descrizioni_piattaforma: PlatformMap;
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

const DESTINAZIONE_OPTIONS = [
  "Italia",
  "UE",
  "Europa Continentale",
  "Extra UE",
  "Asia",
  "America Latina",
  "Oceania",
] as const;
const SPEDIZIONE_OPTIONS = [
  "Poste Italiane",
  "InPost (Mondial Relay estero)",
  "BRT (DPD estero)",
  "UPS",
  "DHL",
  "FedEx",
  "GLS",
  "TNT",
  "SDA",
] as const;
const FONTE_ACQUISTO_OPTIONS = [
  "Vinted",
  "eBay",
  "Wallapop",
  "Subito",
  "Cardmarket",
  "Facebook Marketplace",
  "WhatsApp",
  "Cex",
  "Gamelife",
  "Mercatino",
  "Fiere",
  "Transazione privata",
  "Scambio a mano",
  "Amici e parenti",
  "Gruppi",
  "Discord",
  "Altro",
] as const;
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
  titolo: "",
  descrizione: "",
  foto_url: "",
  titoli_piattaforma: {},
  descrizioni_piattaforma: {},
};

const MESI_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
function computeMeseVendita(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return `${MESI_IT[d.getMonth()]} ${d.getFullYear()}`;
}
function parseNum(v: string): number | null {
  const n = Number(String(v ?? "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}
function computeProfit(form: Pick<FormState, "prezzo_vendita_valore" | "costo_acquisto" | "costo_spedizione" | "tasse">) {
  const sale = parseNum(form.prezzo_vendita_valore);
  const cost = parseNum(form.costo_acquisto);
  if (sale == null || cost == null) return { profitto: "", margine_profitto: "" };
  const ship = parseNum(form.costo_spedizione) ?? 0;
  const tax = parseNum(form.tasse) ?? 0;
  const profit = sale - cost - ship - tax;
  const margin = sale > 0 ? (profit / sale) * 100 : 0;
  return {
    profitto: profit.toFixed(2),
    margine_profitto: margin.toFixed(2),
  };
}

function InventoryPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<CheckedErrors>({});

  // Auto-compute profitto, margine, mese_acquisto, mese_vendita
  useEffect(() => {
    setForm((prev) => {
      const next = { ...prev };
      const { profitto, margine_profitto } = computeProfit(prev);
      const meseA = prev.data_acquisto ? computeMeseVendita(prev.data_acquisto) : "";
      const meseV = prev.data_vendita ? computeMeseVendita(prev.data_vendita) : "";
      let changed = false;
      if (profitto !== prev.profitto) { next.profitto = profitto; changed = true; }
      if (margine_profitto !== prev.margine_profitto) { next.margine_profitto = margine_profitto; changed = true; }
      if (meseA !== prev.mese_acquisto) { next.mese_acquisto = meseA; changed = true; }
      if (meseV && meseV !== prev.mese_vendita) { next.mese_vendita = meseV; changed = true; }
      return changed ? next : prev;
    });
  }, [form.prezzo_vendita_valore, form.costo_acquisto, form.costo_spedizione, form.tasse, form.data_acquisto, form.data_vendita]);


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
    onError: (error: unknown) => {
      const err = error as { message?: string; code?: string; details?: string; hint?: string };
      console.error("[inventory] save failed", err);
      if (isRlsError(err)) {
        recordRlsEvent({
          table: "inventory_items",
          action: editing ? "UPDATE" : "INSERT",
          itemId: editing?.id ?? null,
          itemLabel: form.nome_oggetto || null,
          message: err.message ?? "RLS",
        });
        toast.error("Operazione bloccata: non sei il proprietario di questo articolo", {
          description: "Puoi creare e modificare solo i prodotti del tuo account. L'evento è stato salvato nel Log Attività.",
        });
        return;
      }
      const desc = [err.message, err.code, err.details, err.hint].filter(Boolean).join(" · ");
      toast.error("Salvataggio non riuscito", { description: desc || "Errore sconosciuto" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: InventoryItem) => {
      const { error } = await supabase.from("inventory_items").delete().eq("id", item.id);
      if (error) throw error;
      return item;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-template-fields"] });
      toast.success("Articolo eliminato");
    },
    onError: (error: Error & { code?: string }, item) => {
      if (isRlsError(error)) {
        recordRlsEvent({
          table: "inventory_items",
          action: "DELETE",
          itemId: item.id,
          itemLabel: item.nome_oggetto ?? null,
          message: error.message,
        });
        toast.error("Eliminazione bloccata: l'articolo non ti appartiene", {
          description: "Puoi eliminare solo i tuoi prodotti. L'evento è stato salvato nel Log Attività.",
        });
        return;
      }
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
      // Focus the first checked field that errored
      const firstKey = CHECKED_KEYS.find((k) => fieldErrors[k]);
      if (firstKey) {
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLElement>(`[data-field="${firstKey}"] input, [data-field="${firstKey}"] textarea, [data-field="${firstKey}"] button[role="combobox"]`);
          el?.focus();
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
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
          <p className="text-sm text-muted-foreground">Gestisci articoli, vendite e dati operativi.</p>
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
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[1480px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[72px]">Foto</TableHead>
                  <TableHead>Titolo</TableHead>
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
                        <TableCell>
                          <PhotoThumb url={item.foto_url} />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{item.titolo || item.nome_oggetto || "—"}</TableCell>
                        <TableCell>{item.posizione_inventario ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-border bg-secondary/40">{item.stato_prodotto || "—"}</Badge>
                        </TableCell>
                        <TableCell>{item.nome_oggetto ?? "—"}</TableCell>
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
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <ItemHistoryButton item={item} />
                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Modifica" aria-label="Modifica articolo">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(item)}
                              disabled={deleteMutation.isPending}
                              title="Elimina"
                              aria-label="Elimina articolo"
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

          <fieldset disabled={saveMutation.isPending} className="contents">
          {/* Sezione Annuncio (per modulo Pubblicatore) */}
          <div className="rounded-lg border border-border bg-background/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <div>
                <div className="text-sm font-semibold">Annuncio marketplace</div>
                <div className="text-xs text-muted-foreground">Dati ottimizzati per il futuro modulo Pubblicatore.</div>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-[200px_minmax(0,1fr)]">
              <PhotoUploadField
                value={form.foto_url}
                onChange={(value) => setForm((prev) => ({ ...prev, foto_url: value }))}
              />
              <div className="space-y-4">
                <PlatformTextField
                  label="Titolo annuncio"
                  multiline={false}
                  base={form.titolo}
                  byPlatform={form.titoli_piattaforma}
                  onBaseChange={(v) => setForm((prev) => ({ ...prev, titolo: v }))}
                  onPlatformChange={(key, v) =>
                    setForm((prev) => ({
                      ...prev,
                      titoli_piattaforma: { ...prev.titoli_piattaforma, [key]: v },
                    }))
                  }
                  placeholder="Es. Pokémon Smeraldo GBA originale ITA"
                />
                <PlatformTextField
                  label="Descrizione annuncio"
                  multiline
                  base={form.descrizione}
                  byPlatform={form.descrizioni_piattaforma}
                  onBaseChange={(v) => setForm((prev) => ({ ...prev, descrizione: v }))}
                  onPlatformChange={(key, v) =>
                    setForm((prev) => ({
                      ...prev,
                      descrizioni_piattaforma: { ...prev.descrizioni_piattaforma, [key]: v },
                    }))
                  }
                  placeholder="Descrizione completa, condizioni, accessori inclusi, modalità di spedizione…"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Posizione inventario"><Input value={form.posizione_inventario} onChange={bind(setForm, "posizione_inventario")} /></Field>
            <Field label="Stato prodotto" error={errors.stato_prodotto} fieldKey="stato_prodotto">
              <Select value={form.stato_prodotto} onValueChange={(value) => setForm((prev) => ({ ...prev, stato_prodotto: value }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona stato" /></SelectTrigger>
                <SelectContent>
                  {STATO_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nome oggetto" error={errors.nome_oggetto} fieldKey="nome_oggetto"><Input value={form.nome_oggetto} onChange={bind(setForm, "nome_oggetto")} /></Field>
            <Field label="Data acquisto"><Input type="date" value={form.data_acquisto} onChange={bind(setForm, "data_acquisto")} /></Field>
            <Field label="Fonte acquisto">
              <Select value={form.fonte_acquisto} onValueChange={(value) => setForm((prev) => ({ ...prev, fonte_acquisto: value }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona fonte" /></SelectTrigger>
                <SelectContent>
                  {FONTE_ACQUISTO_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Costo acquisto"><Input inputMode="decimal" value={form.costo_acquisto} onChange={bind(setForm, "costo_acquisto")} /></Field>
            <Field label="Categoria" error={errors.categoria_prodotto} fieldKey="categoria_prodotto">
              <Select value={form.categoria_prodotto} onValueChange={(value) => setForm((prev) => ({ ...prev, categoria_prodotto: value }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIA_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Note"><Textarea value={form.note} onChange={bind(setForm, "note")} className="min-h-9" /></Field>
            <Field label="Data vendita" error={errors.data_vendita} fieldKey="data_vendita">
              <Input
                type="date"
                value={form.data_vendita}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    data_vendita: v,
                    mese_vendita: v ? computeMeseVendita(v) : "",
                  }));
                }}
              />
            </Field>
            <Field label="Prezzo vendita" error={errors.prezzo_vendita_valore} fieldKey="prezzo_vendita_valore"><Input inputMode="decimal" value={form.prezzo_vendita_valore} onChange={bind(setForm, "prezzo_vendita_valore")} /></Field>
            <Field label="Piattaforma vendita">
              <Select value={form.piattaforma_vendita} onValueChange={(value) => setForm((prev) => ({ ...prev, piattaforma_vendita: value }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona piattaforma" /></SelectTrigger>
                <SelectContent>
                  {PLATFORM_LIST.map((platform) => <SelectItem key={platform.key} value={platform.name}>{platform.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Spedizione" error={errors.spedizione} fieldKey="spedizione">
              <Select value={form.spedizione} onValueChange={(value) => setForm((prev) => ({ ...prev, spedizione: value }))}>
                <SelectTrigger><SelectValue placeholder="Metodo spedizione" /></SelectTrigger>
                <SelectContent>
                  {SPEDIZIONE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Costo spedizione" error={errors.costo_spedizione} fieldKey="costo_spedizione"><Input inputMode="decimal" value={form.costo_spedizione} onChange={bind(setForm, "costo_spedizione")} /></Field>
            <Field label="Codice tracciamento"><Input value={form.codice_tracciamento} onChange={bind(setForm, "codice_tracciamento")} /></Field>
            <Field label="Destinazione" error={errors.destinazione} fieldKey="destinazione">
              <Select value={form.destinazione} onValueChange={(value) => setForm((prev) => ({ ...prev, destinazione: value }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona destinazione" /></SelectTrigger>
                <SelectContent>
                  {DESTINAZIONE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tasse" error={errors.tasse} fieldKey="tasse"><Input inputMode="decimal" value={form.tasse} onChange={bind(setForm, "tasse")} /></Field>
            <Field label="Profitto">
              <Input inputMode="decimal" value={form.profitto} readOnly placeholder="Prezzo − Costo − Sped. − Tasse" />
              {form.profitto !== "" && (
                <div className={`mt-1 text-xs font-semibold ${Number(form.profitto) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {eur(Number(form.profitto))} · Margine {form.margine_profitto || "0"}%
                </div>
              )}
            </Field>
            <Field label="Margine profitto"><Input inputMode="decimal" value={form.margine_profitto} readOnly placeholder="%" /></Field>
            <Field label="Mese acquisto"><Input value={form.mese_acquisto} readOnly placeholder="Da Data acquisto" /></Field>
            <Field label="Mese vendita" error={errors.mese_vendita} fieldKey="mese_vendita"><Input value={form.mese_vendita} readOnly placeholder="Da Data vendita" /></Field>
          </div>

          </fieldset>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saveMutation.isPending}>Annulla</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Salvataggio..." : editing ? "Salva modifiche" : "Salva articolo"}
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

function Field({ label, children, error, fieldKey, hint }: { label: string; children: ReactNode; error?: string; fieldKey?: string; hint?: string }) {
  return (
    <label className="space-y-2" data-field={fieldKey}>
      <div className="flex items-center justify-between gap-2 text-sm font-medium">
        <span>{label}</span>
        {hint && <span className="text-[10px] font-normal text-muted-foreground">{hint}</span>}
      </div>
      <div className={error ? "[&_input]:border-destructive [&_button[role=combobox]]:border-destructive [&_textarea]:border-destructive" : undefined}>
        {children}
      </div>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </label>
  );
}

function FormColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function PlatformTextField({
  label,
  multiline,
  base,
  byPlatform,
  onBaseChange,
  onPlatformChange,
  placeholder,
}: {
  label: string;
  multiline: boolean;
  base: string;
  byPlatform: PlatformMap;
  onBaseChange: (v: string) => void;
  onPlatformChange: (key: string, v: string) => void;
  placeholder?: string;
}) {
  const [target, setTarget] = useState<string>("default");
  const value = target === "default" ? base : (byPlatform[target] ?? "");
  const handleChange = (v: string) => {
    if (target === "default") onBaseChange(v);
    else onPlatformChange(target, v);
  };
  const limit = target !== "default" && PLATFORM_LIST.find((p) => p.key === target)?.titleLimit;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{label}</div>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default (tutte le piattaforme)</SelectItem>
            {PLATFORM_LIST.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.name} {!multiline && `· ${p.titleLimit}c`}
                {byPlatform[p.key] ? "  ✓" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="min-h-32"
          placeholder={placeholder}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {target !== "default" && (
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>
            Variante per <span className="font-semibold text-foreground">
              {PLATFORM_LIST.find((p) => p.key === target)?.name}
            </span> — vuoto = usa il default
          </span>
          {!multiline && limit && (
            <span
              className={
                value.length > limit ? "text-rose-400 font-semibold tabular-nums" : "tabular-nums"
              }
            >
              {value.length}/{limit}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const INVENTORY_PHOTO_BUCKET = "ad-photos";
const isHttp = (s: string) => /^https?:\/\//i.test(s);

function useResolvedPhotoUrl(value: string | null): string | null {
  const [resolved, setResolved] = useState<string | null>(value && isHttp(value) ? value : null);
  useEffect(() => {
    let alive = true;
    if (!value) { setResolved(null); return; }
    if (isHttp(value)) { setResolved(value); return; }
    supabase.storage.from(INVENTORY_PHOTO_BUCKET).createSignedUrl(value, 60 * 60 * 8).then(({ data }) => {
      if (alive) setResolved(data?.signedUrl ?? null);
    });
    return () => { alive = false; };
  }, [value]);
  return resolved;
}

function PhotoThumb({ url }: { url: string | null }) {
  const resolved = useResolvedPhotoUrl(url);
  if (!resolved) {
    return (
      <div className="grid h-12 w-12 place-items-center rounded-lg bg-muted text-muted-foreground/60">
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }
  return (
    <img
      src={resolved}
      alt=""
      className="h-12 w-12 rounded-lg border border-border object-cover"
      onError={(e) => {
        const el = e.currentTarget as HTMLImageElement;
        el.replaceWith(Object.assign(document.createElement("div"), { className: "grid h-12 w-12 place-items-center rounded-lg bg-muted text-muted-foreground/60", innerHTML: "" }));
      }}
    />
  );
}

function PhotoUploadField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const resolved = useResolvedPhotoUrl(value || null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Utente non autenticato");
      if (file.size > 10 * 1024 * 1024) throw new Error("Max 10MB");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${u.user.id}/inventory/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(INVENTORY_PHOTO_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      onChange(path);
      toast.success("Foto caricata");
    } catch (e) {
      toast.error("Upload fallito", { description: e instanceof Error ? e.message : "Errore" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Foto principale</div>
      <div
        className="group relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-background/40 transition-colors hover:border-primary/50 hover:bg-primary/5"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
      >
        {resolved ? (
          <img src={resolved} alt="Anteprima" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center text-xs text-muted-foreground">
            <UploadCloud className="h-6 w-6 text-muted-foreground/70" />
            <div className="font-medium text-foreground">{uploading ? "Caricamento…" : "Carica o trascina foto"}</div>
            <div>JPG, PNG, WebP — max 10MB</div>
          </div>
        )}
        {uploading && <div className="absolute inset-0 grid place-items-center bg-background/60 text-xs">Caricamento…</div>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <UploadCloud className="mr-2 h-4 w-4" /> Carica file
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            <Trash2 className="mr-2 h-4 w-4" /> Rimuovi
          </Button>
        )}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…oppure incolla un URL https://…"
        inputMode="url"
      />
    </div>
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
    mese_vendita: item.mese_vendita ?? (item.data_vendita ? computeMeseVendita(item.data_vendita) : ""),
    titolo: item.titolo ?? "",
    descrizione: item.descrizione ?? "",
    foto_url: item.foto_url ?? "",
    titoli_piattaforma: readPlatformMap(item.titoli_piattaforma),
    descrizioni_piattaforma: readPlatformMap(item.descrizioni_piattaforma),
  };
}

function readPlatformMap(v: unknown): PlatformMap {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const out: PlatformMap = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "string") out[k] = val;
    }
    return out;
  }
  return {};
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
    campi_spuntati: buildCheckedJson(form),
    titolo: emptyToNull(form.titolo),
    descrizione: emptyToNull(form.descrizione),
    foto_url: emptyToNull(form.foto_url),
    titoli_piattaforma: form.titoli_piattaforma,
    descrizioni_piattaforma: form.descrizioni_piattaforma,
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

// ------------------------------------------------------------------
// Per-item history dialog (uses inventory_audit_log)
// ------------------------------------------------------------------
function ItemHistoryButton({ item }: { item: InventoryItem }) {
  const [open, setOpen] = useState(false);
  const historyQuery = useQuery({
    queryKey: ["item-history", item.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_audit_log")
        .select("id, action, changed_fields, created_at")
        .eq("inventory_item_id", item.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const actionLabel: Record<string, string> = {
    INSERT: "Creazione",
    UPDATE: "Modifica",
    DELETE: "Eliminazione",
  };

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Storia modifiche" aria-label="Mostra storia modifiche">
        <History className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Storia di "{item.nome_oggetto ?? item.id.slice(0, 8)}"
            </DialogTitle>
            <DialogDescription>
              Tutte le modifiche tracciate per questo articolo.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {historyQuery.isLoading && (
              <div className="text-sm text-muted-foreground py-6 text-center">Caricamento…</div>
            )}
            {!historyQuery.isLoading && (historyQuery.data?.length ?? 0) === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">Nessuna attività registrata.</div>
            )}
            <ol className="relative border-l border-border ml-3 space-y-4 py-2">
              {(historyQuery.data ?? []).map((row) => {
                const changed = row.changed_fields as Record<string, unknown> | null;
                const keys = changed ? Object.keys(changed).filter((k) => k !== "updated_at") : [];
                return (
                  <li key={row.id} className="ml-4">
                    <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {actionLabel[row.action] ?? row.action}
                      </Badge>
                      <time className="text-xs text-muted-foreground">
                        {formatDateFn(new Date(row.created_at), "d MMM yyyy HH:mm:ss", { locale: itLocale })}
                      </time>
                    </div>
                    {row.action === "UPDATE" && keys.length > 0 && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Campi modificati: <span className="text-foreground">{keys.join(", ")}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
