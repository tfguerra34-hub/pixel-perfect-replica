import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/registar")({
  head: () => ({
    meta: [
      { title: "Registar restaurante — MesaGest" },
      { name: "description", content: "Crie a conta do seu restaurante e comece a receber reservas online." },
      { property: "og:title", content: "Registar restaurante — MesaGest" },
      { property: "og:description", content: "Crie a conta do seu restaurante e comece a receber reservas online." },
    ],
  }),
  component: Register,
});

const FIELDS = [
  { k: "restaurant_name", l: "Nome do restaurante", t: "text" },
  { k: "full_name", l: "Nome completo do proprietário", t: "text" },
  { k: "email", l: "E-mail", t: "email" },
  { k: "password", l: "Palavra-passe (mín. 8 caracteres)", t: "password" },
  { k: "phone", l: "Telemóvel", t: "tel" },
  { k: "address", l: "Morada do restaurante", t: "text" },
  { k: "postal_code", l: "Código postal", t: "text" },
  { k: "city", l: "Cidade", t: "text" },
] as const;

function Register() {
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if ((f.password ?? "").length < 8) return toast.error("A palavra-passe deve ter pelo menos 8 caracteres.");
    if (!/^\d{4}-\d{3}$/.test(f.postal_code ?? "")) return toast.error("Código postal inválido (formato 0000-000).");
    setBusy(true);
    const { email, password, ...meta } = f;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/onboarding`, data: meta },
    });
    setBusy(false);
    if (error) return toast.error(error.message.includes("registered") ? "Este e-mail já está registado." : "Não foi possível criar a conta.");
    setSent(true);
  }

  if (sent)
    return (
      <AuthShell title="Verifique o seu e-mail">
        <div className="rounded-xl border bg-card p-6 text-sm shadow-soft">
          <MailCheck className="mb-3 h-8 w-8 text-success" />
          Enviámos uma ligação de confirmação para <strong>{f.email}</strong>. Abra-a para ativar a conta e configurar o restaurante.
        </div>
      </AuthShell>
    );

  return (
    <AuthShell title="Registar restaurante" subtitle="Comece a receber reservas online em minutos.">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((x) => (
          <div key={x.k} className={x.k === "postal_code" || x.k === "city" ? "space-y-2" : "space-y-2 sm:col-span-2"}>
            <Label htmlFor={x.k}>{x.l}</Label>
            <Input
              id={x.k}
              type={x.t}
              required
              placeholder={x.k === "postal_code" ? "1000-001" : x.k === "phone" ? "912 345 678" : undefined}
              value={f[x.k] ?? ""}
              onChange={(e) => setF({ ...f, [x.k]: e.target.value })}
            />
          </div>
        ))}
        <Button type="submit" className="w-full sm:col-span-2" disabled={busy}>{busy ? "A criar conta…" : "Criar conta"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta? <Link to="/login" className="font-medium text-primary hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
