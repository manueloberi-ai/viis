import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ReceiptText, Download, FileText, Copy, Inbox, Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { eur } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/registro-corrispettivi")({
  component: RegistroCorrispettiviPage,
});

const SOLD_STATES = ["Venduto spedito", "Venduto consegnato"];

type Row = {
  id: string;
  nome: string;
  categoria: string | null;
  piattaforma: string | null;
  prezzo: number;
  spedizione: number;
  totale: number;
  note: string | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function formatIT(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fileStamp(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}${m}${y}`;
}

function RegistroCorrispettiviPage() {
  const [date, setDate] = useState<string>(todayISO());

  const query = useQuery({
    queryKey: ["corrispettivi", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .in("stato_prodotto", SOLD_STATES)
        .or(`data_vendita.eq.${date},and(data_vendita.is.null,data_acquisto.eq.${date})`);
      if (error) throw error;
      const rows: Row[] = (data ?? []).map((it) => {
        const prezzo = Number(it.prezzo_vendita_valore ?? it.prezzo_vendita ?? 0);
        const sped = Number(it.costo_spedizione ?? it.costo_spedizione_valore ?? 0);
        return {
          id: it.id,
          nome: it.titolo || it.nome_oggetto || "—",
          categoria: it.categoria_prodotto || it.categoria || null,
          piattaforma: it.piattaforma_vendita,
          prezzo,
          spedizione: sped,
          totale: prezzo + sped,
          note: it.note,
        };
      });
      return rows;
    },
  });

  const rows = query.data ?? [];
  const totals = useMemo(() => {
    const incasso = rows.reduce((s, r) => s + r.prezzo, 0);
    const spedizioni = rows.reduce((s, r) => s + r.spedizione, 0);
    const totale = rows.reduce((s, r) => s + r.totale, 0);
    return { count: rows.length, incasso, spedizioni, totale };
  }, [rows]);

  const isToday = date === todayISO();
  const isYesterday = date === yesterdayISO();

  const copySummary = async () => {
    const text =
      `Registro Corrispettivi — ${formatIT(date)}\n` +
      `Articoli venduti: ${totals.count}\n` +
      `Incasso: ${eur(totals.incasso)}\n` +
      `Spedizioni: ${eur(totals.spedizioni)}\n` +
      `Totale lordo: ${eur(totals.totale)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Riepilogo copiato negli appunti");
    } catch {
      toast.error("Impossibile copiare");
    }
  };

  const exportCSV = () => {
    const header = ["#", "Nome", "Categoria", "Piattaforma", "Prezzo", "Spedizione", "Totale", "Note"];
    const lines = [header.join(";")];
    rows.forEach((r, i) => {
      lines.push([
        i + 1,
        `"${(r.nome ?? "").replaceAll('"', '""')}"`,
        r.categoria ?? "",
        r.piattaforma ?? "",
        r.prezzo.toFixed(2).replace(".", ","),
        r.spedizione.toFixed(2).replace(".", ","),
        r.totale.toFixed(2).replace(".", ","),
        `"${(r.note ?? "").replaceAll('"', '""')}"`,
      ].join(";"));
    });
    lines.push("");
    lines.push(`TOTALI;;;;${totals.incasso.toFixed(2).replace(".", ",")};${totals.spedizioni.toFixed(2).replace(".", ",")};${totals.totale.toFixed(2).replace(".", ",")};`);
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `corrispettivi_${fileStamp(date)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV esportato");
  };

  const downloadPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Dark header band
    doc.setFillColor(15, 17, 23);
    doc.rect(0, 0, pageWidth, 30, "F");
    doc.setFillColor(99, 102, 241);
    doc.roundedRect(14, 9, 12, 12, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("V", 18.2, 17.5);
    doc.setFontSize(15);
    doc.text("Viis — Registro Corrispettivi", 30, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(180, 184, 200);
    doc.text(`Data: ${formatIT(date)}`, 30, 23);

    autoTable(doc, {
      startY: 38,
      head: [["#", "Nome", "Categoria", "Piattaforma", "Prezzo", "Sped.", "Totale"]],
      body: rows.map((r, i) => [
        String(i + 1),
        r.nome,
        r.categoria ?? "—",
        r.piattaforma ?? "—",
        eur(r.prezzo),
        r.spedizione > 0 ? eur(r.spedizione) : "—",
        eur(r.totale),
      ]),
      headStyles: { fillColor: [26, 29, 38], textColor: 255, fontStyle: "bold" },
      bodyStyles: { fontSize: 9, textColor: [30, 30, 40] },
      alternateRowStyles: { fillColor: [245, 246, 250] },
      margin: { left: 14, right: 14 },
      columnStyles: {
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right", fontStyle: "bold" },
      },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Summary card
    doc.setFillColor(245, 246, 250);
    doc.roundedRect(14, finalY, pageWidth - 28, 32, 2, 2, "F");
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Riepilogo", 20, finalY + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Articoli venduti: ${totals.count}`, 20, finalY + 16);
    doc.text(`Incasso totale: ${eur(totals.incasso)}`, 20, finalY + 22);
    doc.text(`Costi spedizione: ${eur(totals.spedizioni)}`, 20, finalY + 28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.setFontSize(12);
    doc.text(`Totale lordo: ${eur(totals.totale)}`, pageWidth - 20, finalY + 22, { align: "right" });

    // Footer
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Generato da Viis il ${formatIT(todayISO())}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" },
    );

    doc.save(`corrispettivi_${fileStamp(date)}.pdf`);
    toast.success("PDF scaricato");
  };

  return (
    <div className="space-y-6 pb-32">
      {/* Top bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Registro Corrispettivi</h1>
              <p className="text-sm text-muted-foreground">Riepilogo vendite giornaliero (lordo)</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={isToday ? "default" : "ghost"}
            className="rounded-full"
            onClick={() => setDate(todayISO())}
          >
            Oggi
          </Button>
          <Button
            size="sm"
            variant={isYesterday ? "default" : "ghost"}
            className="rounded-full"
            onClick={() => setDate(yesterdayISO())}
          >
            Ieri
          </Button>
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-[170px] pl-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={rows.length === 0}>
            <Download className="h-4 w-4" /> Esporta CSV
          </Button>
          <Button size="sm" onClick={downloadPDF} disabled={rows.length === 0}>
            <FileText className="h-4 w-4" /> Scarica PDF
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Mostrando le vendite del <span className="font-semibold text-foreground">{formatIT(date)}</span>
      </p>

      {/* Table */}
      <Card className="overflow-hidden border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">#</TableHead>
                <TableHead>Nome Articolo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Piattaforma</TableHead>
                <TableHead className="text-right">Prezzo Vendita</TableHead>
                <TableHead className="text-right">Costo Spedizione</TableHead>
                <TableHead className="text-right">Totale</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, c) => (
                      <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
                        <Inbox className="h-6 w-6" />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Nessuna vendita registrata per il <span className="font-medium text-foreground">{formatIT(date)}</span>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/inventory">Vai all'inventario</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow
                    key={r.id}
                    className="odd:bg-[#0F1117] even:bg-[#1A1D26] hover:bg-secondary/40"
                  >
                    <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>
                      {r.categoria ? (
                        <Badge variant="outline" className="border-border bg-secondary/40">{r.categoria}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{r.piattaforma ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(r.prezzo)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{r.spedizione > 0 ? eur(r.spedizione) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-emerald-400">{eur(r.totale)}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">{r.note ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Sticky summary footer */}
      <div className="fixed inset-x-0 bottom-0 z-30 md:pl-64">
        <div className="mx-auto w-full max-w-[1400px] px-4 pb-4 md:px-8">
          <Card className="border-t-2 border-t-primary bg-[#1A1D26] p-4 shadow-2xl">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <SummaryItem label="Articoli Venduti" value={String(totals.count)} />
              <SummaryItem label="Incasso Totale" value={eur(totals.incasso)} bold />
              <SummaryItem label="Costi Spedizione" value={eur(totals.spedizioni)} />
              <SummaryItem label="Totale Lordo" value={eur(totals.totale)} tone="emerald" big />
            </div>
            <div className="mt-3 flex justify-end border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={copySummary} disabled={rows.length === 0}>
                <Copy className="h-4 w-4" /> Copia riepilogo
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({
  label, value, bold, big, tone,
}: { label: string; value: string; bold?: boolean; big?: boolean; tone?: "rose" | "emerald" }) {
  const color =
    tone === "rose" ? "text-rose-400" :
    tone === "emerald" ? "text-emerald-400" : "text-foreground";
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={[
        "mt-1 tabular-nums",
        big ? "text-2xl" : "text-lg",
        bold || big ? "font-bold" : "font-semibold",
        color,
      ].join(" ")}>
        {value}
      </div>
    </div>
  );
}
