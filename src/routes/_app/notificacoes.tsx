import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — MesaGest" }, { name: "description", content: "Novas reservas, cancelamentos e alterações." }, { property: "og:title", content: "Notificações — MesaGest" }, { property: "og:description", content: "Novas reservas, cancelamentos e alterações." }] }),
  component: Notificacoes,
});

function Notificacoes() {
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["notifications", restaurant.id],
    queryFn: async () => (await supabase.from("notifications").select("*").eq("restaurant_id", restaurant.id).order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["notifications"] }); qc.invalidateQueries({ queryKey: ["unread"] }); };
  async function markAll() { await supabase.from("notifications").update({ read: true }).eq("restaurant_id", restaurant.id).eq("read", false); refresh(); }
  async function mark(id: string) { await supabase.from("notifications").update({ read: true }).eq("id", id); refresh(); }
  async function enableBrowser() {
    if (typeof Notification === "undefined") return;
    await Notification.requestPermission();
    qc.invalidateQueries();
  }
  const perm = typeof Notification !== "undefined" ? Notification.permission : "denied";

  return (
    <>
      <PageHeader title="Notificações" actions={<Button variant="outline" onClick={markAll}><CheckCheck className="h-4 w-4" />Marcar todas como lidas</Button>} />
      {perm === "default" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          <span>Ative os alertas deste dispositivo para ser avisado de novas reservas.</span>
          <Button size="sm" onClick={enableBrowser}><BellRing className="h-4 w-4" />Ativar alertas</Button>
        </div>
      )}
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-soft">
        {list.data?.map((n) => (
          <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3.5", !n.read && "bg-accent/40")}>
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.title.includes("cancel") ? "bg-destructive" : n.title.includes("alter") ? "bg-warning" : "bg-success", n.read && "opacity-30")} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {n.reservation_id && <Link to="/reservas" onClick={() => mark(n.id)} className="text-xs font-medium text-primary hover:underline">Ver reserva</Link>}
              {!n.read && <button onClick={() => mark(n.id)} className="text-xs text-muted-foreground hover:text-foreground">Marcar como lida</button>}
            </div>
          </li>
        ))}
        {!list.data?.length && <li className="p-10 text-center text-sm text-muted-foreground">Sem notificações.</li>}
      </ul>
    </>
  );
}
