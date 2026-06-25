export type Stato =
  | "acquistato"
  | "acquistato_ritirato"
  | "in_spedizione"
  | "venduto"
  | "venduto_consegnato"
  | "reso";

export const STATI: { value: Stato; label: string; className: string; dot: string }[] = [
  { value: "acquistato",           label: "Acquistato",           className: "bg-warning/15 text-warning border border-warning/30", dot: "bg-warning" },
  { value: "acquistato_ritirato",  label: "Acquistato · Ritirato",className: "bg-amber-500/15 text-amber-400 border border-amber-500/30", dot: "bg-amber-500" },
  { value: "in_spedizione",        label: "In Spedizione",        className: "bg-info/15 text-info border border-info/30", dot: "bg-info" },
  { value: "venduto",              label: "Venduto",              className: "bg-success/15 text-success border border-success/30", dot: "bg-success" },
  { value: "venduto_consegnato",   label: "Venduto · Consegnato", className: "bg-emerald-600/20 text-emerald-300 border border-emerald-600/40", dot: "bg-emerald-500" },
  { value: "reso",                 label: "Reso",                 className: "bg-destructive/15 text-destructive border border-destructive/30", dot: "bg-destructive" },
];

export const statoMap = Object.fromEntries(STATI.map((s) => [s.value, s])) as Record<Stato, (typeof STATI)[number]>;

export const CATEGORIE = ["Videogiochi", "Console", "Carte Collezionabili", "Accessori", "Altro"] as const;
export type Categoria = (typeof CATEGORIE)[number];
