import crypto from 'crypto'

// This function runs server-side on Vercel, so it can read ANY env var set in your
// Vercel project settings regardless of the VITE_ prefix.
//
// SUPABASE_SERVICE_ROLE_KEY is required now that the salespersons table is locked
// down with Row Level Security — the public anon key can no longer read it, but the
// service-role key (server-only, never shipped to the browser) can. Add it in
// Vercel → Settings → Environment Variables. Find the value in
// Supabase → Settings → API → "service_role" secret.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// New — get a free API key at https://resend.com and add it as RESEND_API_KEY
// in Vercel → Settings → Environment Variables.
const RESEND_API_KEY = process.env.RESEND_API_KEY

// Optional — defaults to your known production URL if not set.
const SITE_URL = process.env.SITE_URL || 'https://vitejs-vite-gnc1eqwu.vercel.app'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false })
    return
  }

  const { identifier } = req.body || {}
  if (!identifier) {
    res.status(400).json({ ok: false })
    return
  }

  try {
    // 1. Look up the salesperson by mobile number OR email — both are valid credentials now.
    const filter = encodeURIComponent(`(mobile_number.eq.${identifier},email.eq.${identifier})`)
    const lookupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/salespersons?or=${filter}&select=id,name,email`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )
    const rows = await lookupRes.json()
    const person = Array.isArray(rows) ? rows[0] : null

    // Always respond the same way whether or not this number/email exists —
    // avoids letting someone probe which mobile numbers or emails are registered.
    if (!person || !person.email) {
      res.status(200).json({ ok: true })
      return
    }

    // 2. Generate a random raw token + its SHA-256 hash. Only the HASH is stored;
    // the raw token goes in the email link. The ResetPassword page re-hashes
    // whatever token is in the URL and looks for a match — the raw token itself
    // never touches the database.
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

    await fetch(`${SUPABASE_URL}/rest/v1/salespersons?id=eq.${person.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        reset_token_hash: tokenHash,
        reset_token_expires_at: expiresAt,
      }),
    })

    // 3. Send the actual email via Resend.
    const resetLink = `${SITE_URL}/?reset_token=${rawToken}`
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PropDeck <onboarding@resend.dev>', // swap for a verified domain address later if you want
        to: person.email,
        subject: 'Reset your PropDeck password',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color:#4F46E5;">PropDeck</h2>
            <p>Hi ${person.name || ''},</p>
            <p>Click below to set a new password. This link expires in 1 hour.</p>
            <p>
              <a href="${resetLink}"
                 style="display:inline-block; background:#4F46E5; color:white; padding:12px 24px; border-radius:8px; text-decoration:none;">
                Reset Password
              </a>
            </p>
            <p style="color:#666; font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      }),
    })

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('send-reset-email error:', err)
    // Still respond success-shaped so the client never learns whether something broke server-side.
    res.status(200).json({ ok: true })
  }
}
