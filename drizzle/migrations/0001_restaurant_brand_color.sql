alter table public.restaurants add column if not exists brand_color text;
drop function if exists public.get_public_restaurant(text);
create function public.get_public_restaurant(_slug text)
returns table(id uuid, name text, description text, address text, postal_code text, city text, phone text, logo_url text, cover_url text, max_party int, max_advance_days int, brand_color text)
language sql stable security definer set search_path = public as $$
  select id, name, description, address, postal_code, city, phone, logo_url, cover_url, max_party, max_advance_days, brand_color
  from restaurants where slug = _slug and not suspended
$$;
grant execute on function public.get_public_restaurant(text) to anon, authenticated;