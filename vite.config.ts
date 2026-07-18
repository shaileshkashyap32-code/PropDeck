import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// ─── Dev-only /api bridge ────────────────────────────────────────────────────
// In production Vercel runs the functions in /api. Locally, `vite dev` doesn't
// know about them, so this middleware loads each api/<name>.mjs handler on
// demand and calls it with the Express/Vercel-shaped (req, res) the handlers
// expect. This lets the Gemini proxy and reset-email function work on
// localhost:3000 with no Vercel account or `vercel dev` required.
//
// Server-only secrets (GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY)
// are read from .env.local into process.env for the handlers only — they are
// never exposed to the client bundle (Vite only ships VITE_-prefixed vars).
type ApiHandler = (req: any, res: any) => unknown

function devApiPlugin(env: Record<string, string>): Plugin {
  const handlerCache = new Map<string, ApiHandler>()
  return {
    name: 'propdeck-dev-api',
    apply: 'serve',
    configureServer(server) {
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use('/api', async (req, res, next) => {
        const original = (req as { originalUrl?: string }).originalUrl || req.url || ''
        const name = original.split('?')[0].replace(/^\/api\//, '').replace(/\/+$/, '')
        if (!name) return next()

        const file = path.resolve(process.cwd(), 'api', `${name}.mjs`)
        try {
          let handler = handlerCache.get(file)
          if (!handler) {
            handler = (await import(pathToFileURL(file).href)).default as ApiHandler
            handlerCache.set(file, handler)
          }
          ;(req as { body?: unknown }).body = await readJsonBody(req)
          await handler(req, withVercelHelpers(res))
        } catch (err) {
          console.error(`[dev-api] /api/${name} failed:`, err)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'dev api handler failed' }))
          }
        }
      })
    },
  }
}

// Vite's dev server never parses request bodies — read and JSON-decode it so
// handlers can use req.body the same way they do on Vercel.
function readJsonBody(req: NodeJS.ReadableStream): Promise<unknown> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

// Node's bare ServerResponse has no .status()/.json(); add the Vercel/Express
// shims the handlers call.
function withVercelHelpers(res: any) {
  res.status = (code: number) => { res.statusCode = code; return res }
  res.json = (body: unknown) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
  }
  return res
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // '' prefix = load ALL vars (incl. server-only) into `env` for the api bridge.
  // This does NOT expose them to the client — that's governed by envPrefix.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devApiPlugin(env)],
  }
})
