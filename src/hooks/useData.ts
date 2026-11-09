import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useReservations(rid: string, from: string, to: string) {
  return useQuery({
    queryKey: ["reservations", rid, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("reservations").select("*").eq("restaurant_id", rid)
        .gte("date", from).lte("date", to).order("date").order("time");
      if (error) throw error;
      return data;
    },
  });
}

export function useTables(rid: string) {
  return useQuery({
    queryKey: ["tables", rid, "all"],
    queryFn: async () => (await supabase.from("tables").select("*").eq("restaurant_id", rid).order("name")).data ?? [],
  });
}

export function useTableNames(rid: string) {
  const t = useTables(rid);
  return Object.fromEntries((t.data ?? []).map((x) => [x.id, x.name]));
}
