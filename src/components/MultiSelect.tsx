import { useState, useEffect, useRef } from 'react'

// ─── Multi-select dropdown ──────────────────────────────────────────────────
// Used by the Home filters for Property Type: the full option list lives behind
// a dropdown so the sidebar stays short, while the handful of options people
// actually reach for sit outside it as quick chips (see Home.tsx).
//
// A native <select multiple> can't be styled to match and is awkward to use, so
// this is a button + checkbox panel.

interface Props {
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
  onClear: () => void
  /** Shown on the trigger when nothing is selected. */
  placeholder: string
  /** Optional per-option display text, e.g. adding an emoji. */
  renderLabel?: (value: string) => string
}

export default function MultiSelect({ options, selected, onToggle, onClear, placeholder, renderLabel }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // One or two selections read better spelled out than as a count.
  const summary =
    selected.length === 0 ? placeholder
      : selected.length <= 2 ? selected.join(', ')
      : `${selected.length} selected`

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(79,70,229,0.12)',
          border: '1px solid rgba(79,70,229,0.3)',
          borderRadius: 8,
          padding: '8px 12px',
          color: selected.length ? 'white' : '#94A3B8',
          fontSize: 13,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {summary}
        </span>
        {selected.length > 0 && (
          // Clearing from the trigger saves opening the panel just to undo.
          <span
            role="button"
            aria-label="Clear property types"
            onClick={(e) => { e.stopPropagation(); onClear() }}
            style={{ color: '#818CF8', fontSize: 14, lineHeight: 1 }}
          >
            ×
          </span>
        )}
        <span style={{ fontSize: 9, color: '#818CF8' }}>▼</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            maxHeight: 240,
            overflowY: 'auto',
            background: '#1E1B4B',
            border: '1px solid rgba(129,140,248,0.22)',
            borderRadius: 10,
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            padding: 6,
            zIndex: 50,
          }}
        >
          {options.map((opt) => {
            const on = selected.includes(opt)
            return (
              <button
                key={opt}
                role="option"
                aria-selected={on}
                onClick={() => onToggle(opt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 9px',
                  borderRadius: 6,
                  border: 'none',
                  background: on ? 'rgba(99,102,241,0.22)' : 'transparent',
                  color: on ? '#C7D2FE' : '#94A3B8',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: 4,
                    flexShrink: 0,
                    border: `1px solid ${on ? '#6366F1' : 'rgba(148,163,184,0.4)'}`,
                    background: on ? '#6366F1' : 'transparent',
                    color: 'white',
                    fontSize: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? '✓' : ''}
                </span>
                {renderLabel ? renderLabel(opt) : opt}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
