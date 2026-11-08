import { createContext, useContext, type ReactNode } from "react";
import type { Database } from "@/integrations/supabase/types";

export type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
export type MemberRole = Database["public"]["Enums"]["member_role"];

type Ctx = { restaurant: Restaurant; role: MemberRole; isSuperAdmin: boolean };
const RestaurantCtx = createContext<Ctx | null>(null);

export function RestaurantProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <RestaurantCtx.Provider value={value}>{children}</RestaurantCtx.Provider>;
}

export function useRestaurant() {
  const v = useContext(RestaurantCtx);
  if (!v) throw new Error("useRestaurant fora do painel");
  return v;
}

export const canManage = (role: MemberRole) => role === "owner" || role === "manager";
