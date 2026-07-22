import type { CSSProperties } from 'react'

// ─── Avatar ─────────────────────────────────────────────────────────────────
// Shows the salesperson's uploaded photo when there is one, otherwise their
// first initial on the brand gradient. One component so the nav, the account
// menu header and the profile card can never drift apart.

interface Props {
  name?: string
  /** Data URL (or any image src). Falls back to the initial when absent. */
  photo?: string | null
  size?: number
  style?: CSSProperties
}

export default function Avatar({ name, photo, size = 28, style }: Props) {
  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    ...style,
  }

  if (photo) {
    return <img src={photo} alt={name ?? 'Profile photo'} style={{ ...base, objectFit: 'cover' }} />
  }

  return (
    <span
      style={{
        ...base,
        background: 'linear-gradient(135deg,#4F46E5,#9333EA)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: Math.round(size * 0.42),
        color: '#FFFFFF',
      }}
    >
      {name?.charAt(0).toUpperCase() ?? '?'}
    </span>
  )
}
