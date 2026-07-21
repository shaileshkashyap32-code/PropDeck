// ─── Brand logo ─────────────────────────────────────────────────────────────
// Clickable everywhere: it's the standard "take me home" affordance, and the
// app has no other persistent way back from a project page.
//
// `zoneWidth` makes the logo occupy a fixed column with a right border, so the
// divider lines up with the sidebar edge directly below it instead of the
// logo and search running together. Pages without a sidebar omit it.

interface Props {
  onClick?: () => void
  /** Width of the logo column; draws a divider matching the sidebar below. */
  zoneWidth?: number
  /** Hide the wordmark, keeping just the P tile (mobile). */
  compact?: boolean
  /** Small pill after the wordmark, e.g. "Admin". */
  badge?: string
}

export default function BrandLogo({ onClick, zoneWidth, compact, badge }: Props) {
  const inner = (
    <>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#9333EA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', flexShrink: 0 }}>
        P
      </div>
      {!compact && (
        <span style={{ fontWeight: 700, fontSize: 17, background: 'linear-gradient(90deg,#818CF8,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          PropDeck
        </span>
      )}
      {badge && (
        <span style={{ fontSize: 11, background: 'rgba(147,51,234,0.3)', color: '#C084FC', padding: '2px 8px', borderRadius: 10 }}>
          {badge}
        </span>
      )}
    </>
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        height: '100%',
        boxSizing: 'border-box',
        ...(zoneWidth
          ? { width: zoneWidth, paddingLeft: 24, borderRight: '1px solid rgba(79,70,229,0.2)' }
          : {}),
      }}
    >
      {onClick ? (
        <button
          onClick={onClick}
          title="Go to home"
          aria-label="PropDeck — go to home"
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          {inner}
        </button>
      ) : (
        inner
      )}
    </div>
  )
}
