import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Check, ImagePlus, Trash2 } from "lucide-react";
import { BRAND_COLORS } from "@/lib/brand";
import { fileToDataUrl } from "@/lib/image";
import { cn } from "@/lib/utils";
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

  const text = (k: "name" | "phone" | "website" | "address" | "postal_code" | "city", l: string) => (
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
              <ImageField label="Logótipo" hint="Aparece pequeno ao lado do nome." value={f.logo_url} square disabled={!edit} onChange={(v) => setF({ ...f, logo_url: v })} max={256} />
              <ImageField label="Imagem de capa (página de reservas)" hint="Recomendado: horizontal, 1600×600." value={f.cover_url} disabled={!edit} onChange={(v) => setF({ ...f, cover_url: v })} max={1600} />
              <div className="space-y-2 sm:col-span-2"><Label>Cor principal da página de reservas</Label>
                <div className="flex flex-wrap gap-3">
                  {BRAND_COLORS.map((c) => { const on = (f.brand_color ?? BRAND_COLORS[0]!.value) === c.value; return (
                    <button key={c.value} type="button" disabled={!edit} title={c.name} onClick={() => setF({ ...f, brand_color: c.value })}
                      className={cn("flex flex-col items-center gap-1 text-xs text-muted-foreground disabled:opacity-60")}>
                      <span className={cn("grid h-10 w-10 place-items-center rounded-full ring-offset-2 ring-offset-card", on && "ring-2 ring-foreground")} style={{ background: c.value }}>
                        {on && <Check className="h-4 w-4 text-primary-foreground" />}
                      </span>{c.name}
                    </button>); })}
                </div>
              </div>
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
              <div className="space-y-2"><Label>Máximo de pessoas por horário</Label>
                <Input disabled={!edit} type="number" min={1} placeholder="Sem limite" value={f.max_covers_per_slot ?? ""} onChange={(e) => setF({ ...f, max_covers_per_slot: e.target.value ? Number(e.target.value) : null })} />
                <p className="text-xs text-muted-foreground">Quando um horário chega a este número, deixa de aparecer na página de reservas.</p>
              </div>
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
          <div key={wd} className="grid min-w-0 items-center gap-3 border-b py-4 last:border-0 md:grid-cols-[130px_minmax(0,1fr)]">
            <p className="font-semibold">{WEEKDAYS[wd]}</p>
            <div className="grid min-w-0 gap-3 xl:grid-cols-2">
              {rows.map((r, i) => r.weekday !== wd ? null : (
                <div key={r.service} className="grid min-w-0 grid-cols-[auto_3.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-3 text-sm sm:grid-cols-[auto_3.5rem_minmax(0,7rem)_auto_minmax(0,7rem)]">
                  <Switch disabled={!edit} checked={r.on} onCheckedChange={(v) => upd(i, { on: v })} />
                  <span className="text-muted-foreground">{r.service === "lunch" ? "Almoço" : "Jantar"}</span>
                  <div className="col-span-3 grid min-w-0 grid-cols-[minmax(0,7rem)_auto_minmax(0,7rem)] items-center justify-start gap-2 sm:col-span-1 sm:contents">
                    <Input type="time" aria-label={`${WEEKDAYS[wd]} — abertura de ${r.service === "lunch" ? "almoço" : "jantar"}`} disabled={!edit || !r.on} value={r.opens} onChange={(e) => upd(i, { opens: e.target.value })} className="h-8 w-full min-w-0" />
                    <span aria-hidden="true">–</span>
                    <Input type="time" aria-label={`${WEEKDAYS[wd]} — fecho de ${r.service === "lunch" ? "almoço" : "jantar"}`} disabled={!edit || !r.on} value={r.closes} onChange={(e) => upd(i, { closes: e.target.value })} className="h-8 w-full min-w-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {edit && <Button className="mt-5" onClick={save}>Guardar horário</Button>}
    </div>
  );
}

function ImageField({ label, hint, value, onChange, disabled, square, max }: { label: string; hint: string; value: string | null; onChange: (v: string | null) => void; disabled: boolean; square?: boolean; max: number }) {
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha um ficheiro de imagem."); return; }
    try { onChange(await fileToDataUrl(file, max)); } catch { toast.error("Não foi possível ler a imagem."); }
  }
  return (
    <div className="space-y-2"><Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className={cn("grid shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted", square ? "h-16 w-16" : "h-16 w-28")}>
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
        </div>
        {!disabled && <div className="flex flex-col gap-1.5">
          <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
            {value ? "Trocar imagem" : "Carregar imagem"}<input type="file" accept="image/*" className="hidden" onChange={pick} />
          </label>
          {value && <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 text-xs text-destructive"><Trash2 className="h-3 w-3" />Remover</button>}
        </div>}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
