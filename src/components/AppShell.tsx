import type { CSSProperties, ReactNode } from 'react'

interface Props {
  /** Fixed bar across the top (logo, search, account actions). Never scrolls. */
  topBar: ReactNode
  /** Optional full-width bar directly under the top bar — e.g. the admin mobile tabs. */
  subBar?: ReactNode
  /** Optional fixed left sidebar. Callers hide it themselves on mobile by passing null. */
  sidebar?: ReactNode
  /** Scrollable main content. This is the ONLY region that scrolls. */
  children: ReactNode
  /** Extra styles merged onto the scrolling <main> (usually padding). */
  mainStyle?: CSSProperties
}

const SHELL: CSSProperties = {
  height: '100vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(135deg,#0F0C29,#1E1B4B)',
  color: 'white',
}

// The whole point of this component: pin the top bar and sidebar and let only the
// main column scroll. The two things that make that work are `height: 100vh` +
// `overflow: hidden` on the shell (so the page as a whole never scrolls) and
// `minHeight: 0` on the flex row/main (without it, a flex child refuses to shrink
// below its content and the top bar gets pushed off-screen — the original bug).
export default function AppShell({ topBar, subBar, sidebar, children, mainStyle }: Props) {
  return (
    <div style={SHELL}>
      {topBar}
      {subBar}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {sidebar}
        <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', ...mainStyle }}>
          {children}
        </main>
      </div>
    </div>
  )
}
