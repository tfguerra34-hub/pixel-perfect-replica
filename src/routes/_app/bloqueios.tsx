import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useTables } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatTime, isoDate } from "@/lib/format";

export const Route = createFileRoute("/_app/bloqueios")({
  head: () => ({ meta: [{ title: "Bloqueios — MesaGest" }, { name: "description", content: "Bloquear dias, serviços, horários e mesas." }, { property: "og:title", content: "Bloqueios — MesaGest" }, { property: "og:description", content: "Bloquear dias, serviços, horários e mesas." }] }),
  component: Bloqueios,
});

const PRESETS = { day: ["", ""], lunch: ["12:00", "16:00"], dinner: ["18:00", "23:59"], custom: ["", ""] } as const;

function Bloqueios() {
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();
  const tables = useTables(restaurant.id);
  const [f, setF] = useState({ date: isoDate(new Date()), until: "", kind: "day" as keyof typeof PRESETS, start: "", end: "", table_id: "", reason: "" });

  const list = useQuery({
    queryKey: ["blocks", restaurant.id],
    queryFn: async () => (await supabase.from("blocked_periods").select("*").eq("restaurant_id", restaurant.id).gte("date", isoDate(new Date())).order("date")).data ?? [],
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const [ps, pe] = PRESETS[f.kind];
    const start = f.kind === "custom" ? f.start : ps;
    const end = f.kind === "custom" ? f.end : pe;
    if (f.kind === "custom" && (!start || !end || start >= end)) { toast.error("Indique um intervalo de horas válido."); return; }
    const dates: string[] = [];
    const d = new Date(f.date);
    const last = new Date(f.until || f.date);
    while (d <= last && dates.length < 120) { dates.push(isoDate(d)); d.setDate(d.getDate() + 1); }
    const { error } = await supabase.from("blocked_periods").insert(dates.map((date) => ({
      restaurant_id: restaurant.id, date, start_time: start || null, end_time: end || null, table_id: f.table_id || null, reason: f.reason || null,
    })));
    if (error) { toast.error("Não foi possível criar o bloqueio."); return; }
    toast.success("Bloqueio criado."); qc.invalidateQueries({ queryKey: ["blocks"] });
  }
  async function remove(id: string) {
    await supabase.from("blocked_periods").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["blocks"] });
  }
  const tname = (id: string | null) => tables.data?.find((t) => t.id === id)?.name;

  return (
    <>
      <PageHeader title="Bloqueios" subtitle="Feche reservas para dias, serviços, horas ou mesas específicas." />
      <form onSubmit={add} className="grid gap-4 rounded-xl border bg-card p-5 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2"><Label>De</Label><Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div className="space-y-2"><Label>Até (encerramento temporário)</Label><Input type="date" value={f.until} min={f.date} onChange={(e) => setF({ ...f, until: e.target.value })} /></div>
        <div className="space-y-2"><Label>O quê</Label>
          <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as keyof typeof PRESETS })}>
            <option value="day">Dia completo</option><option value="lunch">Almoço</option><option value="dinner">Jantar</option><option value="custom">Horário personalizado</option>
          </select>
        </div>
        <div className="space-y-2"><Label>Mesa</Label>
          <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={f.table_id} onChange={(e) => setF({ ...f, table_id: e.target.value })}>
            <option value="">Todo o restaurante</option>
            {tables.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        {f.kind === "custom" && <>
          <div className="space-y-2"><Label>Das</Label><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div>
          <div className="space-y-2"><Label>Às</Label><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div>
        </>}
        <div className="space-y-2 sm:col-span-2"><Label>Motivo</Label><Input placeholder="Ex.: Evento privado, férias…" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
        <div className="flex items-end"><Button type="submit" className="w-full"><Ban className="h-4 w-4" />Bloquear</Button></div>
      </form>

      <h2 className="mb-3 mt-8 text-xl font-medium">Próximos bloqueios</h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-soft">
        {list.data?.map((b) => (
          <li key={b.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            <span className="font-semibold">{formatDate(b.date)}</span>
            <span>{b.start_time ? `${formatTime(b.start_time)}–${formatTime(b.end_time!)}` : "Dia completo"}</span>
            {b.table_id && <span className="text-muted-foreground">{tname(b.table_id)}</span>}
            <span className="flex-1 truncate text-muted-foreground">{b.reason}</span>
            <Button size="icon" variant="ghost" onClick={() => remove(b.id)} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
          </li>
        ))}
        {!list.data?.length && <li className="p-8 text-center text-sm text-muted-foreground">Sem bloqueios agendados.</li>}
      </ul>
    </>
  );
}
