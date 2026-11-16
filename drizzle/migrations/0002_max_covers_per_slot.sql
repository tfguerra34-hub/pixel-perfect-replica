ALTER TABLE public.restaurants ADD COLUMN max_covers_per_slot integer CHECK (max_covers_per_slot IS NULL OR max_covers_per_slot > 0);
ALTER TABLE public.restaurants ALTER COLUMN auto_confirm SET DEFAULT true;
CREATE OR REPLACE FUNCTION public.get_available_slots(_slug text, _date date, _party integer)
 RETURNS TABLE(slot time without time zone, service service_period)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare r restaurants; now_local timestamp := (now() at time zone 'Europe/Lisbon');
begin
  select * into r from restaurants where slug = _slug and not suspended;
  if r.id is null or _party < 1 or _party > r.max_party then return; end if;
  if _date > (now_local::date + r.max_advance_days) then return; end if;
  if exists (select 1 from blocked_periods b where b.restaurant_id = r.id and b.date = _date and b.start_time is null and b.table_id is null) then return; end if;
  return query
  select g::time, h.service from opening_hours h,
    generate_series(_date + h.opens, _date + h.closes - make_interval(mins => r.slot_interval), make_interval(mins => r.slot_interval)) g
  where h.restaurant_id = r.id and h.weekday = extract(dow from _date)::int
    and g >= now_local + make_interval(mins => r.min_notice_minutes)
    and not exists (select 1 from blocked_periods b where b.restaurant_id = r.id and b.date = _date and b.table_id is null
        and b.start_time is not null and g::time >= b.start_time and g::time < b.end_time)
    and (r.max_covers_per_slot is null or coalesce((select sum(x.party_size) from reservations x
        where x.restaurant_id = r.id and x.date = _date and x.time = g::time
          and x.status not in ('cancelled','no_show')), 0) + _party <= r.max_covers_per_slot)
    and public.find_free_table(r.id, _date, g::time, _party) is not null
  order by g;
end $function$;