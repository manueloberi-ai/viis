import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";

const PLATFORM_LIMITS: Record<string, { name: string; titleLimit: number; descriptionLimit: number; tone: string }> = {
  ebay: { name: "eBay", titleLimit: 80, descriptionLimit: 1200, tone: "tecnico, dettagliato, parole-chiave cercabili (brand, modello, anno, condizione, lingua, EAN/PAL/NTSC)" },
  vinted: { name: "Vinted", titleLimit: 50, descriptionLimit: 800, tone: "amichevole e diretto, focus su condizioni e stile, hashtag se utili" },
  subito: { name: "Subito", titleLimit: 50, descriptionLimit: 600, tone: "chiaro e local-friendly, indicare città/spedizione" },
  wallapop: { name: "Wallapop", titleLimit: 60, descriptionLimit: 640, tone: "informale, mobile-first, conciso" },
  cardmarket: { name: "Cardmarket", titleLimit: 60, descriptionLimit: 600, tone: "tecnico per collezionisti: set, rarità, lingua, condizione (NM/EX/GD)" },
};

const optimizeSchema = z.object({
  rawTitle: z.string().min(1).max(500),
  rawDescription: z.string().max(5000).optional().default(""),
  platform: z.enum(["ebay", "vinted", "subito", "wallapop", "cardmarket"]),
  categoria: z.string().optional().default(""),
});

export const optimizeListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => optimizeSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY mancante");

    const cfg = PLATFORM_LIMITS[data.platform];
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const system = `Sei un esperto di SEO per marketplace italiani ed europei e copywriter per resellers (videogiochi vintage, console, carte collezionabili).
Per la piattaforma ${cfg.name} ottimizza titolo e descrizione di un annuncio in italiano.

REGOLE TITOLO:
- Limite assoluto ${cfg.titleLimit} caratteri (RISPETTALO sempre, non andare oltre)
- Front-load: marca/brand, modello, edizione/anno, condizione, lingua all'inizio
- Niente emoji, niente ALL-CAPS gratuito, niente "WOW!!!"
- Tono: ${cfg.tone}
- Parole-chiave realmente cercate dagli acquirenti (no keyword stuffing)

REGOLE DESCRIZIONE:
- Limite consigliato ${cfg.descriptionLimit} caratteri
- Struttura: 1) hook con benefit, 2) dettagli prodotto/condizioni, 3) accessori inclusi, 4) spedizione/pagamento, 5) call to action
- Italiano corretto, frasi brevi, scansionabile

OUTPUT: JSON con i campi richiesti, niente testo extra.`;

    const userMsg = `Categoria: ${data.categoria || "non specificata"}
Titolo grezzo: "${data.rawTitle}"
Descrizione grezza: "${data.rawDescription || "(vuota — generala dal titolo)"}"

Restituisci JSON con:
- title: titolo ottimizzato per ${cfg.name} entro ${cfg.titleLimit} caratteri
- description: descrizione ottimizzata per ${cfg.name} entro ${cfg.descriptionLimit} caratteri
- keywords: array di 5-10 parole chiave ordinate per importanza decrescente
- score: punteggio SEO 0-100
- rationale: 1-2 frasi brevi che spiegano le scelte`;

    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt: userMsg,
      experimental_output: Output.object({
        schema: z.object({
          title: z.string(),
          description: z.string(),
          keywords: z.array(z.string()),
          score: z.number().min(0).max(100),
          rationale: z.string(),
        }),
      }),
    });

    // Hard-enforce title limit
    let title = experimental_output.title.trim();
    if (title.length > cfg.titleLimit) {
      title = title.slice(0, cfg.titleLimit - 1).trimEnd() + "…";
    }

    return {
      ...experimental_output,
      title,
      platform: data.platform,
      titleLimit: cfg.titleLimit,
      descriptionLimit: cfg.descriptionLimit,
    };
  });
