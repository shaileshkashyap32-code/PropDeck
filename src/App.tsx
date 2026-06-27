import { useState } from 'react'
import Login from './pages/Login'
import Home from './pages/Home'
import ProjectPage from './pages/ProjectPage'
import AdminPanel from './pages/AdminPanel'
import Profile from './pages/Profile'

function App() {
  const [user, setUser] = useState<any>(null)
  const [view, setView] = useState<'home' | 'project' | 'admin' | 'profile'>('home')
  const [projectId, setProjectId] = useState<string | null>(null)

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