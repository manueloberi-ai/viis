import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/uso")({
  head: () => ({
    meta: [
      { title: "Condizioni d'uso — Viis" },
      { name: "description", content: "Condizioni d'uso del servizio Viis." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsoPage,
});

function UsoPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-foreground">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Condizioni d'uso</h1>
      <p className="mt-2 text-sm text-muted-foreground">Ultimo aggiornamento: 10 luglio 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">Utilizzo del servizio</h2>
          <p>Viis è destinato alla gestione dell'inventario e degli annunci del singolo utente reseller. L'account non è condivisibile.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">Contenuti dell'utente</h2>
          <p>I dati inseriti (inventario, foto, annunci, contatti) restano di proprietà dell'utente. Viis li elabora al solo scopo di erogare il servizio.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">Comportamenti vietati</h2>
          <p>È vietato tentare di accedere a dati di altri utenti, effettuare reverse engineering o utilizzare il servizio per attività illegali.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">Sospensione</h2>
          <p>Viis può sospendere o chiudere account che violino le presenti Condizioni.</p>
        </section>
      </div>
    </div>
  );
}
