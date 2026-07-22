// ─── Bangalore zones ────────────────────────────────────────────────────────
// The five buckets a customer thinks in ("I want North Bangalore"). A location
// carries one or more of these (border areas like Sarjapur span two); projects
// inherit their location's zones. Assignment is manual, in the admin panel.
//
// The tool is Bangalore-only for now. When other cities arrive, a city layer
// sits ABOVE this and these stay the middle grouping — the stored value is data,
// not code, so that's an additive change.

export const ZONES = ['North', 'South', 'East', 'West', 'Central'] as const

/** "North" → "North Bangalore" for display; the short name is what's stored. */
export function zoneLabel(z: string): string {
  return `${z} Bangalore`
}
