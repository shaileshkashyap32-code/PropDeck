-- ─── Profile photos ─────────────────────────────────────────────────────────
-- Stores each salesperson's avatar as a small data-URL string on their own row.
--
-- Why a column and not Supabase Storage: email/mobile logins don't have a
-- Supabase Auth session (auth is our own session tokens, see stage1), so
-- Storage RLS keyed on auth.uid() can't gate uploads for them. Keeping the
-- image on salespersons — which is already reachable only through session-token
-- RPCs — fits the existing model. The client resizes to ~256px before upload,
-- so the string stays a few KB.
--
-- Idempotent — safe to re-run in the Supabase SQL editor.

-- ── 1. Column ───────────────────────────────────────────────────────────────
alter table public.salespersons
  add column if not exists avatar_url text;

-- ── 2. Read/write own avatar, resolving the caller from their session token ──
-- Same guard as get_my_whatsapp_templates: the caller can only ever touch their
-- own row, never pass someone else's id.
create or replace function public.get_my_avatar(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_url text;
begin
  select id into v_id from validate_session(p_token);
  if v_id is null then
    raise exception 'Not authorized';
  end if;
  select avatar_url into v_url from salespersons where id = v_id;
  return v_url;
end;
$$;

-- p_avatar null clears the photo (back to initials).
create or replace function public.set_my_avatar(p_token text, p_avatar text)
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
  update salespersons set avatar_url = p_avatar where id = v_id;
end;
$$;
