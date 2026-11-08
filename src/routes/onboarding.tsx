import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Configurar restaurante — MesaGest" },
      { name: "description", content: "Configure o seu restaurante para começar a receber reservas." },
      { property: "og:title", content: "Configurar restaurante — MesaGest" },
      { property: "og:description", content: "Configure o seu restaurante para começar a receber reservas." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", phone: "", address: "", postal_code: "", city: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/login" }); return; }
    supabase.from("restaurant_members").select("id").limit(1).then(({ data }) => {
      if (data?.length) nav({ to: "/painel" });
    });
    const m = user.user_metadata ?? {};
    setF({ name: m.restaurant_name ?? "", phone: m.phone ?? "", address: m.address ?? "", postal_code: m.postal_code ?? "", city: m.city ?? "" });
  }, [user, loading, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("create_restaurant", {
      _name: f.name, _phone: f.phone, _address: f.address, _postal_code: f.postal_code, _city: f.city,
    });
    setBusy(false);
    if (error) return toast.error("Não foi possível criar o restaurante.");
    toast.success("Restaurante criado! Ajuste o horário e as mesas nas Definições.");
    nav({ to: "/painel" });
  }

  const field = (k: keyof typeof f, l: string) => (
    <div className="space-y-2">
      <Label htmlFor={k}>{l}</Label>
      <Input id={k} required value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  return (
    <AuthShell title="Vamos configurar o seu restaurante" subtitle="Criamos já um horário base (almoço e jantar, terça a domingo) e 6 mesas, que pode ajustar depois.">
      <form onSubmit={submit} className="space-y-4">
        {field("name", "Nome do restaurante")}
        {field("phone", "Telefone")}
        {field("address", "Morada")}
        <div className="grid grid-cols-2 gap-4">{field("postal_code", "Código postal")}{field("city", "Cidade")}</div>
        <Button className="w-full" type="submit" disabled={busy}>{busy ? "A criar…" : "Concluir configuração"}</Button>
      </form>
    </AuthShell>
  );
}
