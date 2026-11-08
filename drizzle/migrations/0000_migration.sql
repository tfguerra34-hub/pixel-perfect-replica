
create type public.app_role as enum ('super_admin');
create type public.member_role as enum ('owner','manager','staff');
create type public.reservation_status as enum ('pending','confirmed','arrived','completed','cancelled','no_show');
create type public.service_period as enum ('lunch','dinner');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  slug text not null unique,
  description text,
  phone text,
  address text,
  postal_code text,
  city text,
  website text,
  logo_url text,
  cover_url text,
  slot_interval int not null default 30,
  table_duration int not null default 90,
  max_party int not null default 10,
  min_notice_minutes int not null default 60,
  max_advance_days int not null default 60,
  auto_confirm boolean not null default true,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.restaurant_members (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create or replace function public.is_member(_rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurant_members where restaurant_id = _rid and user_id = auth.uid())
$$;
create or replace function public.is_manager(_rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurant_members where restaurant_id = _rid and user_id = auth.uid() and role in ('owner','manager'))
$$;

grant select, insert, update, delete on public.restaurants to authenticated;
grant all on public.restaurants to service_role;
alter table public.restaurants enable row level security;
create policy "members read" on public.restaurants for select to authenticated using (public.is_member(id) or public.has_role(auth.uid(),'super_admin'));
create policy "managers update" on public.restaurants for update to authenticated using (public.is_manager(id) or public.has_role(auth.uid(),'super_admin'));

grant select, insert, update, delete on public.restaurant_members to authenticated;
grant all on public.restaurant_members to service_role;
alter table public.restaurant_members enable row level security;
create policy "members read members" on public.restaurant_members for select to authenticated using (user_id = auth.uid() or public.is_member(restaurant_id));
create policy "managers manage members" on public.restaurant_members for all to authenticated using (public.is_manager(restaurant_id)) with check (public.is_manager(restaurant_id));

create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  service public.service_period not null,
  opens time not null,
  closes time not null,
  unique (restaurant_id, weekday, service)
);
create table public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  seats int not null default 2,
  area text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  phone text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (restaurant_id, phone)
);
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  party_size int not null check (party_size > 0),
  date date not null,
  time time not null,
  table_id uuid references public.tables(id) on delete set null,
  notes text,
  status public.reservation_status not null default 'confirmed',
  source text not null default 'manual',
  reference text not null default upper(substr(md5(random()::text),1,6)),
  created_at timestamptz not null default now()
);
create index on public.reservations (restaurant_id, date);
create table public.blocked_periods (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  table_id uuid references public.tables(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  title text not null,
  body text,
  reservation_id uuid references public.reservations(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['opening_hours','tables','customers','reservations','blocked_periods','notifications'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members all" on public.%I for all to authenticated using (public.is_member(restaurant_id) or public.has_role(auth.uid(),''super_admin'')) with check (public.is_member(restaurant_id))', t);
  end loop;
end $$;

-- notification trigger
create or replace function public.notify_reservation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(restaurant_id, title, body, reservation_id)
    values (new.restaurant_id, 'Nova reserva',
      new.customer_name || ' · ' || new.party_size || ' pessoas · ' || to_char(new.date,'DD/MM/YYYY') || ' às ' || to_char(new.time,'HH24:MI'), new.id);
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    insert into public.notifications(restaurant_id, title, body, reservation_id)
    values (new.restaurant_id, 'Reserva cancelada',
      new.customer_name || ' · ' || to_char(new.date,'DD/MM/YYYY') || ' às ' || to_char(new.time,'HH24:MI'), new.id);
  elsif (new.date <> old.date or new.time <> old.time or new.party_size <> old.party_size) then
    insert into public.notifications(restaurant_id, title, body, reservation_id)
    values (new.restaurant_id, 'Reserva alterada',
      new.customer_name || ' · ' || new.party_size || ' pessoas · ' || to_char(new.date,'DD/MM/YYYY') || ' às ' || to_char(new.time,'HH24:MI'), new.id);
  end if;
  return new;
end $$;
create trigger reservations_notify after insert or update on public.reservations for each row execute function public.notify_reservation();

-- onboarding
create or replace function public.create_restaurant(_name text, _phone text, _address text, _postal_code text, _city text)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid; base text; s text; i int := 0; d int;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  base := trim(both '-' from regexp_replace(lower(translate(_name,'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn')),'[^a-z0-9]+','-','g'));
  if base = '' then base := 'restaurante'; end if;
  s := base;
  while exists (select 1 from restaurants where slug = s) loop i := i + 1; s := base || '-' || i; end loop;
  insert into restaurants(owner_id, name, slug, phone, address, postal_code, city)
  values (auth.uid(), _name, s, _phone, _address, _postal_code, _city) returning id into rid;
  insert into restaurant_members(restaurant_id, user_id, role) values (rid, auth.uid(), 'owner');
  insert into tables(restaurant_id, name, seats) values
    (rid,'Mesa 1',2),(rid,'Mesa 2',2),(rid,'Mesa 3',4),(rid,'Mesa 4',4),(rid,'Mesa 5',6),(rid,'Mesa 6',8);
  for d in 2..6 loop
    insert into opening_hours(restaurant_id, weekday, service, opens, closes) values
      (rid,d,'lunch','12:00','15:00'),(rid,d,'dinner','19:00','22:30');
  end loop;
  insert into opening_hours(restaurant_id, weekday, service, opens, closes) values (rid,0,'lunch','12:00','15:30');
  return rid;
end $$;
grant execute on function public.create_restaurant(text,text,text,text,text) to authenticated;

-- public booking
create or replace function public.get_public_restaurant(_slug text)
returns table(id uuid, name text, description text, address text, postal_code text, city text, phone text, logo_url text, cover_url text, max_party int, max_advance_days int)
language sql stable security definer set search_path = public as $$
  select id, name, description, address, postal_code, city, phone, logo_url, cover_url, max_party, max_advance_days
  from restaurants where slug = _slug and not suspended
$$;

create or replace function public.find_free_table(_rid uuid, _date date, _time time, _party int)
returns uuid language sql stable security definer set search_path = public as $$
  select t.id from tables t, restaurants r
  where r.id = _rid and t.restaurant_id = _rid and t.active and t.seats >= _party
    and not exists (select 1 from blocked_periods b where b.restaurant_id = _rid and b.table_id = t.id and b.date = _date
        and (b.start_time is null or (_time >= b.start_time and _time < b.end_time)))
    and not exists (select 1 from reservations x where x.table_id = t.id and x.date = _date
        and x.status not in ('cancelled','no_show','completed')
        and abs(extract(epoch from (x.time - _time))) < r.table_duration * 60)
  order by t.seats, t.name limit 1
$$;

create or replace function public.get_available_slots(_slug text, _date date, _party int)
returns table(slot time, service public.service_period)
language plpgsql stable security definer set search_path = public as $$
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
    and public.find_free_table(r.id, _date, g::time, _party) is not null
  order by g;
end $$;

create or replace function public.create_public_reservation(_slug text, _date date, _time time, _party int, _name text, _phone text, _notes text)
returns table(reference text, restaurant_name text, status public.reservation_status)
language plpgsql security definer set search_path = public as $$
declare r restaurants; tid uuid; cid uuid; res reservations;
begin
  select * into r from restaurants where slug = _slug and not suspended;
  if r.id is null then raise exception 'Restaurante não encontrado'; end if;
  if length(trim(coalesce(_name,''))) < 2 or length(regexp_replace(coalesce(_phone,''),'\D','','g')) < 9 then
    raise exception 'Dados inválidos'; end if;
  if not exists (select 1 from public.get_available_slots(_slug, _date, _party) s where s.slot = _time) then
    raise exception 'Este horário já não está disponível'; end if;
  tid := public.find_free_table(r.id, _date, _time, _party);
  insert into customers(restaurant_id, name, phone) values (r.id, trim(_name), trim(_phone))
    on conflict (restaurant_id, phone) do update set name = excluded.name returning id into cid;
  insert into reservations(restaurant_id, customer_id, customer_name, customer_phone, party_size, date, time, table_id, notes, status, source)
  values (r.id, cid, trim(_name), trim(_phone), _party, _date, _time, tid, nullif(trim(_notes),''),
    case when r.auto_confirm then 'confirmed'::reservation_status else 'pending'::reservation_status end, 'website')
  returning * into res;
  return query select res.reference, r.name, res.status;
end $$;

grant execute on function public.get_public_restaurant(text) to anon, authenticated;
grant execute on function public.get_available_slots(text,date,int) to anon, authenticated;
grant execute on function public.create_public_reservation(text,date,time,int,text,text,text) to anon, authenticated;
revoke execute on function public.find_free_table(uuid,date,time,int) from anon;

alter publication supabase_realtime add table public.reservations;
alter publication supabase_realtime add table public.notifications;
