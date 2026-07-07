import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Home from './pages/Home'
import ProjectPage from './pages/ProjectPage'
import AdminPanel from './pages/AdminPanel'
import Profile from './pages/Profile'
import ResetPassword from './pages/ResetPassword'
import { supabase } from './lib/supabase'

function App() {
  const [user, setUser] = useState<any>(null)
  const [view, setView] = useState<'home' | 'project' | 'admin' | 'profile'>('home')
  const [projectId, setProjectId] = useState<string | null>(null)

  // While we check for a returning Google session on first load, show a splash
  // instead of flashing the login screen.
  const [checkingGoogle, setCheckingGoogle] = useState(true)
  const [googleError, setGoogleError] = useState('')

  // If the URL carries a ?reset_token=..., that means someone clicked a password-reset
  // email link. We show the reset screen regardless of login state, then clear the
  // token from the URL and the query-string state once they're done.
  const [resetToken, setResetToken] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('reset_token')
  )

  // ─── Google login glue ──────────────────────────────────────────────────
  // Supabase Auth proves the person owns a Google email. Our salespersons table
  // is still the source of truth for who's allowed in and what role they have.
  // So: after Google confirms an email, look it up in salespersons. Match = log
  // them in with our own user object. No match = sign the Google session back
  // out and tell them to contact their admin.
  const handleGoogleSession = async (session: any) => {
    const email = session?.user?.email
    if (!email) return false

    const { data: person } = await supabase
      .from('salespersons')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (person) {
      setUser(person)
      setView(person.role === 'admin' ? 'admin' : 'home')
      return true
    }

    // Email authenticated with Google but isn't a registered salesperson —
    // don't leave a dangling Supabase Auth session around.
    await supabase.auth.signOut()
    setGoogleError(
      `No PropDeck account is linked to ${email}. Ask your admin to add this email, then try again.`
    )
    return false
  }

  useEffect(() => {
    // On first load, check whether we're coming back from a Google redirect
    // (or already have a live session).
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        await handleGoogleSession(data.session)
      }
      setCheckingGoogle(false)
    })

    // Also react to the SIGNED_IN event fired right after the OAuth redirect.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        handleGoogleSession(session)
      }
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Make sure logging out clears the Supabase Auth session too, not just our
  // local user — otherwise a Google user would get silently re-logged-in.
  const doLogout = () => {
    supabase.auth.signOut()
    setUser(null)
    setView('home')
  }

  if (resetToken) {
    return (
      <ResetPassword
        token={resetToken}
        onDone={() => {
          window.history.replaceState({}, '', window.location.pathname)
          setResetToken(null)
        }}
      />
    )
  }

  if (checkingGoogle) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg,#0F0C29,#1E1B4B)',
          color: '#A5B4FC',
          fontSize: 15,
        }}
      >
        Loading…
      </div>
    )
  }

  if (!user) return (
    <Login
      googleError={googleError}
      onLogin={(u: any) => {
        setUser(u)
        setView(u.role === 'admin' ? 'admin' : 'home')
      }}
    />
  )

  if (view === 'project' && projectId) {
    return <ProjectPage
      projectId={projectId}
      user={user}
      onBack={() => setView('home')}
      onLogout={doLogout}
    />
  }

  if (view === 'admin' && user.role === 'admin') {
    return <AdminPanel
      user={user}
      onGoHome={() => setView('home')}
      onLogout={doLogout}
    />
  }

  if (view === 'profile') {
    return <Profile
      user={user}
      onBack={() => setView('home')}
      onLogout={doLogout}
    />
  }

  return <Home
    user={user}
    onViewProject={(id: string) => { setProjectId(id); setView('project') }}
    onGoAdmin={user.role === 'admin' ? () => setView('admin') : undefined}
    onGoProfile={() => setView('profile')}
    onLogout={doLogout}
  />
}

export default App
