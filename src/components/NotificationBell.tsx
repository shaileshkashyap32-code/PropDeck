import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, getSession } from '../lib/supabase'

// ─── Notification bell ──────────────────────────────────────────────────────
// Top-bar bell with an unread count. Opening it marks everything seen and shows
// the recent admin-activity feed. Polls so a salesperson mid-session finds out
// when the admin changes a project.
//
// Degrades silently before the notifications migration is applied: the RPC is
// missing, so the feed is just empty and the badge stays at zero.

interface Note {
  id: string
  message: string
  project_id: string | null
  created_at: string
  unread: boolean
}

const POLL_MS = 60000

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString()
}

export default function NotificationBell() {
  const [items, setItems] = useState<Note[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const fetchNotes = useCallback(async () => {
    const token = getSession()
    if (!token) return
    const { data, error } = await supabase.rpc('get_my_notifications', { p_token: token })
    if (error) return // pre-migration or transient — stay quiet
    const rows = (data as Note[]) ?? []
    setItems(rows)
    setUnread(rows.filter((n) => n.unread).length)
  }, [])

  useEffect(() => {
    fetchNotes()
    const t = setInterval(fetchNotes, POLL_MS)
    return () => clearInterval(t)
  }, [fetchNotes])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggleOpen = async () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      setUnread(0) // clear the badge immediately
      const token = getSession()
      if (token) await supabase.rpc('mark_notifications_seen', { p_token: token })
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={toggleOpen}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        title="Notifications"
        style={{
          position: 'relative',
          width: 34,
          height: 34,
          borderRadius: '50%',
          border: '1px solid rgba(165,180,252,0.25)',
          background: open ? 'var(--border)' : 'transparent',
          cursor: 'pointer',
          fontSize: 15,
          lineHeight: 1,
          color: 'var(--text-muted)',
        }}
      >
        🔔
        {unread > 0 && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              minWidth: 17,
              height: 17,
              padding: '0 4px',
              borderRadius: 999,
              background: '#EF4444',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 320,
            maxHeight: 420,
            overflowY: 'auto',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-strong)',
            borderRadius: 12,
            boxShadow: '0 16px 40px var(--shadow)',
            padding: 6,
            zIndex: 100,
          }}
        >
          <div style={{ padding: '8px 10px', fontSize: 13, fontWeight: 700, color: 'var(--text)', borderBottom: '1px solid rgba(129,140,248,0.14)', marginBottom: 4 }}>
            Notifications
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '18px 12px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
              You're all caught up.
            </div>
          ) : (
            items.map((n) => (
              <div key={n.id} style={{ display: 'flex', gap: 9, padding: '9px 10px', borderRadius: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: n.unread ? '#6366F1' : 'transparent' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-bright)' }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{timeAgo(n.created_at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
