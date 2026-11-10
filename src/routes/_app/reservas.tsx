import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useReservations, useTableNames } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { ReservationList } from "@/components/ReservationList";
import { ReservationDialog } from "@/components/ReservationDialog";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, addDays, formatDate, isoDate, type ReservationStatus } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/reservas")({
  head: () => ({ meta: [{ title: "Reservas — MesaGest" }, { name: "description", content: "Gerir reservas por dia, semana ou mês." }, { property: "og:title", content: "Reservas — MesaGest" }, { property: "og:description", content: "Gerir reservas por dia, semana ou mês." }] }),
  component: Reservas,
});

type View = "day" | "week" | "month";

function range(anchor: Date, view: View) {
  if (view === "day") return [anchor, anchor];
  if (view === "week") { const s = addDays(anchor, -((anchor.getDay() + 6) % 7)); return [s, addDays(s, 6)]; }
  return [new Date(anchor.getFullYear(), anchor.getMonth(), 1), new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)];
}

function Reservas() {
  const { restaurant } = useRestaurant();
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState(new Date());
  const [status, setStatus] = useState<ReservationStatus | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [from, to] = range(anchor, view) as [Date, Date];
  const res = useReservations(restaurant.id, isoDate(from), isoDate(to));
  const tables = useTableNames(restaurant.id);

  const step = (n: number) => setAnchor(view === "day" ? addDays(anchor, n) : view === "week" ? addDays(anchor, 7 * n) : new Date(anchor.getFullYear(), anchor.getMonth() + n, 1));
  const items = (res.data ?? []).filter((r) => (status === "all" || r.status === status) && (!q || r.customer_name.toLowerCase().includes(q.toLowerCase()) || r.customer_phone.includes(q)));
  const label = view === "month" ? anchor.toLocaleDateString("pt-PT", { month: "long", year: "numeric" }) : view === "week" ? `${formatDate(isoDate(from))} – ${formatDate(isoDate(to))}` : formatDate(isoDate(from));

  return (
    <>
      <PageHeader title="Reservas" actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Nova reserva</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border bg-card p-0.5 text-sm">
          {([["day", "Dia"], ["week", "Semana"], ["month", "Mês"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={cn("rounded-md px-3 py-1", view === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => step(-1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-36 text-center text-sm font-semibold first-letter:uppercase">{label}</span>
          <Button size="icon" variant="ghost" onClick={() => step(1)} aria-label="Seguinte"><ChevronRight className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())}>Hoje</Button>
        </div>
        <select className="h-9 rounded-md border bg-card px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value as ReservationStatus | "all")}>
          <option value="all">Todos os estados</option>
          {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input placeholder="Pesquisar nome ou telemóvel" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 flex-1 rounded-md border bg-card px-3 text-sm sm:max-w-64" />
      </div>
      {res.isLoading ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : <ReservationList items={items} tables={tables} showDate={view !== "day"} />}
      <ReservationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
