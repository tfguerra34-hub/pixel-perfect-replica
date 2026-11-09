import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant, canManage } from "@/hooks/useRestaurant";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, STATUS_VARIANT, formatDate, formatTime } from "@/lib/format";

export const Route = createFileRoute("/_app/clientes")({
  head: () => ({ meta: [{ title: "Clientes — MesaGest" }, { name: "description", content: "Histórico e notas dos clientes." }, { property: "og:title", content: "Clientes — MesaGest" }, { property: "og:description", content: "Histórico e notas dos clientes." }] }),
  component: Clientes,
});

function Clientes() {
  const { restaurant, role } = useRestaurant();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["customers", restaurant.id],
    queryFn: async () => (await supabase.from("customers").select("*, reservations(id, date)").eq("restaurant_id", restaurant.id).order("name")).data ?? [],
  });
  const current = list.data?.find((c) => c.id === sel);
  const history = useQuery({
    queryKey: ["customer-history", sel],
    enabled: !!sel,
    queryFn: async () => (await supabase.from("reservations").select("*").eq("customer_id", sel!).order("date", { ascending: false })).data ?? [],
  });

  const items = (list.data ?? []).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q));

  async function save(patch: { name?: string; phone?: string; notes?: string }) {
    const { error } = await supabase.from("customers").update(patch).eq("id", sel!);
    if (error) return toast.error("Não foi possível guardar.");
    toast.success("Cliente atualizado."); qc.invalidateQueries({ queryKey: ["customers"] });
  }
  async function erase() {
    if (!confirm("Eliminar os dados pessoais deste cliente? As reservas ficam anonimizadas.")) return;
    await supabase.from("reservations").update({ customer_name: "Cliente removido", customer_phone: "—", notes: null }).eq("customer_id", sel!);
    await supabase.from("customers").delete().eq("id", sel!);
    setSel(null); toast.success("Dados eliminados."); qc.invalidateQueries();
  }

  return (
    <>
      <PageHeader title="Clientes" subtitle={`${list.data?.length ?? 0} clientes`} />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar clientes" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-soft">
        {items.map((c) => {
          const last = c.reservations.map((r) => r.date).sort().at(-1);
          return (
            <li key={c.id}>
              <button onClick={() => setSel(c.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted/50">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent font-semibold text-accent-foreground">{c.name[0]?.toUpperCase()}</span>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">{c.phone}</p></div>
                <div className="text-right text-xs text-muted-foreground"><p>{c.reservations.length} reservas</p>{last && <p>Última: {formatDate(last)}</p>}</div>
              </button>
            </li>
          );
        })}
        {!items.length && <li className="p-10 text-center text-sm text-muted-foreground">Sem clientes.</li>}
      </ul>

      <Sheet open={!!current} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="overflow-y-auto">
          {current && (
            <>
              <SheetHeader><SheetTitle className="font-display text-2xl">{current.name}</SheetTitle></SheetHeader>
              <div className="space-y-3 px-4">
                <Input defaultValue={current.name} onBlur={(e) => e.target.value !== current.name && save({ name: e.target.value })} />
                <Input defaultValue={current.phone} onBlur={(e) => e.target.value !== current.phone && save({ phone: e.target.value })} />
                <Textarea placeholder="Notas internas (preferências, alergias…)" defaultValue={current.notes ?? ""} onBlur={(e) => save({ notes: e.target.value })} />
                <h3 className="pt-3 text-lg font-medium">Histórico</h3>
                <ul className="space-y-2">
                  {history.data?.map((r) => (
                    <li key={r.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                      <span>{formatDate(r.date)} · {formatTime(r.time)} · {r.party_size} p.</span>
                      <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </li>
                  ))}
                </ul>
                {canManage(role) && <Button variant="outline" className="w-full text-destructive" onClick={erase}><Trash2 className="h-4 w-4" />Eliminar dados pessoais</Button>}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
