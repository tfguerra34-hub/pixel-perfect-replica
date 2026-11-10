import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, MapPin, Minus, Plus, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addDays, formatDate, formatLongDate, isoDate } from "@/lib/format";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import hero from "@/assets/restaurant-hero.jpg";

export const Route = createFileRoute("/r/$slug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reservar mesa" },
      { name: "description", content: "Reserve a sua mesa online em poucos segundos." },
      { property: "og:title", content: "Reservar mesa" },
      { property: "og:description", content: "Reserve a sua mesa online em poucos segundos." },
    ],
  }),
  component: Booking,
});

function Booking() {
  const { slug } = Route.useParams();
  const rest = useQuery({
    queryKey: ["public-rest", slug],
    queryFn: async () => (await supabase.rpc("get_public_restaurant", { _slug: slug })).data?.[0] ?? null,
  });
  const [date, setDate] = useState(isoDate(new Date()));
  const [party, setParty] = useState(2);
  const [time, setTime] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", phone: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ reference: string; status: string } | null>(null);

  useEffect(() => { if (rest.data) document.title = `Reservar — ${rest.data.name}`; }, [rest.data]);

  const slots = useQuery({
    queryKey: ["slots", slug, date, party],
    enabled: !!rest.data,
    queryFn: async () => (await supabase.rpc("get_available_slots", { _slug: slug, _date: date, _party: party })).data ?? [],
  });
  useEffect(() => setTime(null), [date, party]);

  const days = useMemo(() => Array.from({ length: Math.min(rest.data?.max_advance_days ?? 30, 30) }, (_, i) => addDays(new Date(), i)), [rest.data]);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (f.phone.replace(/\D/g, "").length < 9) return setErr("Indique um número de telemóvel válido.");
    setBusy(true);
    const { data, error } = await supabase.rpc("create_public_reservation", { _slug: slug, _date: date, _time: time!, _party: party, _name: f.name, _phone: f.phone, _notes: f.notes });
    setBusy(false);
    if (error) { setErr(error.message.includes("disponível") ? "Este horário acabou de ficar indisponível. Escolha outro." : "Não foi possível concluir a reserva."); slots.refetch(); return; }
    setDone(data?.[0] ?? null);
  }

  if (rest.isLoading) return <div className="min-h-screen" />;
  if (!rest.data) return <div className="grid min-h-screen place-items-center p-6 text-center text-muted-foreground">Restaurante não encontrado.</div>;
  const r = rest.data;

  return (
    <div className="min-h-screen bg-background">
      <div className="relative h-48 sm:h-64">
        <img src={r.cover_url || hero} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
      </div>
      <div className="mx-auto -mt-16 max-w-xl px-4 pb-16">
        <div className="relative rounded-2xl border bg-card p-6 shadow-lift">
          <div className="flex items-center gap-4">
            {r.logo_url && <img src={r.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />}
            <div>
              <h1 className="text-2xl font-medium">{r.name}</h1>
              {r.address && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{r.address}{r.city ? `, ${r.city}` : ""}</p>}
            </div>
          </div>
          {r.description && <p className="mt-4 text-sm text-muted-foreground">{r.description}</p>}

          {done ? (
            <div className="mt-6 rounded-xl bg-success-soft p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <h2 className="mt-3 text-xl font-medium">{done.status === "pending" ? "Pedido de reserva enviado" : "Reserva confirmada"}</h2>
              <p className="mt-2 text-sm">{f.name}, {party} pessoas · {formatDate(date)} às {time}</p>
              <p className="mt-3 text-sm">Referência: <strong className="font-mono">{done.reference}</strong></p>
              {done.status === "pending" && <p className="mt-2 text-xs text-muted-foreground">O restaurante irá confirmar a sua reserva brevemente.</p>}
            </div>
          ) : (
            <>
              <div className="mt-6">
                <Label>Número de pessoas</Label>
                <div className="mt-2 flex items-center gap-4">
                  <Button type="button" size="icon" variant="outline" onClick={() => setParty(Math.max(1, party - 1))} aria-label="Menos"><Minus className="h-4 w-4" /></Button>
                  <span className="w-8 text-center font-display text-2xl">{party}</span>
                  <Button type="button" size="icon" variant="outline" onClick={() => setParty(Math.min(r.max_party, party + 1))} aria-label="Mais"><Plus className="h-4 w-4" /></Button>
                  <span className="text-xs text-muted-foreground">máx. {r.max_party}</span>
                </div>
              </div>
              <div className="mt-6">
                <Label>Data</Label>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
                  {days.map((d) => { const iso = isoDate(d); return (
                    <button key={iso} onClick={() => setDate(iso)} className={cn("flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 text-xs transition-colors", iso === date ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}>
                      <span className="uppercase">{d.toLocaleDateString("pt-PT", { weekday: "short" }).replace(".", "")}</span>
                      <span className="font-display text-lg">{d.getDate()}</span>
                    </button>); })}
                </div>
                <p className="text-sm text-muted-foreground first-letter:uppercase">{formatLongDate(date)}</p>
              </div>
              <div className="mt-6">
                <Label>Horários disponíveis</Label>
                {slots.isLoading ? <div className="mt-2 h-16 animate-pulse rounded-lg bg-muted" /> : slots.data?.length ? (
                  (["lunch", "dinner"] as const).map((s) => { const list = slots.data!.filter((x) => x.service === s); return list.length ? (
                    <div key={s} className="mt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s === "lunch" ? "Almoço" : "Jantar"}</p>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                        {list.map((x) => { const t = x.slot.slice(0, 5); return (
                          <button key={t} onClick={() => setTime(t)} className={cn("rounded-lg border py-2 text-sm font-semibold transition-colors", time === t ? "border-primary bg-primary text-primary-foreground" : "border-success/30 bg-success-soft text-success hover:border-success")}>{t}</button>); })}
                      </div>
                    </div>) : null; })
                ) : <p className="mt-2 rounded-lg bg-muted p-4 text-sm text-muted-foreground">Sem disponibilidade neste dia. Experimente outra data.</p>}
              </div>
              {time && (
                <form onSubmit={book} className="mt-6 space-y-4 border-t pt-6">
                  <div className="space-y-2"><Label>Nome completo</Label><Input required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Número de telemóvel</Label><Input required type="tel" placeholder="912 345 678" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Observações especiais</Label><Textarea placeholder="Alergias, aniversário, cadeira de bebé…" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
                  {err && <p className="text-sm text-destructive">{err}</p>}
                  <Button type="submit" className="w-full" size="lg" disabled={busy}>{busy ? "A reservar…" : `Confirmar reserva · ${time}`}</Button>
                </form>
              )}
            </>
          )}
          {r.phone && <p className="mt-6 flex items-center justify-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{r.phone}</p>}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Reservas por {BRAND.name}</p>
      </div>
    </div>
  );
}
