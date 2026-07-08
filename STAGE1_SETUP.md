# Stage 1 Security — Setup Steps

Do these **in order**. Takes ~5 minutes. After this, your database is private,
passwords are hashed, and the Gemini key is off the browser.

> ⚠️ Do the **code deploy (Step 3) BEFORE the SQL (Step 1)** only if you want zero
> downtime. Simplest is: run SQL, add env vars, then let Vercel deploy this branch.
> There will be a brief window where the old live site can't log in until the new
> code is deployed — fine for a small team, just deploy promptly.

## Step 1 — Run the SQL
1. Supabase → **SQL Editor** → New query.
2. Paste the entire contents of `stage1_security.sql`.
3. Click **Run**. You should see "Success. No rows returned."

## Step 2 — Add / rename environment variables in Vercel
Vercel → your project → **Settings → Environment Variables**:

| Action | Name | Value | Notes |
|--------|------|-------|-------|
| **Rename** | `VITE_GEMINI_API_KEY` → `GEMINI_API_KEY` | (same key value) | Removing the `VITE_` prefix keeps it off the browser |
| **Add** | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase → Settings → API → `service_role` secret | Server-only. Never prefix with `VITE_`. Needed by the reset-email function |

Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as they are.

## Step 3 — Deploy this branch
Merge / deploy so Vercel builds the new code.

## Step 4 — Test checklist (click through the live site)
- [ ] **Login** with mobile + password → lands on Home/Admin ✅
- [ ] **Login** with email + password → works ✅
- [ ] **Wrong password** → "Invalid credentials" ✅
- [ ] **Refresh the page while logged in** → stays logged in (new!) ✅
- [ ] **Continue with Google** (for an email that's on the team) → works ✅
- [ ] **Logout** → returns to login, and refresh does NOT log you back in ✅
- [ ] **Forgot password** → email arrives → link opens → set new password → login with it ✅
- [ ] **Admin → Team** → list shows, add / edit / remove a member all work ✅
- [ ] **Admin → Add Project → Quick Fill with AI** and **persona pitches** still generate ✅

## Verify the lockdown worked
In Supabase → Table Editor, the `salespersons` table should now show **RLS enabled**
(no longer "Unrestricted"). Its `password` column now shows long `$2a$...` bcrypt
hashes instead of readable passwords.
