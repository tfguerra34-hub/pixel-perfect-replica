CREATE OR REPLACE FUNCTION public.validate_reservation_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare r restaurants; _covers integer;
begin
  if new.status in ('cancelled','no_show','completed') then return new; end if;
  if tg_op = 'UPDATE' and old.status not in ('cancelled','no_show','completed')
    and old.restaurant_id = new.restaurant_id and old.date = new.date and old.time = new.time
    and old.party_size = new.party_size and old.table_id is not distinct from new.table_id then
    return new;
  end if;
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