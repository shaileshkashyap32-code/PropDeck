# PropDeck

Real-estate sales-enablement web app. Salespeople log in to browse projects/locations, pitch
to clients (with Gemini-assisted persona pitches), and manage WhatsApp follow-up templates.
Admins additionally manage the team roster and project/location content.

## Stack

- **Frontend**: React 19 + TypeScript, built with Vite 8, styled with Tailwind CSS 3.
- **Routing**: no router library in use despite `react-router-dom` being a dependency —
  `App.tsx` does manual view-state switching (`'home' | 'project' | 'admin' | 'profile'`).
- **Backend**: Supabase (Postgres + PostgREST + Auth). Business logic that needs to run with
  elevated privileges lives in `SECURITY DEFINER` Postgres functions, called via
  `supabase.rpc(...)`.
- **Serverless functions**: `/api/*.mjs`, deployed as Vercel functions.
- **Linting**: oxlint (`npm run lint`), config in `_oxlintrc.json`.
- **Deployment**: Vercel.

## Folder structure

```
src/
  main.tsx            entry point
  App.tsx             top-level view-state machine, session bootstrap, Google-login glue
  lib/supabase.ts      Supabase client + localStorage session token helpers
  pages/
    Login.tsx          email/mobile+password login, Google login, "forgot password" trigger
    Home.tsx            project/location browse screen
    ProjectPage.tsx      single project detail + pitch/WhatsApp tooling
    Profile.tsx          salesperson profile + personal WhatsApp templates
    AdminPanel.tsx       team management + project/location CRUD (~1100 lines, see Known follow-ups)
    ResetPassword.tsx    consumes ?reset_token=... links, sets a new password
api/
  gemini.mjs             server-side Gemini proxy (holds GEMINI_API_KEY)
  send-reset-email.mjs   looks up account, issues reset token, emails link via Resend (holds SUPABASE_SERVICE_ROLE_KEY)
```

Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client, public anon key only).
Server-only, set in Vercel and never exposed to the client: `GEMINI_API_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `SITE_URL`.

## Security model (Stage 1 — live on `main` and in Supabase)

Do not revert any of this.

- **Passwords**: bcrypt-hashed in the `salespersons` table.
- **RLS**: enabled on `salespersons`, locked down so the public anon key has no direct
  read/write access to it. All access goes through `SECURITY DEFINER` functions instead.
- **Auth flows run as Postgres RPCs**, not direct table queries:
  - `verify_login` — email/mobile + password → session token (`Login.tsx`)
  - `link_google_session` — verifies the caller's Google-authenticated email server-side
    against `salespersons`, issues a session token if matched (`App.tsx`)
  - `validate_session` — token → salesperson record, used to restore sessions on load (`App.tsx`)
  - `logout` — revokes a session token (`App.tsx`)
  - `confirm_password_reset` — consumes a reset token, sets new bcrypt hash (`ResetPassword.tsx`)
  - `admin_list_team`, `admin_add_salesperson`, `admin_update_salesperson`,
    `admin_remove_salesperson` — team management, admin-only (`AdminPanel.tsx`)
- **Session tokens**: random token returned by the RPCs above, stored in `localStorage`
  (`pd_session_token`, see `src/lib/supabase.ts`) and sent back on `validate_session`/`logout`/
  admin calls. Password-reset tokens follow the same raw-token-in-link /
  SHA-256-hash-in-database pattern (`api/send-reset-email.mjs`).
- **Gemini API key**: not present in client code. `api/gemini.mjs` proxies requests server-side;
  the client only ever calls `/api/gemini`.
- **`api/send-reset-email.mjs`**: uses `SUPABASE_SERVICE_ROLE_KEY` (server-only) because RLS
  blocks the anon key from reading `salespersons` directly.

## Security model (Stage 2 — live on `main` and in Supabase)

Do not revert any of this either. SQL lives in `supabase/stage2_security.sql` (idempotent —
safe to re-run in the Supabase SQL editor).

- **RLS**: enabled on `projects`, `locations`, `whatsapp_templates`.
- **`projects` / `locations`**: public `SELECT` policy kept (listings still load for anyone with
  the anon key), but there are no insert/update/delete policies — all writes go through
  admin-gated `SECURITY DEFINER` functions instead:
  - `admin_save_project(p_token, p_id, p_payload)` — insert (`p_id` null) or update a project
    from the same payload object `AdminPanel.tsx`'s `save()` builds
  - `admin_update_project_personas(p_token, p_id, p_personas)` — sets `persona_pitches` after
    the Gemini call in `save()` returns
  - `admin_delete_project(p_token, p_id)`
  - `admin_add_location(p_token, p_name)`, `admin_delete_location(p_token, p_id)` — the delete
    function re-checks server-side that no project still references the location
  - All of the above call `is_admin_session(p_token)` first and raise an exception if it's false.
- **`whatsapp_templates`**: no public policies at all — fully private, reachable only through:
  - `get_my_whatsapp_templates(p_token)` / `save_my_whatsapp_template(p_token, p_project_id, p_message)`
  - Both resolve the caller's own salesperson id from `validate_session(p_token)` server-side,
    so a caller can never read or write another salesperson's templates.
- `Home.tsx` and `ProjectPage.tsx` are unaffected — they only ever `SELECT` from
  `projects`/`locations`, which stays public.

## Known follow-ups (not started)

- `AdminPanel.tsx` is ~1100 lines and could be split into smaller components.
