import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarCheck, Clock, Plus, UserPlus, Users, CalendarRange } from "lucide-react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useReservations, useTableNames } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { ReservationList } from "@/components/ReservationList";
import { ReservationDialog } from "@/components/ReservationDialog";
import { Button } from "@/components/ui/button";
import { addDays, formatLongDate, isoDate, serviceOf } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/painel")({
  head: () => ({ meta: [{ title: "Painel — MesaGest" }, { name: "description", content: "Resumo das reservas do dia." }, { property: "og:title", content: "Painel — MesaGest" }, { property: "og:description", content: "Resumo das reservas do dia." }] }),
  component: Painel,
});

const ACTIVE = ["pending", "confirmed", "arrived"];

function Painel() {
  const { restaurant } = useRestaurant();
  const today = isoDate(new Date());
  const weekEnd = isoDate(addDays(new Date(), 6));
  const res = useReservations(restaurant.id, today, weekEnd);
  const tables = useTableNames(restaurant.id);
  const [open, setOpen] = useState<null | "new" | "walk">(null);
  const [service, setService] = useState<"all" | "lunch" | "dinner">("all");

  const all = res.data ?? [];
  const todays = all.filter((r) => r.date === today);
  const live = todays.filter((r) => ACTIVE.includes(r.status));
  const nowT = new Date().toTimeString().slice(0, 5);
  const stats = [
    { label: "Reservas de hoje", value: live.length, icon: CalendarCheck, tone: "bg-success-soft text-success" },
    { label: "Pessoas previstas", value: live.reduce((s, r) => s + r.party_size, 0), icon: Users, tone: "bg-info-soft text-info" },
    { label: "Pendentes", value: all.filter((r) => r.status === "pending").length, icon: Clock, tone: "bg-warning-soft text-warning" },
    { label: "Total da semana", value: all.filter((r) => ACTIVE.includes(r.status) || r.status === "completed").length, icon: CalendarRange, tone: "bg-muted text-foreground" },
  ];
  const shown = todays.filter((r) => service === "all" || serviceOf(r.time) === service);
  const next = live.find((r) => r.time.slice(0, 5) >= nowT);

  return (
    <>
      <PageHeader title="Hoje" subtitle={formatLongDate(today)} actions={<>
        <Button variant="outline" onClick={() => setOpen("walk")}><UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Sem reserva</span></Button>
        <Button onClick={() => setOpen("new")}><Plus className="h-4 w-4" />Nova reserva</Button>
      </>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4 shadow-soft">
            <span className={cn("grid h-9 w-9 place-items-center rounded-lg", s.tone)}><s.icon className="h-4 w-4" /></span>
            <p className="mt-3 font-display text-3xl font-medium">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {next && (
        <div className="mt-4 rounded-xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          Próxima reserva: <strong>{next.time.slice(0, 5)}</strong> · {next.customer_name} · {next.party_size} pessoas
        </div>
      )}

      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="text-xl font-medium">Reservas de hoje</h2>
        <div className="flex rounded-lg border bg-card p-0.5 text-sm">
          {([["all", "Todas"], ["lunch", "Almoço"], ["dinner", "Jantar"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setService(k)} className={cn("rounded-md px-3 py-1", service === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{l}</button>
          ))}
        </div>
      </div>
      {res.isLoading ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : <ReservationList items={shown} tables={tables} />}

      <ReservationDialog open={!!open} walkIn={open === "walk"} onOpenChange={(o) => !o && setOpen(null)} />
    </>
  );
}
