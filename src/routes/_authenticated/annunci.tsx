import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Megaphone, Sparkles, UploadCloud, Wand2, Save, Plus, Copy,
  MessageSquareHeart, Trash2, CopyPlus, X, ImagePlus, Search,
  ChevronLeft, ChevronRight, ArrowUpDown, FileText, ChevronDown,
  FileUp,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { toast } from "sonner";
import { PLATFORMS, PLATFORM_LIST, type PlatformKey } from "@/lib/platforms";
import { optimizeListing } from "@/lib/ai.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/annunci")({
  component: AnnunciPage,
});

type InventoryItem = Tables<"inventory_items">;
type Ad = Tables<"ads">;
type PlatformMap = Record<string, string>;

const STORAGE_KEY = "viis:annunci:state";
// Per-platform photo limits (Cardmarket non specificato → fallback 20).
const PHOTO_LIMITS: Record<PlatformKey, number> = {
  vinted: 20,
  ebay: 24,
  subito: 6,
  wallapop: 10,
  cardmarket: 20,
};
const MAX_PHOTOS_ABS = Math.max(...Object.values(PHOTO_LIMITS));
const BUCKET = "ad-photos";
const PAGE_SIZE = 8;
const UPLOAD_TIMEOUT_MS = 30_000;
const UPLOAD_MAX_RETRIES = 3;

type SortKey = "updated_desc" | "updated_asc" | "title_asc";

// Upload a single file with timeout + exponential backoff retry.
async function uploadWithRetry(path: string, file: File): Promise<void> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < UPLOAD_MAX_RETRIES) {
    attempt++;
    try {
      const upload = supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error(`Timeout dopo ${UPLOAD_TIMEOUT_MS / 1000}s`)), UPLOAD_TIMEOUT_MS),
      );
      const res = (await Promise.race([upload, timeout])) as { error?: { message?: string } | null };
      if (res?.error) throw new Error(res.error.message ?? "Upload error");
      return;

    } catch (e) {
      lastErr = e;
      if (attempt >= UPLOAD_MAX_RETRIES) break;
      // Backoff: 500ms, 1500ms, 3500ms
      await new Promise((r) => setTimeout(r, 500 * (2 ** attempt - 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Upload fallito");
}



function readMap(v: unknown): PlatformMap {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as PlatformMap;
  return {};
}

function loadPersisted(): { selectedId: string | null; platform: PlatformKey; adId: string | null } {
  if (typeof window === "undefined") return { selectedId: null, platform: "ebay", adId: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { selectedId: null, platform: "ebay", adId: null };
    const v = JSON.parse(raw);
    const platform: PlatformKey = (v.platform && PLATFORMS[v.platform as PlatformKey])
      ? (v.platform as PlatformKey) : "ebay";
    return {
      selectedId: typeof v.selectedId === "string" ? v.selectedId : null,
      platform,
      adId: typeof v.adId === "string" ? v.adId : null,
    };
  } catch {
    return { selectedId: null, platform: "ebay", adId: null };
  }
}

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

// Minimal RFC4180-ish CSV parser (comma or semicolon, quoted fields, CRLF).
function parseCsv(text: string): Array<Record<string, string>> {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  let sep: "," | ";" | null = null;
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  sep = (firstLine.split(";").length > firstLine.split(",").length) ? ";" : ",";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === sep) { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1)
    .filter((r) => r.some((v) => v && v.trim().length > 0))
    .map((r) => {
      const o: Record<string, string> = {};
      headers.forEach((h, idx) => { o[h] = (r[idx] ?? "").trim(); });
      return o;
    });
}

function AnnunciPage() {
  const qc = useQueryClient();
  // Hydration-safe defaults — restore from localStorage after mount.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<PlatformKey>("ebay");
  const [currentAdId, setCurrentAdId] = useState<string | null>(null);
  const [titoli, setTitoli] = useState<PlatformMap>({});
  const [descrizioni, setDescrizioni] = useState<PlatformMap>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<null | "delete">(null);
  const [lastAi, setLastAi] = useState<{
    keywords: string[]; score: number; rationale: string; platform: PlatformKey;
  } | null>(null);
  // Filters for the ads list.
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [scopeAll, setScopeAll] = useState(true); // default: cerca in tutti gli annunci
  const [platformFilter, setPlatformFilter] = useState<"all" | PlatformKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_desc");
  const [page, setPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const prevPlatformRef = useRef<PlatformKey>("ebay");
  const photoLimit = PHOTO_LIMITS[platform];

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to first page when filters change.
  useEffect(() => {
    setPage(0);
  }, [searchDebounced, scopeAll, platformFilter, sortKey, selectedId]);


  // Restore last session AFTER mount to avoid SSR/CSR mismatch.
  useEffect(() => {
    const p = loadPersisted();
    setSelectedId(p.selectedId);
    setPlatform(p.platform);
    setCurrentAdId(p.adId);
  }, []);

  // Persist session state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedId, platform, adId: currentAdId }),
    );
  }, [selectedId, platform, currentAdId]);

  // Inventory list.
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

  // Auto-select first inventory item only if nothing persisted.
  useEffect(() => {
    if (!selectedId && items.length > 0) setSelectedId(items[0].id);
  }, [items, selectedId]);

  // Scoped query (item × current platform) — drives auto-load only.
  const adsQuery = useQuery({
    queryKey: ["ads", "scope", selectedId, PLATFORMS[platform].name],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads")
        .select("*")
        .eq("inventory_id", selectedId!)
        .eq("platform", PLATFORMS[platform].name)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ad[];
    },
  });

  // Paginated + filterable list query for the visible drafts list.
  const adsListQuery = useQuery({
    queryKey: [
      "ads", "list",
      scopeAll ? "all" : selectedId,
      platformFilter,
      searchDebounced,
      sortKey,
      page,
    ],
    enabled: scopeAll || !!selectedId,
    queryFn: async () => {
      let q = supabase
        .from("ads")
        .select("*", { count: "exact" });
      if (!scopeAll && selectedId) q = q.eq("inventory_id", selectedId);
      if (platformFilter !== "all") q = q.eq("platform", PLATFORMS[platformFilter].name);
      if (searchDebounced) q = q.ilike("generated_title", `%${searchDebounced}%`);
      if (sortKey === "updated_desc") q = q.order("updated_at", { ascending: false });
      else if (sortKey === "updated_asc") q = q.order("updated_at", { ascending: true });
      else q = q.order("generated_title", { ascending: true, nullsFirst: false });
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await q.range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as Ad[], total: count ?? 0 };
    },
  });

  // Quick-access "Bozze" menu — most recent drafts across all items × platforms.
  const draftsMenuQuery = useQuery({
    queryKey: ["ads", "drafts-menu"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads")
        .select("id, generated_title, platform, inventory_id, photos, updated_at")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Pick<Ad, "id" | "generated_title" | "platform" | "inventory_id" | "photos" | "updated_at">[];
    },
  });




  // When the (item, platform) scope changes, auto-load the most recent ad
  // — OR keep the persisted currentAdId if it belongs to this scope.
  useEffect(() => {
    if (!selected) return;
    const ads = adsQuery.data ?? [];
    const persisted = ads.find((a) => a.id === currentAdId);
    const pick = persisted ?? ads[0] ?? null;

    if (pick) {
      setCurrentAdId(pick.id);
      // Hydrate titoli/descrizioni for this platform from the ad row;
      // fall back to inventory's per-platform map if the ad has no value.
      const invT = readMap(selected.titoli_piattaforma);
      const invD = readMap(selected.descrizioni_piattaforma);
      setTitoli((prev) => ({
        ...Object.fromEntries(PLATFORM_LIST.map((p) => [p.key, prev[p.key] ?? invT[p.key] ?? ""])),
        [platform]: pick.generated_title ?? invT[platform] ?? selected.titolo ?? selected.nome_oggetto ?? "",
      }));
      setDescrizioni((prev) => ({
        ...Object.fromEntries(PLATFORM_LIST.map((p) => [p.key, prev[p.key] ?? invD[p.key] ?? ""])),
        [platform]: pick.generated_description ?? invD[platform] ?? selected.descrizione ?? "",
      }));
      setPhotos(Array.isArray(pick.photos) ? pick.photos : []);
    } else {
      // No ad yet for this scope — pre-fill from inventory but blank the ad id.
      setCurrentAdId(null);
      const invT = readMap(selected.titoli_piattaforma);
      const invD = readMap(selected.descrizioni_piattaforma);
      setTitoli((prev) => ({
        ...prev,
        [platform]: invT[platform] ?? selected.titolo ?? selected.nome_oggetto ?? "",
      }));
      setDescrizioni((prev) => ({
        ...prev,
        [platform]: invD[platform] ?? selected.descrizione ?? "",
      }));
      setPhotos(selected.foto_url ? [selected.foto_url] : []);
    }
    setLastAi(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, platform, adsQuery.data]);

  // Resolve signed URLs for any photo entries stored as storage paths.
  useEffect(() => {
    const toSign = photos.filter((p) => p && !isHttpUrl(p) && !signedUrls[p]);
    if (toSign.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(toSign, 60 * 60 * 8);
      if (cancelled || error || !data) return;
      const next: Record<string, string> = {};
      data.forEach((d, i) => {
        if (d.signedUrl) next[toSign[i]] = d.signedUrl;
      });
      setSignedUrls((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [photos, signedUrls]);

  const photoSrc = useCallback(
    (p: string) => (isHttpUrl(p) ? p : signedUrls[p] ?? ""),
    [signedUrls],
  );

  // Sync title/description back to inventory_items so the inventory edit
  // dialog can display the per-platform variants saved in Annunci.
  const syncInventoryPlatformCopy = useCallback(
    async (invId: string | null, platformKey: PlatformKey, title: string, description: string) => {
      if (!invId) return;
      const { data: row, error: readErr } = await supabase
        .from("inventory_items")
        .select("titoli_piattaforma, descrizioni_piattaforma")
        .eq("id", invId)
        .maybeSingle();
      if (readErr || !row) return;
      const t = (row.titoli_piattaforma && typeof row.titoli_piattaforma === "object" && !Array.isArray(row.titoli_piattaforma)
        ? { ...(row.titoli_piattaforma as Record<string, string>) } : {});
      const d = (row.descrizioni_piattaforma && typeof row.descrizioni_piattaforma === "object" && !Array.isArray(row.descrizioni_piattaforma)
        ? { ...(row.descrizioni_piattaforma as Record<string, string>) } : {});
      t[platformKey] = title ?? "";
      d[platformKey] = description ?? "";
      await supabase
        .from("inventory_items")
        .update({ titoli_piattaforma: t, descrizioni_piattaforma: d })
        .eq("id", invId);
    },
    [],
  );

  // Mutations ---------------------------------------------------------------
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
          generated_title: titoli[platform] ?? "",
          generated_description: descrizioni[platform] ?? "",
          photos,
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
      if (photos.length > photoLimit) throw new Error(`Massimo ${photoLimit} foto`);
      if (!currentAdId) {
        // Upsert behaviour: if no current ad, create one on save.
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error("Utente non autenticato");
        const { data, error } = await supabase
          .from("ads")
          .insert({
            user_id: u.user.id,
            inventory_id: selectedId,
            platform: PLATFORMS[platform].name,
            generated_title: titoli[platform] ?? "",
            generated_description: descrizioni[platform] ?? "",
            photos,
          })
          .select("id")
          .single();
        if (error) throw error;
        return data.id as string;
      }
      const { error } = await supabase
        .from("ads")
        .update({
          inventory_id: selectedId,
          platform: PLATFORMS[platform].name,
          generated_title: titoli[platform] ?? "",
          generated_description: descrizioni[platform] ?? "",
          photos,
        })
        .eq("id", currentAdId);
      if (error) throw error;
      return currentAdId;
    },
    onSuccess: (id) => {
      setCurrentAdId(id);
      qc.invalidateQueries({ queryKey: ["ads"] });
      toast.success("Annuncio salvato");
    },
    onError: (e: Error) => toast.error("Salvataggio fallito", { description: e.message }),
  });

  const duplicateAd = useMutation({
    mutationFn: async () => {
      if (!currentAdId) throw new Error("Nessun annuncio da duplicare");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Utente non autenticato");
      const { data, error } = await supabase
        .from("ads")
        .insert({
          user_id: u.user.id,
          inventory_id: selectedId,
          platform: PLATFORMS[platform].name,
          generated_title: (titoli[platform] ?? "") + " (copia)",
          generated_description: descrizioni[platform] ?? "",
          photos,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      setCurrentAdId(id);
      setTitoli((prev) => ({ ...prev, [platform]: (prev[platform] ?? "") + " (copia)" }));
      qc.invalidateQueries({ queryKey: ["ads"] });
      toast.success("Bozza duplicata");
    },
    onError: (e: Error) => toast.error("Duplicazione fallita", { description: e.message }),
  });

  const deleteAd = useMutation({
    mutationFn: async () => {
      if (!currentAdId) throw new Error("Nessun annuncio attivo");
      const { error } = await supabase.from("ads").delete().eq("id", currentAdId);
      if (error) throw error;
    },
    onSuccess: () => {
      setCurrentAdId(null);
      setPhotos([]);
      setTitoli((prev) => ({ ...prev, [platform]: "" }));
      setDescrizioni((prev) => ({ ...prev, [platform]: "" }));
      qc.invalidateQueries({ queryKey: ["ads"] });
      toast.success("Annuncio eliminato");
    },
    onError: (e: Error) => toast.error("Eliminazione fallita", { description: e.message }),
  });

  // Photo handlers ---------------------------------------------------------
  const addPhotoUrl = () => {
    const v = photoUrlInput.trim();
    if (!v) return;
    if (!isHttpUrl(v)) {
      toast.error("URL non valido", { description: "Deve iniziare con http(s)://" });
      return;
    }
    if (photos.length >= photoLimit) {
      toast.error(`Massimo ${photoLimit} foto`);
      return;
    }
    setPhotos((prev) => [...prev, v]);
    setPhotoUrlInput("");
  };

  const uploadFiles = useMutation({
    mutationFn: async (files: File[]) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Utente non autenticato");
      const remaining = photoLimit - photos.length;
      if (remaining <= 0) throw new Error(`Hai già raggiunto le ${photoLimit} foto`);
      const slice = files.slice(0, remaining);
      const paths: string[] = [];
      const failed: string[] = [];
      for (const file of slice) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
        try {
          await uploadWithRetry(path, file);
          paths.push(path);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "errore";
          failed.push(`${file.name} (${msg})`);
        }
      }
      return { paths, failed, skipped: files.length - slice.length };
    },
    onSuccess: ({ paths, failed, skipped }) => {
      if (paths.length) {
        setPhotos((prev) => [...prev, ...paths]);
        toast.success(`${paths.length} foto caricate`);
      }
      if (skipped > 0) {
        toast.warning(`${skipped} file ignorati`, { description: `Limite massimo ${photoLimit} foto` });
      }
      if (failed.length) {
        toast.error(`${failed.length} upload falliti`, {
          description: failed.slice(0, 3).join(" · ") + (failed.length > 3 ? "…" : ""),
        });
      }
    },
    onError: (e: Error) => toast.error("Upload fallito", { description: e.message }),
  });


  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  // CSV import — bulk insert ads from a CSV file.
  // Expected headers (case-insensitive): title, description, platform, inventory_id (optional), photos (optional, pipe-separated URLs)
  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error("CSV vuoto o non valido");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Utente non autenticato");
      const platformNames = new Set(PLATFORM_LIST.map((p) => p.name.toLowerCase()));
      const platformByKey: Record<string, string> = {};
      PLATFORM_LIST.forEach((p) => {
        platformByKey[p.key.toLowerCase()] = p.name;
        platformByKey[p.name.toLowerCase()] = p.name;
      });
      const records = rows.map((r) => {
        const rawPlat = (r.platform ?? r.piattaforma ?? "").toString().trim().toLowerCase();
        const platName = platformByKey[rawPlat] ?? (platformNames.has(rawPlat) ? rawPlat : "eBay");
        const photosRaw = (r.photos ?? r.foto ?? "").toString();
        const ph = photosRaw
          .split(/[|,;\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        return {
          user_id: u.user.id,
          inventory_id: (r.inventory_id ?? r.inventario ?? "").toString().trim() || null,
          platform: platName,
          generated_title: (r.title ?? r.titolo ?? "").toString().trim(),
          generated_description: (r.description ?? r.descrizione ?? "").toString().trim(),
          photos: ph,
        };
      }).filter((r) => r.generated_title || r.generated_description);
      if (records.length === 0) throw new Error("Nessuna riga utile trovata");
      const { error, count } = await supabase.from("ads").insert(records, { count: "exact" });
      if (error) throw error;
      return count ?? records.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["ads"] });
      toast.success(`Importati ${n} annunci dal CSV`);
    },
    onError: (e: Error) => toast.error("Import CSV fallito", { description: e.message }),
  });

  // Auto-optimize when switching to a platform whose title is still empty
  // and another platform has content — keeps the user's existing draft intact.
  useEffect(() => {
    const prev = prevPlatformRef.current;
    prevPlatformRef.current = platform;
    if (prev === platform) return;
    const currentTitle = (titoli[platform] ?? "").trim();
    if (currentTitle) return; // don't overwrite
    const sourceTitle = (titoli[prev] ?? "").trim()
      || (selected?.titolo ?? "").trim()
      || (selected?.nome_oggetto ?? "").trim();
    if (!sourceTitle) return;
    const sourceDesc = (descrizioni[prev] ?? descrizioni[platform] ?? selected?.descrizione ?? "").trim();
    const targetPlatform = platform;
    (async () => {
      try {
        const res = await optimizeFn({
          data: {
            rawTitle: sourceTitle,
            rawDescription: sourceDesc,
            platform: targetPlatform,
            categoria: selected?.categoria_prodotto ?? "",
          },
        });
        // Only apply if the user hasn't typed something in the meantime
        setTitoli((cur) => (cur[targetPlatform]?.trim() ? cur : { ...cur, [targetPlatform]: res.title }));
        setDescrizioni((cur) => (cur[targetPlatform]?.trim() ? cur : { ...cur, [targetPlatform]: res.description }));
        setLastAi({ keywords: res.keywords, score: res.score, rationale: res.rationale, platform: targetPlatform });
        toast.success(`Titolo auto-ottimizzato per ${PLATFORMS[targetPlatform].name}`, {
          description: `SEO score ${res.score}/100`,
        });
      } catch (e) {
        // Silent fail — user can still optimize manually.
        console.warn("auto-optimize failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);


  // AI optimize ------------------------------------------------------------
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

  const limit = PLATFORMS[platform].titleLimit;
  const descLimit = PLATFORMS[platform].descriptionLimit;
  const titleVal = titoli[platform] ?? "";
  const descVal = descrizioni[platform] ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary shrink-0" />
            <span className="truncate">
              {(titoli[platform] ?? "").trim() || "Annunci"}
            </span>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary shrink-0">
              {PLATFORMS[platform].name}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground truncate">
            {titleVal
              ? `${titleVal.length}/${limit} caratteri · cambia piattaforma per vedere l'altro titolo`
              : "Foto, titolo e descrizioni — ottimizzati con IA per ogni piattaforma."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => newAd.mutate()} disabled={newAd.isPending}>
            <Plus className="h-4 w-4" />
            {newAd.isPending ? "Creazione..." : "Nuovo annuncio"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <FileText className="h-4 w-4" />
                Bozze
                {(draftsMenuQuery.data?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {draftsMenuQuery.data!.length}
                  </Badge>
                )}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
              <DropdownMenuLabel>Bozze recenti</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(draftsMenuQuery.data ?? []).length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  Nessuna bozza salvata.
                </div>
              )}
              {(draftsMenuQuery.data ?? []).map((d) => {
                const pMeta = PLATFORM_LIST.find((p) => p.name === d.platform);
                const inv = items.find((it) => it.id === d.inventory_id);
                const updated = d.updated_at
                  ? new Date(d.updated_at).toLocaleString("it-IT", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })
                  : "—";
                return (
                  <DropdownMenuItem
                    key={d.id}
                    className="flex flex-col items-start gap-0.5 py-2"
                    onSelect={() => {
                      if (pMeta) setPlatform(pMeta.key);
                      if (d.inventory_id) setSelectedId(d.inventory_id);
                      setCurrentAdId(d.id);
                    }}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">
                        {d.generated_title?.trim() || "Senza titolo"}
                      </span>
                      {pMeta && (
                        <span
                          className="rounded px-1 py-0.5 text-[9px] font-bold text-white shrink-0"
                          style={{ backgroundColor: pMeta.color }}
                        >
                          {pMeta.short}
                        </span>
                      )}
                    </div>
                    <div className="flex w-full items-center justify-between text-[10px] text-muted-foreground">
                      <span className="truncate">{inv?.titolo || inv?.nome_oggetto || "—"}</span>
                      <span className="shrink-0">{updated} · {Array.isArray(d.photos) ? d.photos.length : 0} foto</span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            onClick={() => duplicateAd.mutate()}
            disabled={!currentAdId || duplicateAd.isPending}
          >
            <CopyPlus className="h-4 w-4" />
            {duplicateAd.isPending ? "Duplicazione..." : "Duplica bozza"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setConfirm("delete")}
            disabled={!currentAdId || deleteAd.isPending}
            className="text-rose-400 hover:text-rose-300"
          >
            <Trash2 className="h-4 w-4" />
            Elimina
          </Button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv.mutate(f);
              if (e.target) e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            onClick={() => csvInputRef.current?.click()}
            disabled={importCsv.isPending}
            title="Importa annunci da un file CSV (colonne: title, description, platform, inventory_id, photos)"
          >
            <FileUp className="h-4 w-4" />
            {importCsv.isPending ? "Importazione..." : "Importa CSV"}
          </Button>
          <Button onClick={() => saveAd.mutate()} disabled={saveAd.isPending}>
            <Save className="h-4 w-4" />
            {saveAd.isPending
              ? "Salvataggio..."
              : currentAdId ? "Aggiorna bozza" : "Salva come bozza"}
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
            {currentAdId && (
              <div className="text-[10px] text-muted-foreground">
                Annuncio attivo: <span className="font-mono">{currentAdId.slice(0, 8)}</span> · {PLATFORMS[platform].name}
              </div>
            )}
          </div>

          {selected && (
            <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3 text-xs">
              <Row label="Stato" value={selected.stato_prodotto ?? "—"} />
              <Row label="Categoria" value={selected.categoria_prodotto ?? "—"} />
              <Row label="Costo" value={selected.costo_acquisto ? `€ ${selected.costo_acquisto}` : "—"} />
              <Row label="Posizione" value={selected.posizione_inventario ?? "—"} />
            </div>
          )}

          {/* Lista bozze con ricerca, filtri, ordinamento, paginazione */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Bozze annunci
              </Label>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {adsListQuery.data?.total ?? 0} tot
              </span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca per titolo…"
                className="pl-7 h-8 text-xs"
              />
            </div>

            {/* Filters row */}
            <div className="grid grid-cols-2 gap-1.5">
              <Select value={scopeAll ? "all" : "item"} onValueChange={(v) => setScopeAll(v === "all")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="item">Solo articolo</SelectItem>
                  <SelectItem value="all">Tutti gli articoli</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={platformFilter}
                onValueChange={(v) => setPlatformFilter(v as "all" | PlatformKey)}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte piattaforme</SelectItem>
                  {PLATFORM_LIST.map((p) => (
                    <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="h-8 text-xs">
                <ArrowUpDown className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_desc">Più recenti</SelectItem>
                <SelectItem value="updated_asc">Più vecchi</SelectItem>
                <SelectItem value="title_asc">Titolo A→Z</SelectItem>
              </SelectContent>
            </Select>

            {adsListQuery.isLoading || adsListQuery.isFetching ? (
              <div className="space-y-1.5">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (adsListQuery.data?.rows ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-3 text-[11px] text-muted-foreground">
                Nessuna bozza per questi filtri.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {adsListQuery.data!.rows.map((a) => {
                  const active = a.id === currentAdId;
                  const updated = a.updated_at
                    ? new Date(a.updated_at).toLocaleString("it-IT", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })
                    : "—";
                  const pMeta = PLATFORM_LIST.find((p) => p.name === a.platform);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (pMeta) setPlatform(pMeta.key);
                          if (a.inventory_id && a.inventory_id !== selectedId) {
                            setSelectedId(a.inventory_id);
                          }
                          setCurrentAdId(a.id);
                        }}
                        className={[
                          "w-full rounded-lg border p-2 text-left transition-all",
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background/40 hover:bg-accent",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium">
                            {a.generated_title?.trim() || "Senza titolo"}
                          </span>
                          {pMeta && (
                            <span
                              className="rounded px-1 py-0.5 text-[9px] font-bold text-white"
                              style={{ backgroundColor: pMeta.color }}
                            >
                              {pMeta.short}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{updated}</span>
                          <span>{Array.isArray(a.photos) ? a.photos.length : 0} foto{active ? " · attiva" : ""}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Pagination */}
            {(adsListQuery.data?.total ?? 0) > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={page === 0 || adsListQuery.isFetching}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  pag. {page + 1} / {Math.max(1, Math.ceil((adsListQuery.data?.total ?? 0) / PAGE_SIZE))}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={
                    adsListQuery.isFetching ||
                    (page + 1) * PAGE_SIZE >= (adsListQuery.data?.total ?? 0)
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
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

          {/* Selettore piattaforma */}
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

          {/* FOTO — galleria multi-immagine */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Foto annuncio
              </Label>
              <span className={`text-xs tabular-nums ${photos.length > photoLimit ? "text-rose-400 font-semibold" : "text-muted-foreground"}`}>
                {photos.length}/{photoLimit}
              </span>
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((p, i) => (
                  <div
                    key={`${p}-${i}`}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-background/40"
                  >
                    {photoSrc(p) ? (
                      <img
                        src={photoSrc(p)}
                        alt={`Foto ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">
                        Caricamento…
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500"
                      aria-label={`Rimuovi foto ${i + 1}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 rounded bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        Cover
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid aspect-[2/1] w-full place-items-center rounded-xl border-2 border-dashed border-border bg-background/40 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <ImagePlus className="h-10 w-10" strokeWidth={1.5} />
                  <div className="text-sm font-medium text-foreground">Nessuna foto</div>
                  <div className="text-xs">Carica file o incolla un URL</div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) uploadFiles.mutate(files);
                  if (e.target) e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadFiles.isPending || photos.length >= photoLimit}
              >
                <UploadCloud className="h-4 w-4" />
                {uploadFiles.isPending ? "Upload..." : "Carica file"}
              </Button>
              <div className="flex flex-1 min-w-[200px] gap-2">
                <Input
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  placeholder="https://…/foto.jpg"
                  inputMode="url"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPhotoUrl();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPhotoUrl}
                  disabled={!photoUrlInput.trim() || photos.length >= photoLimit}
                >
                  <Plus className="h-4 w-4" /> URL
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Le foto vengono salvate solo quando clicchi "Salva come bozza". Trascina per riordinare in arrivo.
            </p>
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
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => toast.message("Grazie, raccogliamo i feedback nelle prossime release.")}
            >
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

      <AlertDialog open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare l'annuncio?</AlertDialogTitle>
            <AlertDialogDescription>
              Operazione irreversibile. L'annuncio verrà rimosso dal database, ma le foto
              caricate restano nello spazio personale.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirm(null); deleteAd.mutate(); }}
              className="bg-rose-500 hover:bg-rose-600"
            >
              Elimina definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
