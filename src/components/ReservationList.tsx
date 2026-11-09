import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, MoreHorizontal, Phone, Users, StickyNote, UserX, X, Pencil, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReservationDialog, type Reservation } from "@/components/ReservationDialog";
import { STATUS_LABEL, STATUS_VARIANT, formatDate, formatTime, type ReservationStatus } from "@/lib/format";

export function ReservationList({ items, tables, showDate }: { items: Reservation[]; tables: Record<string, string>; showDate?: boolean }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Reservation | null>(null);

  async function setStatus(r: Reservation, status: ReservationStatus) {
    const { error } = await supabase.from("reservations").update({ status }).eq("id", r.id);
    if (error) return toast.error("Não foi possível atualizar.");
    toast.success(`Reserva: ${STATUS_LABEL[status]}`);
    qc.invalidateQueries({ queryKey: ["reservations"] });
  }

  if (!items.length)
    return <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">Sem reservas para este período.</div>;

  return (
    <>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-soft">
        {items.map((r) => (
          <li key={r.id} className="flex items-center gap-4 px-4 py-3.5">
            <div className="w-14 shrink-0 text-center">
              <p className="font-display text-xl font-medium">{formatTime(r.time)}</p>
              {showDate && <p className="text-[11px] text-muted-foreground">{formatDate(r.date).slice(0, 5)}</p>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold">{r.customer_name}</p>
                <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{r.party_size} pessoas</span>
                <a href={`tel:${r.customer_phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="h-3.5 w-3.5" />{r.customer_phone}</a>
                {r.table_id && <span>{tables[r.table_id] ?? "Mesa"}</span>}
                {r.notes && <span className="inline-flex items-center gap-1"><StickyNote className="h-3.5 w-3.5" />{r.notes}</span>}
              </div>
            </div>
            {(r.status === "confirmed" || r.status === "pending") && (
              <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={() => setStatus(r, "arrived")}><LogIn className="h-4 w-4" />Chegou</Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Ações"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEdit(r)}><Pencil />Editar</DropdownMenuItem>
                <DropdownMenuSeparator />
                {r.status === "pending" && <DropdownMenuItem onClick={() => setStatus(r, "confirmed")}><Check />Confirmar reserva</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => setStatus(r, "arrived")}><LogIn />Cliente chegou</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatus(r, "completed")}><Clock />Concluída</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatus(r, "no_show")}><UserX />Não compareceu</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => setStatus(r, "cancelled")}><X />Cancelar reserva</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
      <ReservationDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} reservation={edit} />
    </>
  );
}
