CREATE OR REPLACE FUNCTION public.find_free_table_except(_rid uuid, _date date, _time time without time zone, _party integer, _exclude uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare _duration integer;
begin
  select r.table_duration into _duration from public.restaurants r where r.id = _rid;
  if _duration is null then return null; end if;
  return (
    select t.id from public.tables t
    where t.restaurant_id = _rid and t.active and t.seats >= _party
      and not exists (
        select 1 from public.blocked_periods b
        where b.restaurant_id = _rid and b.date = _date and (b.table_id is null or b.table_id = t.id)
          and (b.start_time is null or (b.start_time < _time + make_interval(mins => _duration) and coalesce(b.end_time, time '23:59:59') > _time))
      )
      and not exists (
        select 1 from public.reservations x
        where x.table_id = t.id and x.date = _date and x.id is distinct from _exclude
          and x.status not in ('cancelled','no_show','completed')
          and abs(extract(epoch from (x.time - _time))) < _duration * 60
      )
    order by t.seats, t.name limit 1
  );
end
$function$;

REVOKE ALL ON FUNCTION public.find_free_table_except(uuid, date, time without time zone, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_free_table_except(uuid, date, time without time zone, integer, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.find_free_table(_rid uuid, _date date, _time time without time zone, _party integer)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select public.find_free_table_except(_rid, _date, _time, _party, null)
$function$;

CREATE OR REPLACE FUNCTION public.get_available_slots(_slug text, _date date, _party integer)
RETURNS TABLE(slot time without time zone, service service_period)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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
    and not exists (
      select 1 from blocked_periods b
      where b.restaurant_id = r.id and b.date = _date and b.table_id is null and b.start_time is not null
        and b.start_time < g::time + make_interval(mins => r.table_duration)
        and coalesce(b.end_time, time '23:59:59') > g::time
    )
    and (r.max_covers_per_slot is null or coalesce((select sum(x.party_size) from reservations x
        where x.restaurant_id = r.id and x.date = _date and x.time = g::time
          and x.status not in ('cancelled','no_show')), 0) + _party <= r.max_covers_per_slot)
    and public.find_free_table_except(r.id, _date, g::time, _party, null) is not null
  order by g;
end
$function$;

CREATE OR REPLACE FUNCTION public.get_available_tables(_rid uuid, _date date, _time time without time zone, _party integer, _exclude uuid DEFAULT NULL)
RETURNS TABLE(id uuid, name text, seats integer, area text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare _duration integer;
begin
  if auth.uid() is null or not public.is_member(_rid) then raise exception 'SEM_PERMISSAO: Não tem acesso a este restaurante.'; end if;
  select r.table_duration into _duration from public.restaurants r where r.id = _rid;
  if _duration is null then return; end if;
  return query
  select t.id, t.name, t.seats, t.area from public.tables t
  where t.restaurant_id = _rid and t.active and t.seats >= _party
    and not exists (
      select 1 from public.blocked_periods b
      where b.restaurant_id = _rid and b.date = _date and (b.table_id is null or b.table_id = t.id)
        and (b.start_time is null or (b.start_time < _time + make_interval(mins => _duration) and coalesce(b.end_time, time '23:59:59') > _time))
    )
    and not exists (
      select 1 from public.reservations x
      where x.table_id = t.id and x.date = _date and x.id is distinct from _exclude
        and x.status not in ('cancelled','no_show','completed')
        and abs(extract(epoch from (x.time - _time))) < _duration * 60
    )
  order by t.seats, t.name;
end
$function$;

REVOKE ALL ON FUNCTION public.get_available_tables(uuid, date, time without time zone, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_tables(uuid, date, time without time zone, integer, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_reservation_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare r restaurants; _covers integer;
begin
  if new.status in ('cancelled','no_show','completed') then return new; end if;
  if new.party_size is null or new.party_size < 1 then raise exception 'GRUPO_INVALIDO: Indique um número válido de pessoas.'; end if;

  select * into r from public.restaurants where id = new.restaurant_id for update;
  if r.id is null then raise exception 'RESTAURANTE_INVALIDO: Restaurante não encontrado.'; end if;

  if new.table_id is null then
    new.table_id := public.find_free_table_except(new.restaurant_id, new.date, new.time, new.party_size, new.id);
    if new.table_id is null then
      raise exception 'RESERVA_SEM_MESA: Não existe uma mesa livre com lugares suficientes neste horário.';
    end if;
  end if;

  if not exists (
    select 1 from public.tables t
    where t.id = new.table_id and t.restaurant_id = new.restaurant_id and t.active and t.seats >= new.party_size
  ) then
    raise exception 'MESA_INVALIDA: A mesa escolhida está inativa ou não tem lugares suficientes.';
  end if;

  if exists (
    select 1 from public.reservations x
    where x.restaurant_id = new.restaurant_id and x.table_id = new.table_id and x.date = new.date
      and x.id is distinct from new.id and x.status not in ('cancelled','no_show','completed')
      and abs(extract(epoch from (x.time - new.time))) < r.table_duration * 60
  ) then
    raise exception 'MESA_OCUPADA: Esta mesa já está reservada num horário que coincide com a ocupação.';
  end if;

  if exists (
    select 1 from public.blocked_periods b
    where b.restaurant_id = new.restaurant_id and b.date = new.date and (b.table_id is null or b.table_id = new.table_id)
      and (b.start_time is null or (b.start_time < new.time + make_interval(mins => r.table_duration) and coalesce(b.end_time, time '23:59:59') > new.time))
  ) then
    raise exception 'HORARIO_BLOQUEADO: Esta reserva coincide com um bloqueio do restaurante ou da mesa.';
  end if;

  if r.max_covers_per_slot is not null then
    select coalesce(sum(x.party_size), 0) into _covers from public.reservations x
    where x.restaurant_id = new.restaurant_id and x.date = new.date and x.time = new.time
      and x.id is distinct from new.id and x.status not in ('cancelled','no_show');
    if _covers + new.party_size > r.max_covers_per_slot then
      raise exception 'LIMITE_PESSOAS: Este horário atingiu o número máximo de pessoas definido.';
    end if;
  end if;

  return new;
end
$function$;

DROP TRIGGER IF EXISTS validate_reservation_availability ON public.reservations;
CREATE TRIGGER validate_reservation_availability
BEFORE INSERT OR UPDATE OF restaurant_id, date, time, party_size, table_id, status ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.validate_reservation_availability();

CREATE OR REPLACE FUNCTION public.protect_table_reservations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare _affected integer;
begin
  perform 1 from public.restaurants r where r.id = old.restaurant_id for update;

  if tg_op = 'DELETE' then
    select count(*) into _affected from public.reservations x
    where x.table_id = old.id and x.status in ('pending','confirmed','arrived')
      and (x.date > (now() at time zone 'Europe/Lisbon')::date
        or (x.date = (now() at time zone 'Europe/Lisbon')::date and x.time >= (now() at time zone 'Europe/Lisbon')::time));
    if _affected > 0 then
      raise exception 'MESA_COM_RESERVAS: Não pode eliminar uma mesa com reservas futuras. Reatribua ou cancele essas reservas primeiro.';
    end if;
    return old;
  end if;

  if old.active and not new.active then
    select count(*) into _affected from public.reservations x
    where x.table_id = old.id and x.status in ('pending','confirmed','arrived')
      and (x.date > (now() at time zone 'Europe/Lisbon')::date
        or (x.date = (now() at time zone 'Europe/Lisbon')::date and x.time >= (now() at time zone 'Europe/Lisbon')::time));
    if _affected > 0 then
      raise exception 'MESA_COM_RESERVAS: Não pode desativar uma mesa com reservas futuras. Reatribua ou cancele essas reservas primeiro.';
    end if;
  end if;

  if new.seats < old.seats then
    select count(*) into _affected from public.reservations x
    where x.table_id = old.id and x.party_size > new.seats and x.status in ('pending','confirmed','arrived')
      and (x.date > (now() at time zone 'Europe/Lisbon')::date
        or (x.date = (now() at time zone 'Europe/Lisbon')::date and x.time >= (now() at time zone 'Europe/Lisbon')::time));
    if _affected > 0 then
      raise exception 'MESA_COM_RESERVAS: Há reservas futuras com mais pessoas do que os novos lugares desta mesa.';
    end if;
  end if;

  return new;
end
$function$;

DROP TRIGGER IF EXISTS protect_table_reservations_update ON public.tables;
CREATE TRIGGER protect_table_reservations_update
BEFORE UPDATE OF active, seats ON public.tables
FOR EACH ROW EXECUTE FUNCTION public.protect_table_reservations();

DROP TRIGGER IF EXISTS protect_table_reservations_delete ON public.tables;
CREATE TRIGGER protect_table_reservations_delete
BEFORE DELETE ON public.tables
FOR EACH ROW EXECUTE FUNCTION public.protect_table_reservations();