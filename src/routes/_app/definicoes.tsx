import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant, canManage } from "@/hooks/useRestaurant";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WEEKDAYS } from "@/lib/format";

export const Route = createFileRoute("/_app/definicoes")({
  head: () => ({ meta: [{ title: "Definições — MesaGest" }, { name: "description", content: "Informação, horário e regras de reserva do restaurante." }, { property: "og:title", content: "Definições — MesaGest" }, { property: "og:description", content: "Informação, horário e regras de reserva do restaurante." }] }),
  component: Definicoes,
});

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-5 shadow-soft">{children}</div>;
}

function Definicoes() {
  const { restaurant, role } = useRestaurant();
  const qc = useQueryClient();
  const [f, setF] = useState(restaurant);
  useEffect(() => setF(restaurant), [restaurant]);
  const edit = canManage(role);

  async function save() {
    const { id, owner_id, slug, created_at, suspended, ...patch } = f;
    void id; void owner_id; void slug; void created_at; void suspended;
    const { error } = await supabase.from("restaurants").update(patch).eq("id", restaurant.id);
    if (error) { toast.error("Não foi possível guardar."); return; }
    toast.success("Definições guardadas."); qc.invalidateQueries({ queryKey: ["membership"] });
  }

  const text = (k: "name" | "phone" | "website" | "address" | "postal_code" | "city" | "logo_url" | "cover_url", l: string) => (
    <div className="space-y-2"><Label>{l}</Label><Input disabled={!edit} value={(f[k] as string) ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  const num = (k: "slot_interval" | "table_duration" | "max_party" | "min_notice_minutes" | "max_advance_days", l: string) => (
    <div className="space-y-2"><Label>{l}</Label><Input disabled={!edit} type="number" min={1} value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} /></div>
  );

  const url = typeof window !== "undefined" ? `${window.location.origin}/r/${restaurant.slug}` : "";
  const embed = `<iframe src="${url}" width="100%" height="760" style="border:0;border-radius:12px"></iframe>`;
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copiado."); };

  return (
    <>
      <PageHeader title="Definições" />
      <Tabs defaultValue="geral">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="horario">Horário</TabsTrigger>
          <TabsTrigger value="reservas">Reservas</TabsTrigger>
          <TabsTrigger value="partilhar">Reservas online</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              {text("name", "Nome do restaurante")}{text("phone", "Telefone")}
              {text("address", "Morada")}{text("website", "Website")}
              {text("postal_code", "Código postal")}{text("city", "Cidade")}
              {text("logo_url", "Logótipo (URL da imagem)")}{text("cover_url", "Imagem de capa (URL)")}
              <div className="space-y-2 sm:col-span-2"><Label>Descrição</Label><Textarea disabled={!edit} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            </div>
            {edit && <Button className="mt-5" onClick={save}>Guardar alterações</Button>}
          </Card>
        </TabsContent>

        <TabsContent value="horario"><Horario edit={edit} /></TabsContent>

        <TabsContent value="reservas">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2"><Label>Intervalo entre horários</Label>
                <select disabled={!edit} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={f.slot_interval} onChange={(e) => setF({ ...f, slot_interval: Number(e.target.value) })}>
                  <option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={60}>60 minutos</option>
                </select>
              </div>
              {num("table_duration", "Duração média da mesa (min)")}
              {num("max_party", "Máximo de pessoas por reserva")}
              {num("min_notice_minutes", "Antecedência mínima (min)")}
              {num("max_advance_days", "Reservar até (dias de antecedência)")}
            </div>
            <label className="mt-5 flex items-center gap-3 text-sm">
              <Switch disabled={!edit} checked={f.auto_confirm} onCheckedChange={(v) => setF({ ...f, auto_confirm: v })} />
              Confirmar reservas online automaticamente
            </label>
            {edit && <Button className="mt-5" onClick={save}>Guardar alterações</Button>}
          </Card>
        </TabsContent>

        <TabsContent value="partilhar">
          <Card>
            <Label>Ligação direta de reservas</Label>
            <div className="mt-2 flex gap-2"><Input readOnly value={url} /><Button variant="outline" onClick={() => copy(url)}><Copy className="h-4 w-4" /></Button></div>
            <Label className="mt-5 block">Código para incorporar no seu website</Label>
            <div className="mt-2 flex gap-2"><Textarea readOnly value={embed} className="font-mono text-xs" /><Button variant="outline" onClick={() => copy(embed)}><Copy className="h-4 w-4" /></Button></div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

type Row = { weekday: number; service: "lunch" | "dinner"; opens: string; closes: string; on: boolean };

function Horario({ edit }: { edit: boolean }) {
  const { restaurant } = useRestaurant();
  const q = useQuery({
    queryKey: ["hours", restaurant.id],
    queryFn: async () => (await supabase.from("opening_hours").select("*").eq("restaurant_id", restaurant.id)).data ?? [],
  });
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!q.data) return;
    const out: Row[] = [];
    for (const wd of [1, 2, 3, 4, 5, 6, 0]) for (const s of ["lunch", "dinner"] as const) {
      const h = q.data.find((x) => x.weekday === wd && x.service === s);
      out.push({ weekday: wd, service: s, opens: h?.opens.slice(0, 5) ?? (s === "lunch" ? "12:00" : "19:00"), closes: h?.closes.slice(0, 5) ?? (s === "lunch" ? "15:00" : "22:30"), on: !!h });
    }
    setRows(out);
  }, [q.data]);

  const upd = (i: number, p: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  async function save() {
    if (rows.some((r) => r.on && r.opens >= r.closes)) { toast.error("A hora de fecho deve ser posterior à de abertura."); return; }
    await supabase.from("opening_hours").delete().eq("restaurant_id", restaurant.id);
    const { error } = await supabase.from("opening_hours").insert(rows.filter((r) => r.on).map(({ on, ...r }) => { void on; return { ...r, restaurant_id: restaurant.id }; }));
    if (error) { toast.error("Não foi possível guardar o horário."); return; }
    toast.success("Horário guardado."); q.refetch();
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft">
      <div className="space-y-1">
        {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
          <div key={wd} className="grid items-center gap-2 border-b py-3 last:border-0 sm:grid-cols-[140px_1fr_1fr]">
            <p className="font-semibold">{WEEKDAYS[wd]}</p>
            {rows.map((r, i) => r.weekday !== wd ? null : (
              <div key={r.service} className="flex items-center gap-2 text-sm">
                <Switch disabled={!edit} checked={r.on} onCheckedChange={(v) => upd(i, { on: v })} />
                <span className="w-14 text-muted-foreground">{r.service === "lunch" ? "Almoço" : "Jantar"}</span>
                <Input type="time" disabled={!edit || !r.on} value={r.opens} onChange={(e) => upd(i, { opens: e.target.value })} className="h-8 w-28" />
                <span>–</span>
                <Input type="time" disabled={!edit || !r.on} value={r.closes} onChange={(e) => upd(i, { closes: e.target.value })} className="h-8 w-28" />
              </div>
            ))}
          </div>
        ))}
      </div>
      {edit && <Button className="mt-5" onClick={save}>Guardar horário</Button>}
    </div>
  );
}
