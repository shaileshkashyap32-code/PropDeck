// ─── Project assets ─────────────────────────────────────────────────────────
// Brochures, plans, galleries and video links attached to a project. Each asset
// is one of these kinds; none are required — a project shows only what it has.
// The order here is the order they appear on the page and in the WhatsApp message.

export const ASSET_KINDS = [
  { key: 'master_plan', label: 'Master Plan',     emoji: '📄' },
  { key: 'floor_plan',  label: 'Floor Plans',     emoji: '📐' },
  { key: 'brochure',    label: 'Project Brochure', emoji: '📘' },
  { key: 'gallery',     label: 'Image Gallery',   emoji: '🖼️' },
  { key: 'video',       label: 'Model Flat Video', emoji: '🎥' },
] as const

export type AssetKind = (typeof ASSET_KINDS)[number]['key']

export interface ProjectAsset {
  id: string
  project_id: string
  kind: string
  label: string
  url: string
  sort_order: number
}

export function assetKindMeta(kind: string) {
  return ASSET_KINDS.find((k) => k.key === kind) ?? { key: kind, label: kind || 'File', emoji: '🔗' }
}

// Orders assets by their kind's position, so a project's links always read
// master plan → floor plan → brochure → gallery → video.
export function sortAssets(a: ProjectAsset, b: ProjectAsset): number {
  const order = (k: string) => {
    const i = ASSET_KINDS.findIndex((x) => x.key === k)
    return i === -1 ? ASSET_KINDS.length : i
  }
  return order(a.kind) - order(b.kind) || a.sort_order - b.sort_order
}
