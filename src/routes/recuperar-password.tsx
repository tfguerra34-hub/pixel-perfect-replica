import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/recuperar-password")({
  head: () => ({
    meta: [
      { title: "Recuperar palavra-passe — MesaGest" },
      { name: "description", content: "Receba uma ligação para definir uma nova palavra-passe." },
      { property: "og:title", content: "Recuperar palavra-passe — MesaGest" },
      { property: "og:description", content: "Receba uma ligação para definir uma nova palavra-passe." },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) { toast.error("Não foi possível enviar o e-mail."); return; }
    setSent(true);
  }
  return (
    <AuthShell title="Recuperar palavra-passe" subtitle="Indique o e-mail da sua conta.">
      {sent ? (
        <p className="rounded-xl border bg-card p-5 text-sm shadow-soft">Se existir uma conta com este e-mail, receberá uma ligação para redefinir a palavra-passe.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button className="w-full" type="submit">Enviar ligação</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="text-primary hover:underline">Voltar a entrar</Link></p>
    </AuthShell>
  );
}
