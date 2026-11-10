import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant, canManage } from "@/hooks/useRestaurant";
import { useReservations, useTables } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { isoDate } from "@/lib/format";

export const Route = createFileRoute("/_app/mesas")({
  head: () => ({ meta: [{ title: "Mesas — MesaGest" }, { name: "description", content: "Configurar mesas, lugares e áreas." }, { property: "og:title", content: "Mesas — MesaGest" }, { property: "og:description", content: "Configurar mesas, lugares e áreas." }] }),
  component: Mesas,
});

function Mesas() {
  const { restaurant, role } = useRestaurant();
  const qc = useQueryClient();
  const tables = useTables(restaurant.id);
  const today = isoDate(new Date());
  const res = useReservations(restaurant.id, today, today);
  const [n, setN] = useState({ name: "", seats: 2, area: "" });
  const edit = canManage(role);

  const refresh = () => qc.invalidateQueries({ queryKey: ["tables"] });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("tables").insert({ restaurant_id: restaurant.id, name: n.name, seats: n.seats, area: n.area || null });
    if (error) { toast.error("Não foi possível adicionar a mesa."); return; }
    setN({ name: "", seats: 2, area: "" }); refresh();
  }
  async function update(id: string, patch: { name?: string; seats?: number; area?: string | null; active?: boolean }) {
    await supabase.from("tables").update(patch).eq("id", id); refresh();
  }
  async function remove(id: string) {
    if (!confirm("Eliminar esta mesa?")) return;
    await supabase.from("tables").delete().eq("id", id); refresh();
  }

  const nowT = new Date().toTimeString().slice(0, 5);
  function state(id: string, active: boolean) {
    if (!active) return <Badge variant="muted">Indisponível</Badge>;
    const rs = (res.data ?? []).filter((r) => r.table_id === id);
    if (rs.some((r) => r.status === "arrived")) return <Badge variant="danger">Ocupada</Badge>;
    const nxt = rs.find((r) => ["confirmed", "pending"].includes(r.status) && r.time.slice(0, 5) >= nowT);
    if (nxt) return <Badge variant="warning">Reservada {nxt.time.slice(0, 5)}</Badge>;
    return <Badge variant="success">Disponível</Badge>;
  }

  const total = (tables.data ?? []).filter((t) => t.active).reduce((s, t) => s + t.seats, 0);

  return (
    <>
      <PageHeader title="Mesas" subtitle={`${tables.data?.length ?? 0} mesas · ${total} lugares ativos`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.data?.map((t) => (
          <div key={t.id} className="rounded-xl border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              {edit ? <Input defaultValue={t.name} onBlur={(e) => e.target.value !== t.name && update(t.id, { name: e.target.value })} className="h-8 font-semibold" /> : <p className="font-semibold">{t.name}</p>}
              {state(t.id, t.active)}
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Lugares</span>
              <Input type="number" min={1} disabled={!edit} defaultValue={t.seats} onBlur={(e) => Number(e.target.value) !== t.seats && update(t.id, { seats: Number(e.target.value) })} className="h-8 w-16" />
              <Input placeholder="Área" disabled={!edit} defaultValue={t.area ?? ""} onBlur={(e) => update(t.id, { area: e.target.value || null })} className="h-8 flex-1" />
            </div>
            {edit && (
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                <label className="flex items-center gap-2"><Switch checked={t.active} onCheckedChange={(v) => update(t.id, { active: v })} />Ativa</label>
                <Button size="icon" variant="ghost" onClick={() => remove(t.id)} aria-label="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            )}
          </div>
        ))}
      </div>
      {edit && (
        <form onSubmit={add} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-dashed bg-card p-4">
          <Input required placeholder="Nome (ex.: Mesa 7)" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} className="w-44" />
          <Input type="number" min={1} value={n.seats} onChange={(e) => setN({ ...n, seats: Number(e.target.value) })} className="w-20" />
          <Input placeholder="Área (opcional)" value={n.area} onChange={(e) => setN({ ...n, area: e.target.value })} className="w-40" />
          <Button type="submit"><Plus className="h-4 w-4" />Adicionar mesa</Button>
        </form>
      )}
    </>
  );
}
