import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  const signIn = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Errore di accesso", { description: result.error.message });
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/home", replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center px-4">
      {/* glow */}
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_top,oklch(0.62_0.21_275_/_0.18),transparent_60%)]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-lg shadow-primary/30">V</div>
            <span className="text-2xl font-bold tracking-tight">Viis</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Bentornato</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Il CRM per reseller multi-piattaforma.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur shadow-xl shadow-black/30">
          <Button
            onClick={signIn}
            disabled={loading}
            className="w-full h-12 gap-3 bg-white text-zinc-900 hover:bg-zinc-100"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
            )}
            <span className="font-semibold">Continua con Google</span>
          </Button>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Accedendo accetti i nostri Termini e la Privacy Policy.
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Nessuna carta richiesta · Trial 14 giorni del piano Pro Flipper
        </p>
      </div>
    </div>
  );
}
