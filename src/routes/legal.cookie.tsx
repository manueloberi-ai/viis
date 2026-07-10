import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/cookie")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — Viis" },
      { name: "description", content: "Informativa sui cookie utilizzati dal servizio Viis." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CookiePage,
});

function CookiePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-foreground">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Cookie Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Ultimo aggiornamento: 10 luglio 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">Cosa sono i cookie</h2>
          <p>I cookie sono piccoli file di testo memorizzati sul tuo dispositivo per far funzionare o migliorare il servizio.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">Cookie tecnici</h2>
          <p>Viis utilizza cookie tecnici e di sessione strettamente necessari per l'autenticazione e il funzionamento della piattaforma. Non richiedono consenso.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">Cookie di terze parti</h2>
          <p>Alcuni provider (autenticazione Google, hosting) possono impostare cookie propri. Consulta le rispettive informative per dettagli.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">Gestione</h2>
          <p>Puoi disabilitare i cookie dal tuo browser, tenendo presente che alcune funzionalità potrebbero non essere disponibili.</p>
        </section>
      </div>
    </div>
  );
}
