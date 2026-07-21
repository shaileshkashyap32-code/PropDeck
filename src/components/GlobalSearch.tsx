import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ─── Global search ──────────────────────────────────────────────────────────
// Lives in the top bar on every screen. Matches projects on name, developer or
// location and jumps straight to one — so a salesperson on a project page can
// reach another without going back to Home first.
//
// On Home it doubles as the grid filter: `onQueryChange` feeds the same text
// into the existing filter, so typing narrows the cards behind the dropdown.

export interface SearchHit {
  id: string
  name: string
  developer: string
  location: string
  price_min: number
  price_max: number
}

interface Props {
  onSelectProject: (id: string) => void
  /** Home mirrors the query into its card filter. */
  onQueryChange?: (q: string) => void
  /**
   * Controlled query. Pass alongside `onQueryChange` when the parent also owns
   * the text — Home does, so clearing its "search" filter chip empties the box
   * here too instead of leaving a stale query on screen.
   */
  value?: string
  /** Home already has the catalogue loaded — reuse it instead of refetching. */
  projects?: SearchHit[]
}

const MAX_HITS = 8

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  return `₹${(n / 100000).toFixed(0)}L`
}

export default function GlobalSearch({ onSelectProject, onQueryChange, value, projects }: Props) {
  const [items, setItems] = useState<SearchHit[]>(projects ?? [])
  const [ownQ, setOwnQ] = useState('')
  const q = value !== undefined ? value : ownQ
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Pages that pass a list keep it in sync; pages that don't fetch their own.
  const hasPreloaded = !!projects
  useEffect(() => {
    if (projects) setItems(projects)
  }, [projects])

  useEffect(() => {
    if (hasPreloaded) return
    supabase
      .from('projects')
      .select('id,name,developer,location,price_min,price_max')
      .order('name')
      .then(({ data }) => { if (data) setItems(data as SearchHit[]) })
  }, [hasPreloaded])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const query = q.trim().toLowerCase()
  const hits = query
    ? items
        .filter((p) =>
          p.name.toLowerCase().includes(query) ||
          p.developer.toLowerCase().includes(query) ||
          p.location.toLowerCase().includes(query)
        )
        .slice(0, MAX_HITS)
    : []

  const update = (next: string) => {
    if (value === undefined) setOwnQ(next)
    setActive(0)
    setOpen(true)
    onQueryChange?.(next)
  }

  const choose = (hit: SearchHit) => {
    setOpen(false)
    onSelectProject(hit.id)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!hits.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % hits.length) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + hits.length) % hits.length) }
    if (e.key === 'Enter') { e.preventDefault(); choose(hits[active]) }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', left: 12, fontSize: 12, color: '#818CF8', pointerEvents: 'none' }}>🔍</span>
        <input
          value={q}
          onChange={(e) => update(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search projects, developers, locations…"
          aria-label="Search projects"
          style={{
            width: '100%',
            background: 'rgba(79,70,229,0.15)',
            border: '1px solid rgba(79,70,229,0.3)',
            borderRadius: 8,
            padding: '8px 32px 8px 32px',
            color: 'white',
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {q && (
          <button
            onClick={() => { update(''); setOpen(false) }}
            aria-label="Clear search"
            style={{ position: 'absolute', right: 8, background: 'none', border: 'none', color: '#818CF8', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>

      {open && query.length > 0 && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            maxHeight: 320,
            overflowY: 'auto',
            background: '#1E1B4B',
            border: '1px solid rgba(129,140,248,0.22)',
            borderRadius: 10,
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            padding: 6,
            zIndex: 90,
          }}
        >
          {hits.length === 0 ? (
            <div style={{ padding: '10px 12px', color: '#64748B', fontSize: 13 }}>
              No projects match “{q.trim()}”
            </div>
          ) : (
            hits.map((hit, i) => (
              <button
                key={hit.id}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(hit)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 7,
                  border: 'none',
                  background: i === active ? 'rgba(99,102,241,0.2)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{hit.name}</div>
                <div style={{ color: '#818CF8', fontSize: 11, marginTop: 2 }}>
                  {hit.developer} · 📍{hit.location} · {fmt(hit.price_min)}–{fmt(hit.price_max)}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
