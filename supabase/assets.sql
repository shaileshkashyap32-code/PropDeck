-- ─── Project assets ─────────────────────────────────────────────────────────
-- Brochures / plans / gallery / video links attached to a project. Files are
-- uploaded to the existing public storage bucket from the admin panel (so no
-- new bucket or storage policy is needed); this table holds the resulting URL
-- plus its kind and label. External links (e.g. a YouTube walkthrough) are
-- stored the same way — just a pasted URL instead of an uploaded file.
--
-- Access model: public SELECT (same as projects, so the project page can read
-- the links), admin-gated writes through the SECURITY DEFINER functions below.
--
-- Idempotent — safe to re-run in the Supabase SQL editor.

create table if not exists public.project_assets (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind       text not null,
  label      text not null,
  url        text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists project_assets_project_idx on public.project_assets (project_id);

alter table public.project_assets enable row level security;

drop policy if exists "project_assets public read" on public.project_assets;
create policy "project_assets public read" on public.project_assets for select using (true);

create or replace function public.admin_add_project_asset(
  p_token text, p_project_id uuid, p_kind text, p_label text, p_url text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not is_admin_session(p_token) then raise exception 'Not authorized'; end if;
  insert into project_assets (project_id, kind, label, url)
  values (p_project_id, p_kind, p_label, p_url)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_delete_project_asset(
  p_token text, p_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin_session(p_token) then raise exception 'Not authorized'; end if;
  delete from project_assets where id = p_id;
end;
$$;
