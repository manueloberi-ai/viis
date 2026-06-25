export type PlatformKey = "ebay" | "vinted" | "subito" | "wallapop" | "cardmarket";

export const PLATFORMS: Record<
  PlatformKey,
  {
    key: PlatformKey;
    name: string;
    color: string; // hex for badges/charts
    initial: string;
    titleLimit: number;
    links: { label: string; url: string }[];
  }
> = {
  ebay: {
    key: "ebay",
    name: "eBay",
    color: "#E53238",
    initial: "E",
    titleLimit: 80,
    links: [
      { label: "Home eBay", url: "https://www.ebay.it/" },
      { label: "Miei Annunci", url: "https://www.ebay.it/mye/myebay/summary" },
      { label: "Miei Ordini (vendite)", url: "https://www.ebay.it/mesh/ord/sold" },
      { label: "Miei Acquisti", url: "https://www.ebay.it/mesh/ord/purchase" },
      { label: "Messaggi", url: "https://mesg.ebay.it/mesgweb/ViewMessages/0" },
      { label: "Saldo e Pagamenti", url: "https://www.ebay.it/sh/fin/summary" },
      { label: "Feedback ricevuti", url: "https://www.ebay.it/fdbk/feedback_profile" },
      { label: "Impostazioni account", url: "https://accountsettings.ebay.it/" },
    ],
  },
  vinted: {
    key: "vinted",
    name: "Vinted",
    color: "#09B1BA",
    initial: "V",
    titleLimit: 50,
    links: [
      { label: "Home", url: "https://www.vinted.it/" },
      { label: "Mio Armadio", url: "https://www.vinted.it/member/general/personalisation" },
      { label: "Ordini", url: "https://www.vinted.it/inbox" },
      { label: "Messaggi", url: "https://www.vinted.it/inbox" },
      { label: "Saldo", url: "https://www.vinted.it/wallet" },
      { label: "Recensioni", url: "https://www.vinted.it/member/feedback" },
      { label: "Impostazioni", url: "https://www.vinted.it/member/general/personal_information" },
    ],
  },
  subito: {
    key: "subito",
    name: "Subito",
    color: "#E4002B",
    initial: "S",
    titleLimit: 50,
    links: [
      { label: "Home", url: "https://www.subito.it/" },
      { label: "Miei Annunci", url: "https://www.subito.it/area-personale/inserzioni" },
      { label: "Messaggi", url: "https://www.subito.it/area-personale/messaggi" },
      { label: "Il mio Subito", url: "https://www.subito.it/area-personale" },
      { label: "Impostazioni", url: "https://www.subito.it/area-personale/profilo" },
    ],
  },
  wallapop: {
    key: "wallapop",
    name: "Wallapop",
    color: "#13C1AC",
    initial: "W",
    titleLimit: 60,
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
    color: "#012169",
    initial: "C",
    titleLimit: 60,
    links: [
      { label: "Home", url: "https://www.cardmarket.com/it" },
      { label: "I miei articoli", url: "https://www.cardmarket.com/it/Magic/MyAccount/Stock" },
      { label: "Ordini", url: "https://www.cardmarket.com/it/Magic/MyAccount/Orders" },
      { label: "Messaggi", url: "https://www.cardmarket.com/it/Magic/MyAccount/Messages" },
      { label: "Account", url: "https://www.cardmarket.com/it/Magic/MyAccount" },
    ],
  },
};

export const PLATFORM_LIST = Object.values(PLATFORMS);
