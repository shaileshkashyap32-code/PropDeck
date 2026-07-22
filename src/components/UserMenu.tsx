import { useState, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

// ─── Account dropdown ───────────────────────────────────────────────────────
// One home for every per-user destination, so the top bar stays down to a logo
// and this trigger. Previously each page scattered its own Admin / Profile /
// Logout buttons across the nav and they drifted apart page to page.
//
// Items are grouped; a `null` in the list draws a separator. Anything with
// `soon: true` renders greyed out with a "Soon" tag — that's the hook for
// future features, so adding one is a single line here.

export interface MenuItem {
  icon: string
  label: string
  onSelect?: () => void
  /** Right-aligned hint, e.g. a keyboard shortcut. */
  hint?: string
  /** Renders in red — used for Logout. */
  danger?: boolean
  /** Not built yet: shown disabled with a "Soon" tag. */
  soon?: boolean
}

interface Props {
  user: { name?: string; role?: string }
  /** Groups of items; rendered with a separator between each group. */
  groups: MenuItem[][]
}

const PANEL: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  minWidth: 232,
  background: 'var(--bg-raised)',
  border: '1px solid var(--border-strong)',
  borderRadius: 12,
  boxShadow: '0 16px 40px var(--shadow)',
  padding: 6,
  zIndex: 100,
}

// Every page builds its menu from this so the items, order and wording stay
// identical wherever you open it. Pass `undefined` for a destination that
// doesn't apply (e.g. onGoHome on Home itself) and it's left out.
export function buildAccountMenu(opts: {
  isAdmin: boolean
  onGoHome?: () => void
  onGoAdmin?: () => void
  onGoProfile: () => void
  onGoTemplates: () => void
  onLogout: () => void
}): MenuItem[][] {
  const navigate: MenuItem[] = []
  if (opts.onGoHome) navigate.push({ icon: '🏠', label: 'Home', onSelect: opts.onGoHome })
  if (opts.isAdmin && opts.onGoAdmin) {
    navigate.push({ icon: '⚙️', label: 'Admin Panel', onSelect: opts.onGoAdmin })
  }

  return [
    ...(navigate.length ? [navigate] : []),
    [
      { icon: '👤', label: 'My Profile', onSelect: opts.onGoProfile },
      { icon: '💬', label: 'WhatsApp Templates', onSelect: opts.onGoTemplates },
    ],
    // Future entries go here as their own group, e.g.
    //   [{ icon: '🔔', label: 'Notifications', onSelect: opts.onGoNotifications }],
    [{ icon: '↩', label: 'Logout', onSelect: opts.onLogout, danger: true }],
  ]
}

export default function UserMenu({ user, groups }: Props) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape. mousedown rather than click so the menu
  // is gone before whatever was clicked underneath reacts.
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

  const initial = user.name?.charAt(0).toUpperCase() ?? '?'

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account menu"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: open ? 'var(--border)' : 'transparent',
          border: '1px solid rgba(165,180,252,0.25)',
          borderRadius: 999,
          padding: '4px 10px 4px 4px',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 13,
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#4F46E5,#9333EA)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 12,
            color: '#FFFFFF',
            flexShrink: 0,
          }}
        >
          {initial}
        </span>
        <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name}
        </span>
        <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
      </button>

      {open && (
        <div role="menu" style={PANEL}>
          {/* Who you're signed in as — the menu is otherwise all verbs. */}
          <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid rgba(129,140,248,0.14)', marginBottom: 6 }}>
            <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{user.name}</div>
            <div style={{ color: 'var(--accent)', fontSize: 11, marginTop: 2 }}>
              {user.role === 'admin' ? '⚙ Admin' : '👤 Salesperson'}
            </div>
          </div>

          {groups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && (
                <div style={{ height: 1, background: 'rgba(129,140,248,0.14)', margin: '6px 4px' }} />
              )}
              {group.map((item) => {
                const key = `${gi}-${item.label}`
                const disabled = item.soon || !item.onSelect
                const isHover = hovered === key && !disabled
                return (
                  <button
                    key={key}
                    role="menuitem"
                    disabled={disabled}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => {
                      setOpen(false)
                      item.onSelect?.()
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 7,
                      border: 'none',
                      background: isHover ? 'rgba(99,102,241,0.18)' : 'transparent',
                      color: item.danger ? '#F87171' : disabled ? '#4B5563' : '#CBD5E1',
                      cursor: disabled ? 'default' : 'pointer',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.soon && (
                      <span
                        style={{
                          fontSize: 9,
                          background: 'rgba(148,163,184,0.15)',
                          color: 'var(--text-faint)',
                          padding: '2px 6px',
                          borderRadius: 999,
                        }}
                      >
                        Soon
                      </span>
                    )}
                    {item.hint && !item.soon && (
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{item.hint}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
