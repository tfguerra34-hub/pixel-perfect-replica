import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova palavra-passe — MesaGest" },
      { name: "description", content: "Defina uma nova palavra-passe para a sua conta." },
      { property: "og:title", content: "Nova palavra-passe — MesaGest" },
      { property: "og:description", content: "Defina uma nova palavra-passe para a sua conta." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("A palavra-passe deve ter pelo menos 8 caracteres.");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error("A ligação expirou. Peça uma nova.");
    toast.success("Palavra-passe atualizada.");
    nav({ to: "/painel" });
  }
  return (
    <AuthShell title="Nova palavra-passe">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pw">Nova palavra-passe</Label>
          <Input id="pw" type="password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <Button className="w-full" type="submit">Guardar</Button>
      </form>
    </AuthShell>
  );
}
