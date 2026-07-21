import { useTheme, toggleTheme } from '../lib/theme'

// ─── Light / dark switch ────────────────────────────────────────────────────
// A pill with a sliding knob. `showLabels` puts "Light" and "Dark" either side
// for roomier spots; the top bars use the bare pill.

interface Props {
  showLabels?: boolean
}

export default function ThemeToggle({ showLabels }: Props) {
  const theme = useTheme()
  const isDark = theme === 'dark'

  const pill = (
    <button
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      style={{
        position: 'relative',
        width: 52,
        height: 28,
        flexShrink: 0,
        borderRadius: 999,
        border: '1px solid var(--border-strong)',
        background: isDark ? 'rgba(79,70,229,0.25)' : 'rgba(99,102,241,0.9)',
        cursor: 'pointer',
        padding: 0,
        transition: 'background 160ms',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: isDark ? 25 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: isDark ? 'linear-gradient(135deg,#818CF8,#C4B5FD)' : '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          lineHeight: 1,
          transition: 'left 160ms',
          boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
        }}
      >
        {isDark ? '🌙' : '☀️'}
      </span>
    </button>
  )

  if (!showLabels) return pill

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: isDark ? 'var(--text-faint)' : 'var(--text)' }}>Light</span>
      {pill}
      <span style={{ fontSize: 12, fontWeight: 600, color: isDark ? 'var(--text)' : 'var(--text-faint)' }}>Dark</span>
    </div>
  )
}
