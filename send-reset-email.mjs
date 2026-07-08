// Server-side proxy for Gemini so the API key never ships in the browser bundle.
// Set GEMINI_API_KEY in Vercel → Settings → Environment Variables (NOT the VITE_ one).
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { prompt, useSearch } = req.body || {}
  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt' })
    return
  }

  if (!GEMINI_API_KEY) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' })
    return
  }

  try {
    const body = { contents: [{ parts: [{ text: prompt }] }] }
    // The persona pitch generation grounds its answers in a live Google search.
    if (useSearch) body.tools = [{ google_search: {} }]

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
    const data = await r.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
    res.status(200).json({ text })
  } catch (err) {
    console.error('gemini proxy error:', err)
    res.status(500).json({ error: 'Gemini request failed' })
  }
}
