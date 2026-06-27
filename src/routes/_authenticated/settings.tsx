import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  User as UserIcon,
  CreditCard,
  Bell,
  Shield,
  Pencil,
  Check,
  Download,
  Trash2,
  ExternalLink,
  Crown,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type SectionKey = "profilo" | "abbonamento" | "notifiche" | "privacy";

const SECTIONS: { key: SectionKey; label: string; icon: typeof UserIcon }[] = [
  { key: "profilo", label: "Profilo", icon: UserIcon },
  { key: "abbonamento", label: "Abbonamento", icon: CreditCard },
  { key: "notifiche", label: "Notifiche", icon: Bell },
  { key: "privacy", label: "Privacy", icon: Shield },
];

function SettingsPage() {
  const [section, setSection] = useState<SectionKey>("profilo");
  return (
    <div className="grid gap-6 lg:grid-cols-[220px,1fr]">
      <Card className="border-border bg-card p-2 lg:sticky lg:top-4 lg:h-fit">
        <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={cn(
                  "flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {s.label}
              </button>
            );
          })}
        </nav>
      </Card>

      <div className="space-y-6">
        {section === "profilo" && <ProfileSection />}
        {section === "abbonamento" && <SubscriptionSection />}
        {section === "notifiche" && <NotificationsSection />}
        {section === "privacy" && <PrivacySection />}
        
      </div>
    </div>
  );
}

// ---------- Profile ----------
function ProfileSection() {
  const { data: user } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const initialName = (user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string) || user?.email?.split("@")[0] || "";
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  useEffect(() => { setName(initialName); }, [initialName]);
  const email = user?.email ?? "";
  const avatarUrl = (user?.user_metadata?.avatar_url as string) || "";
  const initials = (name || email || "U").slice(0, 2).toUpperCase();
  const isGoogle = (user?.app_metadata?.provider === "google") || (user?.identities ?? []).some((i) => i.provider === "google");

  const save = async () => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (error) toast.error("Impossibile salvare", { description: error.message });
    else {
      toast.success("Nome aggiornato");
      setEditing(false);
    }
  };

  return (
    <Card className="border-border bg-card p-6">
      <h2 className="text-lg font-semibold tracking-tight">Profilo</h2>
      <p className="text-sm text-muted-foreground">Le informazioni del tuo account.</p>
      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
        <Avatar className="h-20 w-20 border border-border">
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
              <Button size="sm" onClick={save}><Check className="mr-1 h-4 w-4" /> Salva</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(initialName); }}>Annulla</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xl font-semibold">{name || "—"}</div>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Modifica nome
              </Button>
            </div>
          )}
          <div className="text-sm text-muted-foreground">{email}</div>
          {isGoogle && (
            <Badge variant="secondary" className="gap-1.5 border border-border bg-background">
              <GoogleGlyph /> Collegato con Google
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.12A6.97 6.97 0 0 1 5.47 12c0-.74.13-1.45.36-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

// ---------- Subscription ----------
type PlanKey = "free" | "pro";
const PLAN_META: Record<PlanKey, { name: string; price: string }> = {
  free: { name: "Free", price: "€0/mese" },
  pro: { name: "Pro Flipper", price: "€29,90/mese" },
};

function SubscriptionSection() {
  const [planOpen, setPlanOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState<PlanKey | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanKey>("pro");
  const [canceled, setCanceled] = useState(false);

  return (
    <Card className="border-border bg-card p-6">
      <h2 className="text-lg font-semibold tracking-tight">Abbonamento</h2>
      <p className="text-sm text-muted-foreground">Gestisci il tuo piano e il metodo di pagamento.</p>

      <div className="mt-6 rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/20 text-amber-400">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <Badge className="border-amber-400/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/25">
                {PLAN_META[currentPlan].name}
              </Badge>
              <div className="mt-1 text-sm text-muted-foreground">
                {canceled ? "Disdetta programmata · attivo fino al rinnovo" : "Il tuo piano attuale"}
              </div>
            </div>
          </div>
          <Button onClick={() => setPlanOpen(true)}>Cambia Piano</Button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-background/40 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Prossimo rinnovo</div>
            <div className="mt-1 font-semibold">
              {canceled ? "Nessun rinnovo — disdetto" : "18 Ottobre 2026 — €29,90"}
            </div>
            {!canceled && (
              <Button
                variant="link"
                size="sm"
                className="mt-2 h-auto p-0 text-destructive"
                onClick={() => setCancelOpen(true)}
              >
                Disdici servizio
              </Button>
            )}
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Metodo di pagamento</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium">
                <MastercardGlyph /> Mastercard •••• 4242
              </div>
              <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}>Modifica</Button>
            </div>
          </div>
        </div>
      </div>

      <PlanDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        currentPlan={currentPlan}
        onChoose={(plan) => {
          setPlanOpen(false);
          setConfirmPlan(plan);
        }}
      />
      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} />

      <Dialog open={!!confirmPlan} onOpenChange={(v) => !v && setConfirmPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma cambio piano</DialogTitle>
            <DialogDescription>
              Stai per passare al piano <b>{confirmPlan && PLAN_META[confirmPlan].name}</b> ({confirmPlan && PLAN_META[confirmPlan].price}).
              Il nuovo piano sarà attivo dal prossimo ciclo di fatturazione.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmPlan(null)}>Annulla</Button>
            <Button
              onClick={() => {
                if (!confirmPlan) return;
                setCurrentPlan(confirmPlan);
                setCanceled(false);
                toast.success(`Piano aggiornato a ${PLAN_META[confirmPlan].name}`);
                setConfirmPlan(null);
              }}
            >
              Conferma cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Disdici servizio
            </DialogTitle>
            <DialogDescription>
              Sei sicuro di voler disdire <b>{PLAN_META[currentPlan].name}</b>? Il piano resterà attivo fino al
              prossimo rinnovo (18 Ottobre 2026), poi tornerai al piano Free e perderai le funzioni Pro.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>Annulla</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setCanceled(true);
                setCancelOpen(false);
                toast.success("Disdetta programmata", {
                  description: "Il piano resterà attivo fino alla scadenza.",
                });
              }}
            >
              Conferma disdetta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function MastercardGlyph() {
  return (
    <svg viewBox="0 0 32 20" className="h-5 w-8">
      <rect width="32" height="20" rx="3" fill="#1a1a2e" />
      <circle cx="13" cy="10" r="5.5" fill="#EB001B" />
      <circle cx="19" cy="10" r="5.5" fill="#F79E1B" />
      <path d="M16 6.2a5.5 5.5 0 0 1 0 7.6 5.5 5.5 0 0 1 0-7.6z" fill="#FF5F00" />
    </svg>
  );
}

function PlanDialog({
  open,
  onOpenChange,
  currentPlan,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPlan: PlanKey;
  onChoose: (plan: PlanKey) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cambia Piano</DialogTitle>
          <DialogDescription>Confronta le opzioni e scegli quella adatta al tuo volume di vendite.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background/40 p-5">
            <div className="text-sm font-medium text-muted-foreground">Free</div>
            <div className="mt-1 text-3xl font-bold">€0<span className="text-base font-normal text-muted-foreground">/mese</span></div>
            <ul className="mt-4 space-y-2 text-sm">
              <li>• Fino a 30 articoli in inventario</li>
              <li>• 1 piattaforma collegata</li>
              <li>• Report base</li>
              <li>• Nessuna ottimizzazione AI</li>
            </ul>
            <Button
              variant="outline"
              className="mt-5 w-full"
              disabled={currentPlan === "free"}
              onClick={() => onChoose("free")}
            >
              {currentPlan === "free" ? "Piano attuale" : "Passa a Free"}
            </Button>
          </div>
          <div className="relative rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-transparent p-5">
            {currentPlan === "pro" && (
              <Badge className="absolute -top-2 right-4 border-amber-400/40 bg-amber-500/20 text-amber-300">Attuale</Badge>
            )}
            <div className="text-sm font-medium text-amber-300">Pro Flipper</div>
            <div className="mt-1 text-3xl font-bold">€29,90<span className="text-base font-normal text-muted-foreground">/mese</span></div>
            <ul className="mt-4 space-y-2 text-sm">
              <li>• Articoli illimitati</li>
              <li>• Tutte le piattaforme</li>
              <li>• Ottimizzazione titoli AI</li>
              <li>• Registro Corrispettivi & export PDF</li>
              <li>• Notifiche Telegram</li>
            </ul>
            <Button
              className="mt-5 w-full"
              disabled={currentPlan === "pro"}
              onClick={() => onChoose("pro")}
            >
              {currentPlan === "pro" ? "Piano attivo" : "Passa a Pro Flipper"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica metodo di pagamento</DialogTitle>
          <DialogDescription>I dati della carta sono gestiti in modo sicuro dal nostro provider.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Numero carta" inputMode="numeric" />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="MM/AA" />
            <Input placeholder="CVC" inputMode="numeric" />
          </div>
          <Input placeholder="Intestatario" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={() => { toast.success("Metodo di pagamento aggiornato"); onOpenChange(false); }}>Salva carta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Notifications ----------
function NotificationsSection() {
  const [telegram, setTelegram] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("notify_telegram") === "1";
  });
  useEffect(() => {
    window.localStorage.setItem("notify_telegram", telegram ? "1" : "0");
  }, [telegram]);

  return (
    <Card className="border-border bg-card p-6">
      <h2 className="text-lg font-semibold tracking-tight">Notifiche</h2>
      <p className="text-sm text-muted-foreground">Resta aggiornato sui tuoi pacchi in spedizione.</p>

      <div className="mt-6 flex items-start justify-between gap-4 rounded-xl border border-border bg-background/40 p-4">
        <div>
          <div className="font-medium">Ricevi notifiche Telegram per i tuoi pacchi</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Collega il tuo account Telegram per ricevere aggiornamenti sulle spedizioni.
          </div>
          {telegram && (
            <Button size="sm" variant="outline" className="mt-3" asChild>
              <a href="https://t.me/" target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Collega Telegram
              </a>
            </Button>
          )}
        </div>
        <Switch checked={telegram} onCheckedChange={setTelegram} />
      </div>
    </Card>
  );
}

// ---------- Privacy ----------
function PrivacySection() {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finalOpen, setFinalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const resetFlow = () => {
    setConfirmOpen(false);
    setFinalOpen(false);
    setConfirmText("");
  };

  const downloadData = async () => {
    try {
      const { data: u, error: ue } = await supabase.auth.getUser();
      if (ue || !u.user) throw ue ?? new Error("Utente non disponibile");
      const [inv, ads] = await Promise.all([
        supabase.from("inventory_items").select("*").eq("user_id", u.user.id),
        supabase.from("ads").select("*").eq("user_id", u.user.id),
      ]);
      if (inv.error) throw inv.error;
      if (ads.error) throw ads.error;
      const blob = new Blob(
        [JSON.stringify({ exported_at: new Date().toISOString(), user: u.user.email, inventory: inv.data ?? [], ads: ads.data ?? [] }, null, 2)],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `viis-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Dati esportati");
    } catch (e) {
      toast.error("Esportazione fallita", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const goToFinalStep = () => {
    if (confirmText !== "ELIMINA") return;
    setConfirmOpen(false);
    setFinalOpen(true);
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: u, error: ue } = await supabase.auth.getUser();
      if (ue || !u.user) throw ue ?? new Error("Sessione non valida");
      // Clean up user-owned data (RLS scopes to current user)
      const [adsRes, invRes] = await Promise.all([
        supabase.from("ads").delete().eq("user_id", u.user.id),
        supabase.from("inventory_items").delete().eq("user_id", u.user.id),
      ]);
      if (adsRes.error) throw adsRes.error;
      if (invRes.error) throw invRes.error;
      await supabase.auth.signOut();
      toast.success("Account eliminato", { description: "I tuoi dati sono stati rimossi." });
      resetFlow();
      navigate({ to: "/auth" });
    } catch (e) {
      toast.error("Eliminazione fallita", {
        description: e instanceof Error ? e.message : "Riprova tra qualche istante.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-border bg-card p-6">
      <h2 className="text-lg font-semibold tracking-tight">Privacy e dati</h2>
      <p className="text-sm text-muted-foreground">Documenti legali e gestione dei tuoi dati personali.</p>

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {[
          { label: "Termini e Condizioni", href: "/legal/termini" },
          { label: "Cookie Policy", href: "/legal/cookie" },
          { label: "Condizioni d'uso", href: "/legal/uso" },
        ].map((l) => (
          <a
            key={l.label}
            href={l.href}
            className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-4 py-3 text-sm transition-colors hover:bg-muted"
          >
            {l.label}
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button variant="outline" onClick={downloadData}>
          <Download className="mr-2 h-4 w-4" /> Scarica i miei dati
        </Button>
        <Button variant="destructive" onClick={() => { setConfirmText(""); setConfirmOpen(true); }}>
          <Trash2 className="mr-2 h-4 w-4" /> Elimina account
        </Button>
      </div>

      {/* Step 1: type ELIMINA */}
      <Dialog open={confirmOpen} onOpenChange={(v) => { if (!v) resetFlow(); else setConfirmOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Elimina account — Passo 1 di 2
            </DialogTitle>
            <DialogDescription>
              Questa azione è irreversibile. Tutti i tuoi inventari, annunci e impostazioni saranno eliminati.
              Per continuare scrivi <strong>ELIMINA</strong> qui sotto.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="ELIMINA"
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={resetFlow}>Annulla</Button>
            <Button variant="destructive" disabled={confirmText !== "ELIMINA"} onClick={goToFinalStep}>
              Continua
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: final confirmation */}
      <Dialog open={finalOpen} onOpenChange={(v) => { if (!v && !deleting) resetFlow(); else setFinalOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Conferma finale — Passo 2 di 2
            </DialogTitle>
            <DialogDescription>
              Sei davvero sicuro? Verrai disconnesso e i tuoi dati saranno cancellati immediatamente.
              Questa operazione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Stai per eliminare definitivamente il tuo account Viis.
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={resetFlow} disabled={deleting}>Torna indietro</Button>
            <Button variant="destructive" onClick={deleteAccount} disabled={deleting}>
              {deleting ? "Eliminazione in corso…" : "Sì, elimina definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
