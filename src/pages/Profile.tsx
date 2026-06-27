import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  user: any
  onBack: () => void
  onLogout: () => void
}

interface Project {
  id: string
  name: string
  developer: string
}

export default function Profile({ user, onBack, onLogout }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [templates, setTemplates] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: projs } = await supabase
        .from('projects')
        .select('id,name,developer')
        .order('name')

      const { data: tmps } = await supabase
        .from('whatsapp_templates')
        .select('project_id,message')
        .eq('salesperson_id', user.id)

      setProjects(projs as Project[] || [])
      const map: Record<string, string> = {}
      ;((tmps || []) as any[]).forEach(t => { map[t.project_id] = t.message })
      setTemplates(map)
      setLoading(false)
    }
    load()
  }, [user.id])

  const saveTemplate = async (projectId: string) => {
    const message = templates[projectId]
    if (!message?.trim()) return
    setSaving(projectId)
    await supabase.from('whatsapp_templates').upsert({
      salesperson_id: user.id,
      project_id: projectId,
      message: message.trim()
    }, { onConflict: 'salesperson_id,project_id' })
    setSaving(null)
    setSaved(projectId)
    setTimeout(() => setSaved(null), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0F0C29,#1E1B4B)', color: 'white', display: 'flex', flexDirection: 'column' }}>

      {/* NAV */}
      <nav style={{ background: 'rgba(30,27,75,0.95)', borderBottom: '1px solid rgba(79,70,229,0.25)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#9333EA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>P</div>
          <span style={{ fontWeight: 700, fontSize: 17, background: 'linear-gradient(90deg,#818CF8,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PropDeck</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={onBack} style={{ background: 'rgba(79,70,229,0.2)', border: '1px solid rgba(79,70,229,0.4)', borderRadius: 7, padding: '6px 16px', color: '#A5B4FC', cursor: 'pointer', fontSize: 13 }}>← Back</button>
          <span style={{ fontSize: 13, color: '#A5B4FC' }}>{user.name}</span>
          <button onClick={onLogout} style={{ background: 'none', border: '1px solid rgba(165,180,252,0.3)', borderRadius: 6, padding: '6px 14px', color: '#A5B4FC', cursor: 'pointer', fontSize: 13 }}>Logout</button>
        </div>
      </nav>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 32, width: '100%', boxSizing: 'border-box' }}>

        {/* Profile Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#4F46E5,#9333EA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22 }}>
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{user.name}</div>
            <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 2 }}>{user.mobile_number} · {user.role}</div>
          </div>
        </div>

        {/* WA Templates */}
        <div style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#A5B4FC', marginBottom: 6 }}>💬 WhatsApp Message Templates</div>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Set a custom message per project. WhatsApp button activates once message is saved.</div>

          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 24, fontSize: 13, color: '#FCD34D' }}>
            💡 Include project name, price, your name and contact number.
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#A5B4FC' }}>Loading projects...</div>
          ) : projects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>No projects found.</div>
          ) : (
            projects.map(p => {
              const hasMsg = templates[p.id]?.trim()
              const isSaving = saving === p.id
              const isSaved = saved === p.id
              return (
                <div key={p.id} style={{ marginBottom: 20, background: 'rgba(30,27,75,0.6)', borderRadius: 12, padding: 18, border: `1px solid ${hasMsg ? 'rgba(16,185,129,0.3)' : 'rgba(79,70,229,0.2)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: '#6366F1', marginTop: 2 }}>{p.developer}</div>
                    </div>
                    {hasMsg
                      ? <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.2)', color: '#10B981', padding: '3px 10px', borderRadius: 20 }}>✓ Set</span>
                      : <span style={{ fontSize: 11, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', padding: '3px 10px', borderRadius: 20 }}>Not set</span>}
                  </div>
                  <textarea
                    value={templates[p.id] || ''}
                    onChange={e => setTemplates(t => ({ ...t, [p.id]: e.target.value }))}
                    placeholder={`Hi! I'm ${user.name} from Vishal Realty.\n\nProject: ${p.name}\n📍 Location | 💰 Price\n\nCall me: ${user.mobile_number}`}
                    style={{ width: '100%', background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7, minHeight: 100, boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <span style={{ fontSize: 11, color: '#475569' }}>{(templates[p.id] || '').length} chars</span>
                    <button
                      onClick={() => saveTemplate(p.id)}
                      disabled={isSaving || !templates[p.id]?.trim()}
                      style={{ background: isSaved ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg,#4F46E5,#9333EA)', border: isSaved ? '1px solid #10B981' : 'none', borderRadius: 7, padding: '8px 20px', color: isSaved ? '#10B981' : 'white', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                    >
                      {isSaved ? '✅ Saved!' : isSaving ? 'Saving...' : 'Save Message'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}