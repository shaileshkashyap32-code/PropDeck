-- ============================================================================
--  PropDeck — Stage 1 Security Lockdown
--  Run this ONCE in Supabase → SQL Editor → paste → Run.
--  Safe to re-run (idempotent): passwords won't be double-hashed, functions
--  are CREATE OR REPLACE, columns use IF NOT EXISTS.
--
--  What it does:
--    1. Turns your plaintext passwords into one-way bcrypt hashes.
--    2. Adds a login-session system (so the server knows who is an admin).
--    3. Creates secure functions for login / Google / password-reset / team
--       management. These run INSIDE the database and never hand back a
--       password or token to the browser.
--    4. Locks the salespersons table so the public can no longer read it.
-- ============================================================================

-- pgcrypto gives us crypt(), gen_salt(), digest(), gen_random_bytes().
-- On Supabase it lives in the "extensions" schema.
create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- 1. Session columns + hash any existing plaintext passwords
-- ----------------------------------------------------------------------------
alter table public.salespersons
  add column if not exists session_token_hash text,
  add column if not exists session_expires_at timestamptz;

-- Bcrypt hashes always start with "$2". Anything that doesn't is still
-- plaintext, so hash it. Re-running this later is a no-op.
update public.salespersons
  set password = extensions.crypt(password, extensions.gen_salt('bf'))
  where password is not null
    and password not like '$2%';

-- ----------------------------------------------------------------------------
-- 2. LOGIN — verify mobile/email + password, hand back a session token
-- ----------------------------------------------------------------------------
create or replace function public.verify_login(p_identifier text, p_password text)
returns table (id uuid, name text, mobile_number text, email text, role text, session_token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.salespersons%rowtype;
  v_token text;
begin
  select * into v_row
  from public.salespersons s
  where (s.mobile_number = p_identifier or lower(s.email) = lower(p_identifier))
    and s.password = extensions.crypt(p_password, s.password)
  limit 1;

  if v_row.id is null then
    return;                                  -- no match → return zero rows
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.salespersons
    set session_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
        session_expires_at = now() + interval '30 days'
    where id = v_row.id;

  return query select v_row.id, v_row.name, v_row.mobile_number, v_row.email, v_row.role, v_token;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. SESSION — restore a login on page refresh, and log out
-- ----------------------------------------------------------------------------
create or replace function public.validate_session(p_token text)
returns table (id uuid, name text, mobile_number text, email text, role text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select s.id, s.name, s.mobile_number, s.email, s.role
  from public.salespersons s
  where s.session_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and s.session_expires_at > now()
  limit 1;
end;
$$;

create or replace function public.logout(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.salespersons
    set session_token_hash = null, session_expires_at = null
  where session_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. GOOGLE — link a Google login to a salesperson.
--    Reads the VERIFIED email straight from the Google sign-in token
--    (auth.email()), so nobody can fake it by passing a random email.
-- ----------------------------------------------------------------------------
create or replace function public.link_google_session()
returns table (id uuid, name text, mobile_number text, email text, role text, session_token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  -- The verified email from the Google sign-in token (set by Supabase Auth on
  -- the request). Read straight from the JWT claims so it can't be spoofed.
  v_email text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
  v_row   public.salespersons%rowtype;
  v_token text;
begin
  if v_email is null then
    return;                                  -- not signed in with Google
  end if;

  select * into v_row
  from public.salespersons s
  where lower(s.email) = lower(v_email)
  limit 1;

  if v_row.id is null then
    return;                                  -- Google email not on the team
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.salespersons
    set session_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
        session_expires_at = now() + interval '30 days'
    where id = v_row.id;

  return query select v_row.id, v_row.name, v_row.mobile_number, v_row.email, v_row.role, v_token;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. PASSWORD RESET — confirm the emailed link and set a new password.
--    (Creating the reset token is done server-side in api/send-reset-email.mjs
--     using the service-role key, so the raw token never reaches the browser.)
-- ----------------------------------------------------------------------------
create or replace function public.confirm_password_reset(p_token text, p_new_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if p_new_password is null or length(p_new_password) < 6 then
    return false;
  end if;

  select s.id into v_id
  from public.salespersons s
  where s.reset_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and s.reset_token_expires_at > now()
  limit 1;

  if v_id is null then
    return false;                            -- bad or expired link
  end if;

  update public.salespersons
    set password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
        reset_token_hash = null,
        reset_token_expires_at = null,
        session_token_hash = null,           -- log out everywhere after a reset
        session_expires_at = null
  where id = v_id;

  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. TEAM MANAGEMENT (admin only) — every call requires a valid ADMIN session
-- ----------------------------------------------------------------------------
create or replace function public.is_admin_session(p_token text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.salespersons s
    where s.session_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and s.session_expires_at > now()
      and s.role = 'admin'
  );
$$;

create or replace function public.admin_list_team(p_token text)
returns table (id uuid, name text, mobile_number text, email text, role text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin_session(p_token) then
    raise exception 'Not authorized';
  end if;
  return query
  select s.id, s.name, s.mobile_number, s.email, s.role
  from public.salespersons s
  order by s.name;
end;
$$;

create or replace function public.admin_add_salesperson(
  p_token text, p_name text, p_mobile text, p_email text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin_session(p_token) then
    raise exception 'Not authorized';
  end if;
  insert into public.salespersons (name, mobile_number, email, password, role)
  values (p_name, p_mobile, p_email,
          extensions.crypt(p_password, extensions.gen_salt('bf')), 'salesperson');
end;
$$;

create or replace function public.admin_update_salesperson(
  p_token text, p_id uuid, p_name text, p_mobile text, p_email text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin_session(p_token) then
    raise exception 'Not authorized';
  end if;
  update public.salespersons
    set name = p_name,
        mobile_number = p_mobile,
        email = p_email,
        -- only overwrite the password when the admin actually typed a new one
        password = case
                     when p_password is not null and length(p_password) > 0
                       then extensions.crypt(p_password, extensions.gen_salt('bf'))
                     else password
                   end
  where id = p_id;
end;
$$;

create or replace function public.admin_remove_salesperson(p_token text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin_session(p_token) then
    raise exception 'Not authorized';
  end if;
  delete from public.salespersons where id = p_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. LOCK THE TABLE + allow only the safe functions above
-- ----------------------------------------------------------------------------
alter table public.salespersons enable row level security;
-- No policies are created on purpose → direct reads/writes from the browser
-- (the public "anon" key) are now blocked. Access happens only through the
-- SECURITY DEFINER functions above, which run as the table owner.
revoke all on public.salespersons from anon, authenticated;

grant execute on function public.verify_login(text, text)                     to anon, authenticated;
grant execute on function public.validate_session(text)                       to anon, authenticated;
grant execute on function public.logout(text)                                 to anon, authenticated;
grant execute on function public.link_google_session()                        to authenticated;
grant execute on function public.confirm_password_reset(text, text)           to anon, authenticated;
grant execute on function public.admin_list_team(text)                        to anon, authenticated;
grant execute on function public.admin_add_salesperson(text,text,text,text,text)        to anon, authenticated;
grant execute on function public.admin_update_salesperson(text,uuid,text,text,text,text) to anon, authenticated;
grant execute on function public.admin_remove_salesperson(text, uuid)         to anon, authenticated;

-- ============================================================================
--  Done. Your salespersons table is now private, passwords are hashed, and
--  logins run through the secure functions above.
--
--  NOTE: projects, locations and whatsapp_templates are intentionally left
--  open in Stage 1 (they hold no passwords). Locking their WRITES to admins
--  is Stage 2.
-- ============================================================================
