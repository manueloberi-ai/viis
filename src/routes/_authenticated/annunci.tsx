import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Megaphone, Sparkles, UploadCloud, Wand2, Save, Plus, Copy, MessageSquareHeart,
} from "lucide-react";
import { toast } from "sonner";
import { PLATFORMS, PLATFORM_LIST, type PlatformKey } from "@/lib/platforms";
import { optimizeListing } from "@/lib/ai.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/annunci")({
  component: AnnunciPage,
});

type InventoryItem = Tables<"inventory_items">;
type PlatformMap = Record<string, string>;

function readMap(v: unknown): PlatformMap {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as PlatformMap;
  return {};
}

function AnnunciPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<PlatformKey>("ebay");
  const [titoli, setTitoli] = useState<PlatformMap>({});
  const [descrizioni, setDescrizioni] = useState<PlatformMap>({});
  const [foto, setFoto] = useState("");
  const [currentAdId, setCurrentAdId] = useState<string | null>(null);
  const [lastAi, setLastAi] = useState<{
    keywords: string[]; score: number; rationale: string; platform: PlatformKey;
  } | null>(null);

  const newAd = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Utente non autenticato");
      const { data, error } = await supabase
        .from("ads")
        .insert({
          user_id: u.user.id,
          inventory_id: selectedId,
          platform: PLATFORMS[platform].name,
          generated_title: "",
          generated_description: "",
          photos: [],
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      setCurrentAdId(id);
      qc.invalidateQueries({ queryKey: ["ads"] });
      toast.success("Nuovo annuncio creato");
    },
    onError: (e: Error) => toast.error("Creazione fallita", { description: e.message }),
  });

  const saveAd = useMutation({
    mutationFn: async () => {
      if (!currentAdId) throw new Error("Nessun annuncio attivo: clicca 'Nuovo annuncio'");
      const { error } = await supabase
        .from("ads")
        .update({
          platform: PLATFORMS[platform].name,
          inventory_id: selectedId,
          generated_title: titoli[platform] ?? "",
          generated_description: descrizioni[platform] ?? "",
          photos: foto ? [foto] : [],
        })
        .eq("id", currentAdId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads"] });
      toast.success("Annuncio aggiornato");
    },
    onError: (e: Error) => toast.error("Salvataggio annuncio fallito", { description: e.message }),
  });

  const itemsQuery = useQuery({
    queryKey: ["inventory-items-annunci"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InventoryItem[];
    },
  });

  const items = itemsQuery.data ?? [];
  const selected = useMemo(
    () => items.find((it) => it.id === selectedId) ?? null,
    [items, selectedId],
  );

  // Auto-select first item
  useEffect(() => {
    if (!selectedId && items.length > 0) setSelectedId(items[0].id);
  }, [items, selectedId]);

  // Sync local edit state when selection changes
  useEffect(() => {
    if (!selected) return;
    const tp = readMap(selected.titoli_piattaforma);
    const dp = readMap(selected.descrizioni_piattaforma);
    // fall back to global titolo/descrizione for current platform if missing
    const fallbackT = selected.titolo ?? selected.nome_oggetto ?? "";
    const fallbackD = selected.descrizione ?? "";
    setTitoli({
      ...Object.fromEntries(PLATFORM_LIST.map((p) => [p.key, tp[p.key] ?? ""])),
      ...tp,
      [platform]: tp[platform] ?? fallbackT,
    });
    setDescrizioni({
      ...Object.fromEntries(PLATFORM_LIST.map((p) => [p.key, dp[p.key] ?? ""])),
      ...dp,
      [platform]: dp[platform] ?? fallbackD,
    });
    setFoto(selected.foto_url ?? "");
    setLastAi(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const optimizeFn = useServerFn(optimizeListing);
  const optimize = useMutation({
    mutationFn: async () =>
      optimizeFn({
        data: {
          rawTitle: titoli[platform] || selected?.titolo || selected?.nome_oggetto || "",
          rawDescription: descrizioni[platform] || selected?.descrizione || "",
          platform,
          categoria: selected?.categoria_prodotto ?? "",
        },
      }),
    onSuccess: (res) => {
      setTitoli((prev) => ({ ...prev, [platform]: res.title }));
      setDescrizioni((prev) => ({ ...prev, [platform]: res.description }));
      setLastAi({
        keywords: res.keywords,
        score: res.score,
        rationale: res.rationale,
        platform,
      });
      toast.success(`Ottimizzato per ${PLATFORMS[platform].name}`, {
        description: `SEO score ${res.score}/100`,
      });
    },
    onError: (e: Error) => toast.error("Ottimizzazione non riuscita", { description: e.message }),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Nessun articolo selezionato");
      const { error } = await supabase
        .from("inventory_items")
        .update({
          titoli_piattaforma: titoli,
          descrizioni_piattaforma: descrizioni,
          titolo: titoli[platform] || selected.titolo,
          descrizione: descrizioni[platform] || selected.descrizione,
          foto_url: foto || null,
        })
        .eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-items-annunci"] });
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      toast.success("Annuncio salvato");
    },
    onError: (e: Error) => toast.error("Salvataggio non riuscito", { description: e.message }),
  });

  const limit = PLATFORMS[platform].titleLimit;
  const descLimit = PLATFORMS[platform].descriptionLimit;
  const titleVal = titoli[platform] ?? "";
  const descVal = descrizioni[platform] ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" /> Annunci
          </h1>
          <p className="text-sm text-muted-foreground">
            Foto, titolo e descrizioni — ottimizzati con IA per ogni piattaforma.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => newAd.mutate()} disabled={newAd.isPending}>
            <Plus className="h-4 w-4" />
            {newAd.isPending ? "Creazione..." : "Nuovo annuncio"}
          </Button>
          <Button onClick={() => saveAd.mutate()} disabled={!currentAdId || saveAd.isPending}>
            <Save className="h-4 w-4" />
            {saveAd.isPending ? "Salvataggio..." : "Salva annuncio"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
        {/* Colonna sinistra — Associa a inventario */}
        <Card className="border-border bg-card p-5 space-y-4 h-fit">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <UploadCloud className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Associa a:</div>
              <div className="text-xs text-muted-foreground">Articolo in inventario</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Articolo inventario
            </Label>
            <Select value={selectedId ?? ""} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder="Scegli articolo" /></SelectTrigger>
              <SelectContent>
                {items.map((it) => (
                  <SelectItem key={it.id} value={it.id}>
                    {it.titolo || it.nome_oggetto || "Senza nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected && (
            <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3 text-xs">
              <Row label="Stato" value={selected.stato_prodotto ?? "—"} />
              <Row label="Categoria" value={selected.categoria_prodotto ?? "—"} />
              <Row label="Costo" value={selected.costo_acquisto ? `€ ${selected.costo_acquisto}` : "—"} />
              <Row label="Posizione" value={selected.posizione_inventario ?? "—"} />
            </div>
          )}

          <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground mb-1">Scorte / partendo dall'esistente</div>
            Crea l'annuncio partendo da un articolo già in inventario per riutilizzare costi, foto e categoria.
          </div>
        </Card>

        {/* Colonna centrale — Foto + Titolo + Descrizione */}
        <Card className="border-border bg-card p-5 space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Foto, Titolo e Descrizioni
            </div>
          </div>

          {/* Selettore piattaforma — V | S | EB | MP | CM */}
          <div className="rounded-xl border border-border bg-secondary/30 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 pb-1">
              Piattaforma corrente — titolo e descrizione personalizzati
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {PLATFORM_LIST.map((p) => {
                const active = p.key === platform;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPlatform(p.key)}
                    className={[
                      "rounded-lg px-2 py-2 text-xs font-bold transition-all",
                      active
                        ? "ring-2 ring-primary text-white shadow-lg"
                        : "bg-background/60 text-muted-foreground hover:bg-background",
                    ].join(" ")}
                    style={active ? { backgroundColor: p.color } : undefined}
                  >
                    <div>{p.short}</div>
                    <div className="text-[9px] font-medium opacity-80">{p.titleLimit}c</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TITOLO */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Titolo · MODIFICA / CREA
              </Label>
              <span
                className={`text-xs tabular-nums ${
                  titleVal.length > limit ? "text-rose-400 font-semibold" : "text-muted-foreground"
                }`}
              >
                {titleVal.length}/{limit}
              </span>
            </div>
            <Input
              value={titleVal}
              onChange={(e) => setTitoli((prev) => ({ ...prev, [platform]: e.target.value }))}
              placeholder={`Titolo per ${PLATFORMS[platform].name}`}
              className="text-base font-medium"
            />
          </div>

          {/* FOTO UPLOAD */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Carica foto
            </Label>
            <div className="grid aspect-[2/1] w-full place-items-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-background/40 transition-colors hover:border-primary/50">
              {foto ? (
                <img
                  src={foto}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Plus className="h-10 w-10" strokeWidth={1.5} />
                  <div className="text-sm font-medium text-foreground">CARICA FOTO</div>
                  <div className="text-xs">Incolla URL immagine qui sotto</div>
                </div>
              )}
            </div>
            <Input
              value={foto}
              onChange={(e) => setFoto(e.target.value)}
              placeholder="https://…/foto.jpg"
              inputMode="url"
            />
          </div>

          {/* DESCRIZIONE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Descrizione · MODIFICA / CREA
              </Label>
              <span
                className={`text-xs tabular-nums ${
                  descVal.length > descLimit ? "text-rose-400 font-semibold" : "text-muted-foreground"
                }`}
              >
                {descVal.length}/{descLimit}
              </span>
            </div>
            <Textarea
              rows={8}
              value={descVal}
              onChange={(e) => setDescrizioni((prev) => ({ ...prev, [platform]: e.target.value }))}
              placeholder={`Descrizione completa per ${PLATFORMS[platform].name}`}
            />
          </div>

          {/* AI OPTIMIZE */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-semibold">Ottimizza Titolo</div>
                  <div className="text-xs text-muted-foreground">
                    Migliora titolo e descrizione con IA, SEO perfetta per {PLATFORMS[platform].name}.
                  </div>
                </div>
              </div>
              <Button
                onClick={() => optimize.mutate()}
                disabled={optimize.isPending || !titleVal.trim()}
              >
                <Sparkles className="h-4 w-4" />
                {optimize.isPending ? "Sto ottimizzando..." : "Ottimizza con IA"}
              </Button>
            </div>
            {lastAi && (
              <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    SEO Score per {PLATFORMS[lastAi.platform].name}
                  </span>
                  <Badge className="bg-primary text-primary-foreground">{lastAi.score}/100</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{lastAi.rationale}</div>
                <div className="flex flex-wrap gap-1.5">
                  {lastAi.keywords.map((k, i) => (
                    <span
                      key={k + i}
                      className={[
                        "rounded-md px-2 py-0.5 text-[11px] font-medium",
                        i < 3
                          ? "bg-primary/20 text-primary"
                          : "bg-secondary text-muted-foreground",
                      ].join(" ")}
                    >
                      #{k}
                    </span>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${titleVal}\n\n${descVal}`);
                      toast.success("Copiato negli appunti");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copia titolo + descrizione
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Colonna destra — Anteprima multi-piattaforma + Feedback */}
        <Card className="border-border bg-card p-5 space-y-4 h-fit">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Megaphone className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Anteprima per piattaforma</div>
              <div className="text-xs text-muted-foreground">Stato titoli salvati</div>
            </div>
          </div>

          <div className="space-y-2">
            {PLATFORM_LIST.map((p) => {
              const t = titoli[p.key] ?? "";
              const filled = t.trim().length > 0;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPlatform(p.key)}
                  className={[
                    "w-full rounded-lg border p-2.5 text-left transition-all",
                    platform === p.key
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/40 hover:bg-accent",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.short}
                      </span>
                      <span className="font-semibold">{p.name}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={filled ? "border-emerald-500/40 text-emerald-400" : "border-border"}
                    >
                      {filled ? "Pronto" : "Vuoto"}
                    </Badge>
                  </div>
                  {filled && (
                    <div className="mt-1.5 truncate text-[11px] text-muted-foreground">{t}</div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-dashed border-border p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <MessageSquareHeart className="h-3.5 w-3.5 text-primary" />
              Aiutaci a migliorare
            </div>
            <p className="text-muted-foreground">
              Lascia un feedback sull'ottimizzatore IA — ci aiuta a perfezionare i prompt.
            </p>
            <Button variant="outline" size="sm" className="w-full" onClick={() => toast.message("Grazie, raccogliamo i feedback nelle prossime release.")}>
              Lascia un feedback
            </Button>
          </div>
        </Card>
      </div>

      {itemsQuery.isLoading && (
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground truncate max-w-[60%] text-right">{value}</span>
    </div>
  );
}
