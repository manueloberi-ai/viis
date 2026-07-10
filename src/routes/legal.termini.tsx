import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/termini")({
  head: () => ({
    meta: [
      { title: "Termini e Condizioni — Viis" },
      { name: "description", content: "Termini e Condizioni d'uso del servizio Viis." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TerminiPage,
});

function TerminiPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-foreground">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Termini e Condizioni</h1>
      <p className="mt-2 text-sm text-muted-foreground">Ultimo aggiornamento: 10 luglio 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Oggetto</h2>
          <p>Viis è un CRM per reseller multi-piattaforma. Utilizzando il servizio l'utente accetta i presenti Termini.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">2. Account</h2>
          <p>L'utente è responsabile della sicurezza delle proprie credenziali e delle attività svolte tramite il proprio account.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Uso consentito</h2>
          <p>È vietato utilizzare Viis per attività illecite o in violazione dei termini delle piattaforme di terze parti collegate.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Limitazione di responsabilità</h2>
          <p>Il servizio è fornito "così com'è". Viis non è responsabile per perdite di dati, mancati guadagni o interruzioni.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Modifiche</h2>
          <p>I presenti Termini possono essere aggiornati. Le modifiche entrano in vigore dalla pubblicazione su questa pagina.</p>
        </section>
      </div>
    </div>
  );
}
