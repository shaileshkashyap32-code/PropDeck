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

// Bumped from 'pd_theme' so any earlier saved preference is dropped and everyone
// starts from the dark default again. Light is still available via the toggle,
// and that choice re-persists under this key.
const KEY = 'pd_theme_v2'

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

// The login screen is always dark (the brand entry point), regardless of the
// saved preference. App forces this while logged out and restores the saved
// theme on login — without changing `current`, so the preference survives.
export function forceDark() {
  apply('dark')
}

export function applyCurrentTheme() {
  apply(current)
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => current,
  )
}
