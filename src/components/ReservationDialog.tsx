import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isoDate } from "@/lib/format";
import { reservationErrorMessage } from "@/lib/reservation-rules";
import type { Database } from "@/integrations/supabase/types";

export type Reservation = Database["public"]["Tables"]["reservations"]["Row"];

export function ReservationDialog({ open, onOpenChange, reservation, walkIn }: {
  open: boolean; onOpenChange: (o: boolean) => void; reservation?: Reservation | null; walkIn?: boolean;
}) {
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();
  const now = new Date();
  const empty = { customer_name: "", customer_phone: "", party_size: 2, date: isoDate(now), time: "20:00", table_id: "", notes: "" };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (reservation) setF({ customer_name: reservation.customer_name, customer_phone: reservation.customer_phone, party_size: reservation.party_size, date: reservation.date, time: reservation.time.slice(0, 5), table_id: reservation.table_id ?? "", notes: reservation.notes ?? "" });
    else setF({ ...empty, time: walkIn ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` : "20:00" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reservation, walkIn]);

  const tables = useQuery({
    queryKey: ["available-tables", restaurant.id, f.date, f.time, f.party_size, reservation?.id],
    enabled: open && !!f.date && !!f.time && f.party_size > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_available_tables", { _rid: restaurant.id, _date: f.date, _time: f.time, _party: Number(f.party_size), _exclude: reservation?.id });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open || !f.table_id || !tables.data) return;
    if (!tables.data.some((t) => t.id === f.table_id)) setF((current) => ({ ...current, table_id: "" }));
  }, [open, f.table_id, tables.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = { ...f, table_id: f.table_id || null, notes: f.notes || null, party_size: Number(f.party_size) };
    let error;
    if (reservation) ({ error } = await supabase.from("reservations").update(payload).eq("id", reservation.id));
    else {
      const { data: c } = await supabase.from("customers").upsert({ restaurant_id: restaurant.id, name: f.customer_name, phone: f.customer_phone }, { onConflict: "restaurant_id,phone" }).select("id").single();
      ({ error } = await supabase.from("reservations").insert({ ...payload, restaurant_id: restaurant.id, customer_id: c?.id ?? null, source: walkIn ? "walk-in" : "manual", status: walkIn ? "arrived" : "confirmed" }));
    }
    setBusy(false);
    if (error) { toast.error(reservationErrorMessage(error.message)); return; }
    toast.success(reservation ? "Reserva atualizada." : `Reserva criada${payload.table_id ? "." : " com mesa atribuída automaticamente."}`);
    qc.invalidateQueries({ queryKey: ["reservations"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["available-tables"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{reservation ? "Editar reserva" : walkIn ? "Cliente sem reserva" : "Nova reserva"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2"><Label>Nome do cliente</Label><Input required value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} /></div>
          <div className="col-span-2 space-y-2"><Label>Telemóvel</Label><Input required type="tel" value={f.customer_phone} onChange={(e) => setF({ ...f, customer_phone: e.target.value })} /></div>
          <div className="space-y-2"><Label>Data</Label><Input required type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="space-y-2"><Label>Hora</Label><Input required type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
          <div className="space-y-2"><Label>Número de pessoas</Label><Input required type="number" min={1} value={f.party_size} onChange={(e) => setF({ ...f, party_size: Number(e.target.value) })} /></div>
          <div className="space-y-2"><Label>Mesa</Label>
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={f.table_id} onChange={(e) => setF({ ...f, table_id: e.target.value })}>
              <option value="">Automática</option>
              {tables.data?.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.seats} lug.)</option>)}
            </select>
          </div>
          <p className="col-span-2 -mt-2 text-xs text-muted-foreground">
            {tables.isLoading ? "A verificar mesas livres…" : tables.data?.length ? "Só aparecem mesas com lugares e horário livres. Em Automática, escolhemos a mais adequada." : "Sem mesas livres para estes dados. Experimente outra hora ou mesa."}
          </p>
          <div className="col-span-2 space-y-2"><Label>Observações</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <Button type="submit" className="col-span-2" disabled={busy}>{busy ? "A guardar…" : "Guardar"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
