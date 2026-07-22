-- ─── Location zones (Bangalore) ─────────────────────────────────────────────
-- Groups every location into one or more of five Bangalore zones so the Home
-- filter can offer a zone-first pick (North / South / East / West / Central).
--
-- Design notes:
--   * A location carries its own zone(s); projects reference a location by name
--     and inherit its zone. So the same area is never zoned inconsistently.
--   * `zones` is an ARRAY: 90% of areas have one, border areas (e.g. Sarjapur)
--     have two. Empty/null = unzoned; such an area still appears under the
--     "All Bangalore" (no zone selected) view, it just sits under no chip.
--   * Zone assignment is manual, via the admin panel. Nothing auto-detects.
--
-- Idempotent — safe to re-run in the Supabase SQL editor.

-- ── 1. Column ───────────────────────────────────────────────────────────────
alter table public.locations
  add column if not exists zones text[] not null default '{}';

-- Guard: only the five canonical zone names may be stored. Kept as a trigger
-- rather than a CHECK so the admin RPCs get a clear error message.
create or replace function public.assert_valid_zones(p_zones text[])
returns void
language plpgsql
immutable
as $$
declare
  z text;
begin
  foreach z in array coalesce(p_zones, '{}') loop
    if z not in ('North','South','East','West','Central') then
      raise exception 'Invalid zone "%": must be North, South, East, West or Central', z;
    end if;
  end loop;
end;
$$;

-- ── 2. Backfill the current areas ───────────────────────────────────────────
-- First-pass mapping agreed with the team. Border areas get two zones.
-- Uses name match; areas not listed here keep the default '{}' (unzoned).
update public.locations set zones = '{North}'   where name = 'Bagalur Road';
update public.locations set zones = '{North}'   where name = 'Hebbal';
update public.locations set zones = '{North}'   where name = 'Sadahalli';
update public.locations set zones = '{North}'   where name = 'Thanisandra';
update public.locations set zones = '{North}'   where name = 'Yelahanka';
update public.locations set zones = '{South}'   where name = 'Bannerghatta Rd';
update public.locations set zones = '{South}'   where name = 'Electronic City';
update public.locations set zones = '{South}'   where name = 'Kanakapura Road';
update public.locations set zones = '{East}'    where name = 'Hoskote';
update public.locations set zones = '{East}'    where name = 'KR Puram';
update public.locations set zones = '{East}'    where name = 'Seegahalli';
update public.locations set zones = '{East}'    where name = 'Whitefield';
update public.locations set zones = '{South,East}' where name = 'Sarjapur';

-- ── 3. Admin RPCs ───────────────────────────────────────────────────────────
-- Replaces the old admin_add_location(p_token, p_name): now also takes zones so
-- a new area is zoned at creation. Postgres keys functions by argument list, so
-- the two-arg version may still exist; the app always calls this three-arg one.
create or replace function public.admin_add_location(
  p_token text,
  p_name text,
  p_zones text[] default '{}'
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_session(p_token) then
    raise exception 'Not authorized';
  end if;
  perform assert_valid_zones(p_zones);

  insert into locations (name, zones) values (p_name, coalesce(p_zones, '{}'));
end;
$$;

-- Edit an existing area's zones.
create or replace function public.admin_set_location_zones(
  p_token text,
  p_id bigint,
  p_zones text[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_session(p_token) then
    raise exception 'Not authorized';
  end if;
  perform assert_valid_zones(p_zones);

  update locations set zones = coalesce(p_zones, '{}') where id = p_id;
end;
$$;
