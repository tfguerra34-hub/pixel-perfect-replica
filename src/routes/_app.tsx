import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarDays, Ban, LayoutDashboard, LogOut, Settings, Users, Armchair, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RestaurantProvider } from "@/hooks/useRestaurant";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

const NAV = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/reservas", label: "Reservas", icon: CalendarDays },
  { to: "/mesas", label: "Mesas", icon: Armchair },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/bloqueios", label: "Bloqueios", icon: Ban },
  { to: "/notificacoes", label: "Notificações", icon: Bell },
  { to: "/definicoes", label: "Definições", icon: Settings },
] as const;
const MOBILE = ["/painel", "/reservas", "/mesas", "/notificacoes", "/definicoes"];

function AppLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  const ctx = useQuery({
    queryKey: ["membership", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: m }, { data: roles }] = await Promise.all([
        supabase.from("restaurant_members").select("role, restaurants(*)").eq("user_id", user!.id).limit(1).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      return { m, isSuperAdmin: !!roles?.some((r) => r.role === "super_admin") };
    },
  });

  useEffect(() => {
    if (ctx.data && !ctx.data.m) nav({ to: "/onboarding" });
  }, [ctx.data, nav]);

  const rid = ctx.data?.m?.restaurants?.id;
  const unread = useQuery({
    queryKey: ["unread", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("restaurant_id", rid!).eq("read", false);
      return count ?? 0;
    },
  });

  // Realtime: novas reservas e notificações
  useEffect(() => {
    if (!rid) return;
    const ch = supabase
      .channel(`rest-${rid}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `restaurant_id=eq.${rid}` }, (p) => {
        const n = p.new as { title: string; body: string | null };
        toast(n.title, { description: n.body ?? undefined });
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
          new Notification(n.title, { body: n.body ?? undefined });
        }
        qc.invalidateQueries({ queryKey: ["unread"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `restaurant_id=eq.${rid}` }, () => {
        qc.invalidateQueries({ queryKey: ["reservations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rid, qc]);

  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    qc.clear();
    nav({ to: "/login" });
  }

  if (loading || !user || ctx.isLoading || !ctx.data?.m?.restaurants)
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const restaurant = ctx.data.m.restaurants;
  const badge = (to: string) => to === "/notificacoes" && (unread.data ?? 0) > 0 ? unread.data : null;

  return (
    <RestaurantProvider value={{ restaurant, role: ctx.data.m.role, isSuperAdmin: ctx.data.isSuperAdmin }}>
      <div className="min-h-screen lg:pl-64">
        <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
          <div className="px-6 py-6"><Logo className="text-sidebar-accent-foreground" /></div>
          <div className="mx-4 mb-4 rounded-lg bg-sidebar-accent px-3 py-2.5">
            <p className="text-xs text-sidebar-foreground/60">Restaurante</p>
            <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">{restaurant.name}</p>
          </div>
          <nav className="flex-1 space-y-0.5 px-3">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                path.startsWith(to) && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground")}>
                <Icon className={cn("h-4 w-4", path.startsWith(to) && "text-sidebar-primary")} />
                {label}
                {badge(to) && <span className="ml-auto rounded-full bg-sidebar-primary px-2 text-xs font-bold text-sidebar-primary-foreground">{badge(to)}</span>}
              </Link>
            ))}
          </nav>
          <div className="space-y-0.5 border-t border-sidebar-border p-3">
            <a href={`/r/${restaurant.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent">
              <ExternalLink className="h-4 w-4" /> Página de reservas
            </a>
            <button onClick={signOut} disabled={signingOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent">
              <LogOut className="h-4 w-4" /> Terminar sessão
            </button>
          </div>
        </aside>

        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <div>
            <p className="text-xs text-muted-foreground">MesaGest</p>
            <p className="font-display text-lg font-medium leading-tight">{restaurant.name}</p>
          </div>
          <Link to="/notificacoes" className="relative rounded-full border bg-card p-2">
            <Bell className="h-5 w-5" />
            {(unread.data ?? 0) > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unread.data}</span>}
          </Link>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          <Outlet />
        </main>

        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 pt-1.5 backdrop-blur lg:hidden">
          {NAV.filter((n) => MOBILE.includes(n.to)).map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={cn("flex flex-col items-center gap-0.5 py-1 text-[11px] text-muted-foreground", path.startsWith(to) && "text-primary font-semibold")}>
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </RestaurantProvider>
  );
}
