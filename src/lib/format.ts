export const eur = (n: number | null | undefined) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 })
    .format(Number(n ?? 0));

export const pct = (n: number | null | undefined, digits = 1) =>
  `${(Number(n ?? 0)).toFixed(digits)}%`;

export const num = (n: number | null | undefined) =>
  new Intl.NumberFormat("it-IT").format(Number(n ?? 0));
