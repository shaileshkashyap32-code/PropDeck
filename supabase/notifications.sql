-- ─── Notifications ──────────────────────────────────────────────────────────
-- A shared feed of admin activity. When an admin adds, updates or removes a
-- project, a row is written here; salespeople see an unread count on a bell in
-- the top bar and a dropdown list.
--
-- Access model matches whatsapp_templates: RLS on, no public policies, reachable
-- only through the SECURITY DEFINER functions below. Writes happen inside the
-- admin project functions (also SECURITY DEFINER), never from the client.
--
-- Idempotent — safe to re-run in the Supabase SQL editor.

-- ── 1. Table + per-salesperson "seen" marker ────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  message    text not null,
  project_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);

alter table public.notifications enable row level security;

alter table public.salespersons
  add column if not exists notifications_seen_at timestamptz;

-- ── 2. Read own feed / mark seen ────────────────────────────────────────────
-- Everyone shares one feed; "unread" is per-salesperson, derived from their
-- own notifications_seen_at.
create or replace function public.get_my_notifications(p_token text)
returns table (id uuid, message text, project_id uuid, created_at timestamptz, unread boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_seen timestamptz;
begin
  select s.id, s.notifications_seen_at into v_id, v_seen
  from validate_session(p_token) vs
  join salespersons s on s.id = vs.id;
  if v_id is null then
    raise exception 'Not authorized';
  end if;

  return query
    select n.id, n.message, n.project_id, n.created_at,
           (v_seen is null or n.created_at > v_seen) as unread
    from notifications n
    order by n.created_at desc
    limit 30;
end;
$$;

create or replace function public.mark_notifications_seen(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from validate_session(p_token);
  if v_id is null then
    raise exception 'Not authorized';
  end if;
  update salespersons set notifications_seen_at = now() where id = v_id;
end;
$$;

-- ── 3. Admin project functions, extended to emit a notification ──────────────
-- Same bodies as stage2, with one notifications insert added. Kept whole so the
-- function definition stays in one place.
create or replace function public.admin_save_project(
  p_token text,
  p_id uuid,
  p_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := coalesce(p_payload->>'name', 'A project');
begin
  if not is_admin_session(p_token) then
    raise exception 'Not authorized';
  end if;

  if p_id is null then
    insert into projects (
      name, developer, location, area, rera_number, status, possession_date,
      price_min, price_max, carpet_area_min, carpet_area_max,
      bhk_types, unit_configs, usps, landmarks,
      pitch_script, image_url, google_maps_url, tags
    )
    select
      r.name, r.developer, r.location, r.area, r.rera_number, r.status, r.possession_date,
      r.price_min, r.price_max, r.carpet_area_min, r.carpet_area_max,
      r.bhk_types, r.unit_configs, r.usps, r.landmarks,
      r.pitch_script, r.image_url, r.google_maps_url, r.tags
    from jsonb_populate_record(null::projects, p_payload) r
    returning id into v_id;

    insert into notifications (message, project_id)
    values ('New project added: ' || v_name, v_id);
  else
    update projects p
    set
      name = r.name, developer = r.developer, location = r.location, area = r.area,
      rera_number = r.rera_number, status = r.status, possession_date = r.possession_date,
      price_min = r.price_min, price_max = r.price_max,
      carpet_area_min = r.carpet_area_min, carpet_area_max = r.carpet_area_max,
      bhk_types = r.bhk_types, unit_configs = r.unit_configs, usps = r.usps,
      landmarks = r.landmarks,
      pitch_script = r.pitch_script, image_url = r.image_url,
      google_maps_url = r.google_maps_url, tags = r.tags
    from jsonb_populate_record(null::projects, p_payload) r
    where p.id = p_id
    returning p.id into v_id;

    insert into notifications (message, project_id)
    values (v_name || ' was updated', v_id);
  end if;

  return v_id;
end;
$$;

create or replace function public.admin_delete_project(
  p_token text,
  p_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not is_admin_session(p_token) then
    raise exception 'Not authorized';
  end if;

  select name into v_name from projects where id = p_id;
  delete from projects where id = p_id;

  if v_name is not null then
    insert into notifications (message, project_id)
    values (v_name || ' was removed', null);
  end if;
end;
$$;
