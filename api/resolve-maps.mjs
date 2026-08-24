// Resolves a Google Maps link — including short share links (maps.app.goo.gl,
// goo.gl/maps) that carry no coordinates — into an exact lat/lng, by following
// the redirect to the full place URL and reading the pin out of it.
// No Google API key, no billing: this only follows an HTTP redirect.

function extractLatLng(s) {
  if (!s) return null
  // Most accurate: the place pin embedded as !3d<lat>!4d<lng>.
  let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (m) return { lat: +m[1], lng: +m[2] }
  // Map centre: @lat,lng,zoom
  m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: +m[1], lng: +m[2] }
  // Query-style: q= / query= / destination= / ll= lat,lng
  m = s.match(/[?&](?:q|query|destination|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: +m[1], lng: +m[2] }
  return null
}

export default async function handler(req, res) {
  const url = (req.method === 'POST' ? req.body?.url : req.query?.url) || ''
  if (!url || !/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: 'Missing or invalid url' }); return
  }
  // Only follow Google Maps hosts — never an arbitrary user-supplied URL.
  try {
    const host = new URL(url).hostname
    if (!/(^|\.)(google\.[a-z.]+|goo\.gl|g\.co)$/i.test(host)) {
      res.status(400).json({ error: 'Not a Google Maps link' }); return
    }
  } catch {
    res.status(400).json({ error: 'Invalid url' }); return
  }

  // The pasted link may already contain coordinates.
  let coords = extractLatLng(url)
  let finalUrl = url

  if (!coords) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      const r = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PropDeckBot/1.0)' },
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      finalUrl = r.url || url
      coords = extractLatLng(finalUrl)
      if (!coords) {
        // Some responses only carry the pin inside the HTML body.
        const html = await r.text()
        coords = extractLatLng(html)
      }
    } catch (err) {
      console.error('resolve-maps error:', err)
    }
  }

  if (!coords) {
    res.status(200).json({ url: finalUrl, lat: null, lng: null, note: 'Could not read coordinates from that link' })
    return
  }
  res.status(200).json({ url: finalUrl, lat: coords.lat, lng: coords.lng })
}
