import { useSyncExternalStore } from 'react'

// ─── Theme ──────────────────────────────────────────────────────────────────
// Colours live as CSS custom properties in index.css; this only flips
// `data-theme` on <html> and remembers the choice. Nothing re-renders for a
// theme change — the browser recomputes var() itself — so the store exists
// purely so the toggle can draw itself in the right position.
//
// Defaults to dark: that's what the app has always looked like, and a
// salesperson opening it on a light-mode laptop shouldn't find it repainted.

export type Theme = 'dark' | 'light'

const KEY = 'pd_theme'

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

let current: Theme = read()
const listeners = new Set<() => void>()

function apply(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
}

// Applied at import time, before React paints, so there's no flash of the
// wrong theme on reload.
apply(current)

export function setTheme(t: Theme) {
  if (t === current) return
  current = t
  apply(t)
  try { localStorage.setItem(KEY, t) } catch { /* private mode — session only */ }
  listeners.forEach((l) => l())
}

export function toggleTheme() {
  setTheme(current === 'dark' ? 'light' : 'dark')
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => current,
  )
}
