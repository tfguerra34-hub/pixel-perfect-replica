import type { Database } from "@/integrations/supabase/types";

export type ReservationStatus = Database["public"]["Enums"]["reservation_status"];

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  arrived: "Cliente chegou",
  completed: "Concluída",
  cancelled: "Cancelada",
  no_show: "Não compareceu",
};

export const STATUS_VARIANT: Record<
  ReservationStatus,
  "success" | "warning" | "danger" | "info" | "muted"
> = {
  pending: "warning",
  confirmed: "success",
  arrived: "info",
  completed: "muted",
  cancelled: "danger",
  no_show: "danger",
};

export const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

/** YYYY-MM-DD in local time */
export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIso(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

/** DD/MM/YYYY */
export function formatDate(s: string) {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

export function formatLongDate(s: string) {
  return parseIso(s).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
}

/** HH:MM from HH:MM:SS */
export function formatTime(t: string) {
  return t.slice(0, 5);
}

export function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function serviceOf(time: string): "lunch" | "dinner" {
  return Number(time.slice(0, 2)) < 17 ? "lunch" : "dinner";
}
