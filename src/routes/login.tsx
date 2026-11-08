import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — MesaGest" },
      { name: "description", content: "Aceda ao painel de gestão de reservas do seu restaurante." },
      { property: "og:title", content: "Entrar — MesaGest" },
      { property: "og:description", content: "Aceda ao painel de gestão de reservas do seu restaurante." },
    ],
  }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("confirm") ? "Confirme o seu e-mail antes de entrar." : "E-mail ou palavra-passe incorretos.");
      return;
    }
    nav({ to: "/painel" });
  }

  return (
    <AuthShell title="Bem-vindo de volta" subtitle="Entre para gerir as reservas do seu restaurante.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="pw">Palavra-passe</Label>
            <Link to="/recuperar-password" className="text-xs text-primary hover:underline">Esqueceu-se?</Link>
          </div>
          <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "A entrar…" : "Entrar"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta? <Link to="/registar" className="font-medium text-primary hover:underline">Registar restaurante</Link>
      </p>
    </AuthShell>
  );
}
