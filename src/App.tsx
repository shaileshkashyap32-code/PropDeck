import { useState } from 'react'
import Login from './pages/Login'
import Home from './pages/Home'
import ProjectPage from './pages/ProjectPage'
import AdminPanel from './pages/AdminPanel'
import Profile from './pages/Profile'
import ResetPassword from './pages/ResetPassword'

function App() {
  const [user, setUser] = useState<any>(null)
  const [view, setView] = useState<'home' | 'project' | 'admin' | 'profile'>('home')
  const [projectId, setProjectId] = useState<string | null>(null)

  // If the URL carries a ?reset_token=..., that means someone clicked a password-reset
  // email link. We show the reset screen regardless of login state, then clear the
  // token from the URL and the query-string state once they're done.
  const [resetToken, setResetToken] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('reset_token')
  )

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

  if (!user) return <Login onLogin={(u: any) => {
    setUser(u)
    setView(u.role === 'admin' ? 'admin' : 'home')
  }} />

  if (view === 'project' && projectId) {
    return <ProjectPage
      projectId={projectId}
      user={user}
      onBack={() => setView('home')}
      onLogout={() => { setUser(null); setView('home') }}
    />
  }

  if (view === 'admin' && user.role === 'admin') {
    return <AdminPanel
      user={user}
      onGoHome={() => setView('home')}
      onLogout={() => { setUser(null); setView('home') }}
    />
  }

  if (view === 'profile') {
    return <Profile
      user={user}
      onBack={() => setView('home')}
      onLogout={() => { setUser(null); setView('home') }}
    />
  }

  return <Home
    user={user}
    onViewProject={(id: string) => { setProjectId(id); setView('project') }}
    onGoAdmin={user.role === 'admin' ? () => setView('admin') : undefined}
    onGoProfile={() => setView('profile')}
    onLogout={() => setUser(null)}
  />
}

export default App
