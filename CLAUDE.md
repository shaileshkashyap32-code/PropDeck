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
- **Direct `supabase.from(...)` table access** (not through an RPC) still happens for
  `projects`, `locations`, and `whatsapp_templates` — these are not RLS-locked yet (see
  Stage 2 below).

## Known follow-ups (not started)

- **Stage 2**: lock writes on `projects`, `locations`, and `whatsapp_templates` to admins only
  (currently writable via the anon key with no role check at the DB level).
- `AdminPanel.tsx` is ~1100 lines and could be split into smaller components.
