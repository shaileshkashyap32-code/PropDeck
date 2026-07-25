// ─── Project status ─────────────────────────────────────────────────────────
// The lifecycle stages a project can be in. Order here drives the admin
// dropdown and the salesperson filter.

export const PROJECT_STATUSES = ['Pre launch', 'Launched', 'Ready to move in', 'Resale'] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

// RERA isn't issued yet for pre-launch, and doesn't apply to resale listings,
// so those default to "NA".
export const RERA_NA_STATUSES: string[] = ['Pre launch', 'Resale']

interface StatusMeta {
  label: string   // short label for the compact card badge
  solid: string   // solid fill (card image badge, white text on top)
  text: string    // text colour for tinted badges
  tint: string    // tinted background for badges
}

const META: Record<string, StatusMeta> = {
  'Pre launch':       { label: 'Pre-launch', solid: '#9333EA', text: '#9333EA', tint: 'rgba(147,51,234,0.2)' },
  'Launched':         { label: 'Launched',   solid: '#F59E0B', text: '#F59E0B', tint: 'rgba(245,158,11,0.2)' },
  'Ready to move in': { label: 'Ready',      solid: '#10B981', text: '#10B981', tint: 'rgba(16,185,129,0.2)' },
  'Resale':           { label: 'Resale',     solid: '#0EA5E9', text: '#0EA5E9', tint: 'rgba(14,165,233,0.2)' },
  // Legacy values, so cards/filters stay sensible until the status backfill runs.
  'Under Construction': { label: 'Launched', solid: '#F59E0B', text: '#F59E0B', tint: 'rgba(245,158,11,0.2)' },
  'Ready to Move':      { label: 'Ready',    solid: '#10B981', text: '#10B981', tint: 'rgba(16,185,129,0.2)' },
}

export function statusMeta(s?: string | null): StatusMeta {
  return (s && META[s]) || { label: s || '—', solid: '#64748B', text: 'var(--text-dim)', tint: 'rgba(148,163,184,0.15)' }
}
