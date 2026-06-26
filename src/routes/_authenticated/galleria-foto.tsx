import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Images, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { PLATFORMS, PLATFORM_LIST, type PlatformKey } from "@/lib/platforms";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/galleria-foto")({
  component: GalleriaFotoPage,
});

const BUCKET = "ad-photos";
const GALLERY_LIMIT = 30;

type Ad = Tables<"ads">;
type Item = Tables<"inventory_items">;

type Photo = {
  raw: string;
  adId: string;
  adTitle: string;
  platform: string;
  platformKey: PlatformKey | null;
  inventoryId: string | null;
  index: number;
  updatedAt: string | null;
};

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

function GalleriaFotoPage() {
  const [platformFilter, setPlatformFilter] = useState<"all" | PlatformKey>("all");
  const [signed, setSigned] = useState<Record<string, string>>({});

  const adsQuery = useQuery({
    queryKey: ["gallery-ads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads")
        .select("id, generated_title, platform, inventory_id, photos, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pick<Ad, "id" | "generated_title" | "platform" | "inventory_id" | "photos" | "updated_at">[];
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["gallery-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, titolo, nome_oggetto");
      if (error) throw error;
      return (data ?? []) as Pick<Item, "id" | "titolo" | "nome_oggetto">[];
    },
  });

  const allPhotos: Photo[] = useMemo(() => {
    const ads = adsQuery.data ?? [];
    const out: Photo[] = [];
    for (const ad of ads) {
      const list = Array.isArray(ad.photos) ? ad.photos : [];
      const pMeta = PLATFORM_LIST.find((p) => p.name === ad.platform);
      list.forEach((raw, i) => {
        if (!raw) return;
        out.push({
          raw,
          adId: ad.id,
          adTitle: ad.generated_title?.trim() || "Senza titolo",
          platform: ad.platform,
          platformKey: pMeta?.key ?? null,
          inventoryId: ad.inventory_id,
          index: i,
          updatedAt: ad.updated_at,
        });
      });
    }
    return out;
  }, [adsQuery.data]);

  const filtered = useMemo(() => {
    const base = platformFilter === "all"
      ? allPhotos
      : allPhotos.filter((p) => p.platformKey === platformFilter);
    return base.slice(0, GALLERY_LIMIT);
  }, [allPhotos, platformFilter]);

  // Resolve signed URLs for storage paths in the visible window.
  useEffect(() => {
    const paths = filtered
      .map((p) => p.raw)
      .filter((r) => r && !isHttpUrl(r) && !signed[r]);
    if (paths.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, 60 * 60 * 8);
      if (cancelled || error || !data) return;
      const next: Record<string, string> = {};
      data.forEach((d, i) => {
        if (d.signedUrl) next[paths[i]] = d.signedUrl;
      });
      setSigned((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [filtered, signed]);

  const itemName = (id: string | null) => {
    if (!id) return "—";
    const it = (itemsQuery.data ?? []).find((x) => x.id === id);
    return it?.titolo || it?.nome_oggetto || "—";
  };

  const totalPhotos = allPhotos.length;
  const shown = filtered.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Images className="h-6 w-6 text-primary" /> Galleria foto
          </h1>
          <p className="text-sm text-muted-foreground">
            Tutte le foto presenti nei tuoi annunci. Visualizzazione limitata alle{" "}
            <span className="font-semibold text-foreground">{GALLERY_LIMIT}</span> più recenti.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v as "all" | PlatformKey)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le piattaforme</SelectItem>
              {PLATFORM_LIST.map((p) => (
                <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="h-9 px-3">
            {shown} / {Math.min(totalPhotos, GALLERY_LIMIT)} mostrate · {totalPhotos} totali
          </Badge>
        </div>
      </div>

      {adsQuery.isLoading ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border bg-card/50 p-10 text-center">
          <Images className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
          <div className="mt-3 text-sm font-semibold">Nessuna foto disponibile</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Carica foto dagli annunci per vederle qui.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((p, i) => {
            const url = isHttpUrl(p.raw) ? p.raw : signed[p.raw];
            const pMeta = PLATFORM_LIST.find((m) => m.key === p.platformKey);
            return (
              <Card key={`${p.adId}-${p.index}-${i}`} className="overflow-hidden border-border bg-card p-0">
                <div className="relative aspect-square bg-background/40">
                  {url ? (
                    <img src={url} alt={p.adTitle} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">
                      Caricamento…
                    </div>
                  )}
                  {pMeta && (
                    <span
                      className="absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white"
                      style={{ backgroundColor: pMeta.color }}
                    >
                      {pMeta.short}
                    </span>
                  )}
                  {p.index === 0 && (
                    <span className="absolute right-1.5 top-1.5 rounded bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                      Cover
                    </span>
                  )}
                </div>
                <div className="space-y-1 p-2.5">
                  <div className="truncate text-xs font-semibold">{p.adTitle}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {itemName(p.inventoryId)} · {PLATFORMS[p.platformKey ?? "ebay"]?.name ?? p.platform}
                  </div>
                  <div className="flex items-center gap-1 pt-1">
                    {url && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 flex-1 px-2 text-[11px]"
                        onClick={() => window.open(url, "_blank", "noopener")}
                      >
                        <ExternalLink className="h-3 w-3" /> Apri
                      </Button>
                    )}
                    {url && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px]"
                        onClick={async () => {
                          await navigator.clipboard.writeText(url);
                          toast.success("URL copiato");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {totalPhotos > GALLERY_LIMIT && (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-3 text-center text-xs text-muted-foreground">
          Stai visualizzando le {GALLERY_LIMIT} foto più recenti su un totale di {totalPhotos}.
          Filtra per piattaforma per esplorarne altre.
        </div>
      )}
    </div>
  );
}
