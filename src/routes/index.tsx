import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CalendarCheck, Armchair, Smartphone } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import hero from "@/assets/restaurant-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MesaGest — Gestão de reservas para restaurantes" },
      { name: "description", content: "Reservas online, mesas, clientes e alertas em tempo real para o seu restaurante." },
      { property: "og:title", content: "MesaGest — Gestão de reservas para restaurantes" },
      { property: "og:description", content: "Reservas online, mesas, clientes e alertas em tempo real para o seu restaurante." },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: CalendarCheck, t: "Reservas online", d: "Página de reservas própria, com disponibilidade calculada automaticamente." },
  { icon: Armchair, t: "Mesas e lotação", d: "Atribuição automática de mesas consoante o número de pessoas." },
  { icon: Bell, t: "Alertas em tempo real", d: "Saiba de cada nova reserva ou cancelamento no momento." },
  { icon: Smartphone, t: "Pensado para o telemóvel", d: "Gira o serviço a partir do balcão ou da sala." },
];

function Index() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex gap-2">
          <Button variant="ghost" asChild><Link to="/login">Entrar</Link></Button>
          <Button asChild><Link to="/registar">Começar</Link></Button>
        </div>
      </header>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-2 lg:py-20">
        <div>
          <p className="text-sm font-semibold text-primary">{BRAND.tagline}</p>
          <h1 className="mt-3 text-4xl font-medium leading-tight sm:text-5xl">Cada mesa no seu lugar. Cada reserva sob controlo.</h1>
          <p className="mt-5 max-w-md text-muted-foreground">Receba reservas online, gira mesas, horários e clientes num só painel — no computador ou no telemóvel.</p>
          <div className="mt-8 flex gap-3">
            <Button size="lg" asChild><Link to="/registar">Registar restaurante</Link></Button>
            <Button size="lg" variant="outline" asChild><Link to="/login">Já tenho conta</Link></Button>
          </div>
        </div>
        <img src={hero} alt="Sala de restaurante ao fim do dia" width={1600} height={1008} className="aspect-[4/3] w-full rounded-2xl object-cover shadow-lift" />
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.t} className="rounded-xl border bg-card p-5 shadow-soft">
            <f.icon className="h-5 w-5 text-primary" />
            <h3 className="mt-3 text-lg font-medium">{f.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
