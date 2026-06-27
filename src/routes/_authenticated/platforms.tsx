import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PLATFORMS, PLATFORM_LIST, type PlatformKey } from "@/lib/platforms";

export const Route = createFileRoute("/_authenticated/platforms")({
  component: PlatformsPage,
});

type Account = {
  id: string;
  platform: string;
  username: string | null;
  enabled: boolean;
};

type PgError = { code?: string; message?: string; details?: string };

function friendlyError(e: unknown, fallback = "Operazione non riuscita"): string {
  const err = e as PgError;
  const msg = err?.message ?? "";
  if (err?.code === "23505" || /duplicate key|unique/i.test(msg)) {
    return "Esiste già un account con questo username su questa piattaforma.";
  }
  if (err?.code === "42501" || /row-level security/i.test(msg)) {
    return "Operazione bloccata: non hai i permessi per questa risorsa.";
  }
  if (/Failed to fetch|NetworkError/i.test(msg)) {
    return "Connessione non disponibile. Verifica la rete e riprova.";
  }
  return msg || fallback;
}

function PlatformsPage() {
  const qc = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: ["platform_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_accounts")
        .select("id, platform, username, enabled")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });

  useEffect(() => {
    if (accountsQuery.error) {
      toast.error("Impossibile caricare gli account", {
        description: friendlyError(accountsQuery.error),
      });
    }
  }, [accountsQuery.error]);

  const accounts = accountsQuery.data ?? [];

  const grouped = useMemo(() => {
    const map = new Map<PlatformKey, Account[]>();
    PLATFORM_LIST.forEach((p) => map.set(p.key, []));
    accounts.forEach((a) => {
      const list = map.get(a.platform as PlatformKey);
      if (list) list.push(a);
    });
    return map;
  }, [accounts]);

  const addAccount = useMutation({
    mutationFn: async (platform: PlatformKey) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessione scaduta. Effettua di nuovo l'accesso.");
      const { error } = await supabase.from("platform_accounts").insert({
        user_id: u.user.id,
        platform,
        username: "",
        enabled: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform_accounts"] });
      toast.success("Account aggiunto");
    },
    onError: (e) => toast.error("Aggiunta account non riuscita", { description: friendlyError(e) }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Le tue Piattaforme</h1>
        <p className="text-sm text-muted-foreground">
          Accedi ai tuoi account in un click — puoi collegarne più di uno per piattaforma con username diversi.
        </p>
      </div>

      {accountsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PLATFORM_LIST.map((p) => (
            <Card key={p.key} className="border-border bg-card p-5">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="mt-4 h-16 w-full" />
              <Skeleton className="mt-4 h-9 w-full" />
            </Card>
          ))}
        </div>
      ) : accountsQuery.isError ? (
        <Card className="flex items-center gap-3 border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div className="flex-1">
            <div className="font-medium">Impossibile caricare le piattaforme</div>
            <div className="text-muted-foreground">{friendlyError(accountsQuery.error)}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => accountsQuery.refetch()}>Riprova</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PLATFORM_LIST.map((p) => {
            const list = grouped.get(p.key) ?? [];
            return (
              <PlatformCard
                key={p.key}
                platformKey={p.key}
                accounts={list}
                onAdd={() => addAccount.mutate(p.key)}
                addPending={addAccount.isPending}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlatformCard({
  platformKey, accounts, onAdd, addPending,
}: {
  platformKey: PlatformKey;
  accounts: Account[];
  onAdd: () => void;
  addPending: boolean;
}) {
  const p = PLATFORMS[platformKey];

  return (
    <Card className="flex flex-col gap-4 border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="grid h-10 w-10 place-items-center rounded-lg font-bold text-white"
            style={{ backgroundColor: p.color }}
          >
            {p.initial}
          </div>
          <div>
            <div className="text-base font-semibold">{p.name}</div>
            <div className="text-xs text-muted-foreground">Limite titolo: {p.titleLimit} caratteri</div>
          </div>
        </div>
        <Badge variant="outline" className="border-border bg-secondary/40">
          {accounts.length} account
        </Badge>
      </div>

      <div className="flex flex-col gap-3">
        {accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-center text-xs text-muted-foreground">
            Nessun account collegato. Aggiungine uno per iniziare.
          </div>
        ) : (
          accounts.map((acc, i) => (
            <AccountRow key={acc.id} account={acc} index={i} />
          ))
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {p.links.map((l) => (
          <Button
            key={l.label}
            variant="outline"
            size="sm"
            className="justify-between"
            asChild
          >
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              <span className="truncate">{l.label}</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </a>
          </Button>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onAdd}
        disabled={addPending}
        className="self-start"
      >
        <Plus className="h-4 w-4" /> {addPending ? "Aggiungo…" : "Aggiungi account"}
      </Button>
    </Card>
  );
}

function AccountRow({ account, index }: { account: Account; index: number }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState(account.username ?? "");

  useEffect(() => { setUsername(account.username ?? ""); }, [account.username]);

  const update = useMutation({
    mutationFn: async (patch: Partial<Account>) => {
      const { error } = await supabase
        .from("platform_accounts")
        .update(patch)
        .eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform_accounts"] }),
    onError: (e) => {
      toast.error("Salvataggio non riuscito", { description: friendlyError(e) });
      // Roll back local state on duplicate
      setUsername(account.username ?? "");
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("platform_accounts").delete().eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform_accounts"] });
      toast.success("Account rimosso");
    },
    onError: (e) => toast.error("Rimozione non riuscita", { description: friendlyError(e) }),
  });

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-2.5">
      <div className="flex-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Account {index + 1}
        </Label>
        <Input
          value={username}
          placeholder="username"
          onChange={(e) => setUsername(e.target.value)}
          onBlur={() => {
            if (username !== (account.username ?? "")) update.mutate({ username });
          }}
          className="h-8 mt-1"
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] uppercase text-muted-foreground">
          {account.enabled ? "On" : "Off"}
        </span>
        <Switch
          checked={account.enabled}
          onCheckedChange={(v) => update.mutate({ enabled: v })}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-rose-400"
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
        aria-label="Rimuovi account"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
