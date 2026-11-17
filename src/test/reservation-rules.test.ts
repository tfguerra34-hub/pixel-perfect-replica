import { describe, expect, it } from "vitest";
import { reservationErrorMessage, reservationOverlapsBlock } from "@/lib/reservation-rules";

describe("regras de ocupação", () => {
  it("uma reserva às 13:30 com 90 minutos coincide com um bloqueio às 14:00", () => {
    expect(reservationOverlapsBlock("13:30:00", 90, "14:00", "15:00")).toBe(true);
  });

  it("uma reserva que termina exatamente no início do bloqueio não coincide", () => {
    expect(reservationOverlapsBlock("13:00:00", 60, "14:00", "15:00")).toBe(false);
  });

  it("um bloqueio de dia completo abrange qualquer reserva", () => {
    expect(reservationOverlapsBlock("20:00:00", 90, null, null)).toBe(true);
  });

  it("explica um conflito de mesa em vez de mostrar um erro genérico", () => {
    expect(reservationErrorMessage("MESA_OCUPADA: conflito")).toContain("já está reservada");
  });

  it("mantém a explicação das reservas futuras que impedem alterar uma mesa", () => {
    expect(reservationErrorMessage("MESA_COM_RESERVAS: Reatribua ou cancele essas reservas primeiro.")).toBe("Reatribua ou cancele essas reservas primeiro.");
  });
});
