export type PlatformKey = "ebay" | "vinted" | "subito" | "wallapop" | "cardmarket";

export const PLATFORMS: Record<
  PlatformKey,
  {
    key: PlatformKey;
    name: string;
    short: string; // sigle: V|S|EB|MP|CM style
    color: string; // hex for badges/charts
    initial: string;
    titleLimit: number;
    descriptionLimit: number;
    links: { label: string; url: string }[];
  }
> = {
  ebay: {
    key: "ebay",
    name: "eBay",
    short: "EB",
    color: "#E53238",
    initial: "E",
    titleLimit: 80,
    descriptionLimit: 4000,
    links: [
      { label: "Home eBay", url: "https://www.ebay.it/" },
      { label: "Miei Annunci", url: "https://www.ebay.it/mye/myebay/v2/summary" },
      { label: "Miei Ordini (vendite)", url: "https://www.ebay.it/sh/ord" },
      { label: "Miei Acquisti", url: "https://www.ebay.it/mye/myebay/purchase" },
      { label: "Messaggi", url: "https://www.ebay.it/mye/myebay/messages" },
      { label: "Saldo e Pagamenti", url: "https://www.ebay.it/sh/fin/summary" },
      { label: "Feedback ricevuti", url: "https://www.ebay.it/fdbk/feedback_profile" },
      { label: "Impostazioni account", url: "https://accountsettings.ebay.it/" },
    ],
  },
  vinted: {
    key: "vinted",
    name: "Vinted",
    short: "V",
    color: "#09B1BA",
    initial: "V",
    titleLimit: 50,
    descriptionLimit: 1500,
    links: [
      { label: "Home", url: "https://www.vinted.it/" },
      { label: "Mio Armadio", url: "https://www.vinted.it/member/items" },
      { label: "Ordini", url: "https://www.vinted.it/transactions/orders/current" },
      { label: "Messaggi", url: "https://www.vinted.it/inbox" },
      { label: "Saldo", url: "https://www.vinted.it/wallet" },
      { label: "Recensioni", url: "https://www.vinted.it/member/feedback" },
      { label: "Impostazioni", url: "https://www.vinted.it/settings/profile" },
    ],
  },
  subito: {
    key: "subito",
    name: "Subito",
    short: "S",
    color: "#E4002B",
    initial: "S",
    titleLimit: 50,
    descriptionLimit: 1000,
    links: [
      { label: "Home", url: "https://www.subito.it/" },
      { label: "Miei Annunci", url: "https://www.subito.it/pro/area-utenti/inserzioni" },
      { label: "Messaggi", url: "https://www.subito.it/pro/area-utenti/messaggi" },
      { label: "Il mio Subito", url: "https://www.subito.it/pro/area-utenti" },
      { label: "Impostazioni", url: "https://www.subito.it/pro/area-utenti/profilo" },
    ],
  },
  wallapop: {
    key: "wallapop",
    name: "Wallapop",
    short: "W",
    color: "#13C1AC",
    initial: "W",
    titleLimit: 60,
    descriptionLimit: 640,
    links: [
      { label: "Home", url: "https://it.wallapop.com/" },
      { label: "Miei Prodotti", url: "https://it.wallapop.com/app/catalog/published" },
      { label: "Chat", url: "https://it.wallapop.com/app/chat" },
      { label: "Saldo", url: "https://it.wallapop.com/app/wallet" },
      { label: "Impostazioni", url: "https://it.wallapop.com/app/settings" },
    ],
  },
  cardmarket: {
    key: "cardmarket",
    name: "Cardmarket",
    short: "CM",
    color: "#012169",
    initial: "C",
    titleLimit: 60,
    descriptionLimit: 1000,
    links: [
      { label: "Home", url: "https://www.cardmarket.com/it" },
      { label: "I miei articoli", url: "https://www.cardmarket.com/it/Magic/MyAccount/Stock" },
      { label: "Ordini", url: "https://www.cardmarket.com/it/Magic/MyAccount/Orders/Purchases" },
      { label: "Messaggi", url: "https://www.cardmarket.com/it/Magic/MyAccount/Conversations" },
      { label: "Account", url: "https://www.cardmarket.com/it/Magic/MyAccount/Profile" },
    ],
  },
};

export const PLATFORM_LIST = Object.values(PLATFORMS);
