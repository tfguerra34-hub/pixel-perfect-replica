import { describe, expect, it } from "vitest";
import { formatDate, formatTime, serviceOf } from "@/lib/format";

describe("formatação PT-PT", () => {
  it("datas em DD/MM/YYYY", () => {
    expect(formatDate("2026-11-08")).toBe("08/11/2026");
  });
  it("horas em 24h", () => {
    expect(formatTime("19:30:00")).toBe("19:30");
  });
  it("serviço de jantar a partir das 17h", () => {
    expect(serviceOf("12:30:00")).toBe("lunch");
    expect(serviceOf("20:00:00")).toBe("dinner");
  });
});
