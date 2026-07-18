import { useState, useEffect, useRef } from 'react'
import Login from './pages/Login'
import Home from './pages/Home'
import ProjectPage from './pages/ProjectPage'
import AdminPanel from './pages/AdminPanel'
import Profile from './pages/Profile'
import ResetPassword from './pages/ResetPassword'
import { supabase, saveSession, getSession, clearSession } from './lib/supabase'

type View = 'home' | 'project' | 'admin' | 'profile'

// ─── Remembered view ────────────────────────────────────────────────────────
// There's no router, so `view` lives only in React state and a refresh would
// otherwise always drop you back on your role's default screen — which meant an
// admin browsing Home got bounced into the admin panel on every reload.
// Remember where you are so a refresh keeps you there. sessionStorage rather
// than localStorage so two tabs can sit on different screens independently.
const VIEW_KEY = 'pd_view'
const VIEWS: View[] = ['home', 'project', 'admin', 'profile']

function readSavedView(): { view: View; projectId: string | null } | null {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (!VIEWS.includes(saved?.view)) return null
    const projectId = typeof saved.projectId === 'string' ? saved.projectId : null
    // A saved 'project' view is useless if we no longer know which project.
    if (saved.view === 'project' && !projectId) return null
    return { view: saved.view, projectId }
  } catch {
    return null
  }
}

function App() {
  const [user, setUser] = useState<any>(null)
  const [view, setView] = useState<View>('home')
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

  // Whether a PropDeck login is already in place. Kept in a ref, not state,
  // because the auth listener below is registered once and would otherwise
  // close over a stale `user`.
  const loggedInRef = useRef(false)

  // Land on the screen they were last on; fall back to the role's default the
  // first time (admins straight into the panel, everyone else on Home).
  const applyLandingView = (person: any) => {
    const saved = readSavedView()
    if (saved) {
      setView(saved.view)
      setProjectId(saved.projectId)
    } else {
      setView(person.role === 'admin' ? 'admin' : 'home')
    }
  }

  // ─── Google login glue ──────────────────────────────────────────────────
  // Supabase Auth proves the person owns a Google email. Our salespersons table
  // is still the source of truth for who's allowed in and what role they have.
  // So: after Google confirms an email, look it up in salespersons. Match = log
  // them in with our own user object. No match = sign the Google session back
  // out and tell them to contact their admin.
  const handleGoogleSession = async (session: any) => {
    const email = session?.user?.email
    if (!email) return false

    // link_google_session reads the verified email straight from the Google
    // sign-in token server-side, matches it against the team, and issues our
    // own session token. It returns nothing if the email isn't on the team.
    const { data } = await supabase.rpc('link_google_session')
    const person = Array.isArray(data) ? data[0] : data

    if (person) {
      saveSession(person.session_token)
      setUser(person)
      loggedInRef.current = true
      applyLandingView(person)
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
    const boot = async () => {
      // 1. Try to restore a previous PropDeck login (mobile/email or Google)
      //    from the session token we saved in localStorage.
      const token = getSession()
      if (token) {
        const { data } = await supabase.rpc('validate_session', { p_token: token })
        const person = Array.isArray(data) ? data[0] : data
        if (person) {
          setUser(person)
          loggedInRef.current = true
          // Restoring a session means a refresh (or a reopened tab), so go back
          // to the screen they were on rather than the role default.
          applyLandingView(person)
          setCheckingGoogle(false)
          return
        }
        clearSession() // expired or revoked
      }

      // 2. Otherwise, check whether we're coming back from a Google redirect.
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        await handleGoogleSession(data.session)
      }
      setCheckingGoogle(false)
    }
    boot()

    // Also react to the SIGNED_IN event fired right after the OAuth redirect.
    //
    // Careful: Supabase fires SIGNED_IN for more than an actual sign-in — it
    // also fires when it rehydrates a stored Google session on page load, and
    // again on every token refresh. Re-running the link on those would re-apply
    // the landing view and yank an admin out of whatever screen they were on,
    // moments after boot() had correctly restored it. So only treat this as a
    // real sign-in when no PropDeck login is in place yet.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session && !loggedInRef.current) {
        handleGoogleSession(session)
      }
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the remembered view in step with the current one, so a refresh at any
  // point lands back here. Only once logged in — a logged-out tab has no view
  // worth restoring.
  useEffect(() => {
    if (!user) return
    sessionStorage.setItem(VIEW_KEY, JSON.stringify({ view, projectId }))
  }, [user, view, projectId])

  // Clear the PropDeck session (server + local) and the Supabase Auth session,
  // otherwise a Google user would get silently re-logged-in.
  const doLogout = async () => {
    const token = getSession()
    if (token) await supabase.rpc('logout', { p_token: token })
    clearSession()
    sessionStorage.removeItem(VIEW_KEY)
    loggedInRef.current = false
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
        loggedInRef.current = true
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
