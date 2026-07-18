import { useState, useEffect } from 'react';
import { supabase, getSession } from '../lib/supabase';
import AppShell from '../components/AppShell';
import UserMenu, { buildAccountMenu } from '../components/UserMenu';

interface Salesperson {
  id: string;
  name: string;
  mobile_number: string;
  role: string;
}

interface Project {
  id: string;
  name: string;
  developer: string;
  location: string;
  price_min: number;
  price_max: number;
}

interface ProfileProps {
  user: Salesperson;
  /** Which of the two account screens to show — they share this component. */
  section: 'profile' | 'templates';
  onBack: () => void;
  onGoHome: () => void;
  onGoAdmin?: () => void;
  onGoProfile: () => void;
  onGoTemplates: () => void;
  onLogout: () => void;
}

type SaveStatus = 'saved' | 'error' | null;

export default function Profile({ user, section, onBack, ...nav }: ProfileProps) {
  const [projects, setProjects]     = useState<Project[]>([]);
  const [templates, setTemplates]   = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [loading, setLoading]       = useState(true);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: projectsData }, { data: templatesData }] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, developer, location, price_min, price_max')
        .order('name'),
      supabase.rpc('get_my_whatsapp_templates', { p_token: getSession() }),
    ]);
    if (projectsData) setProjects(projectsData);
    if (templatesData) {
      const map: Record<string, string> = {};
      templatesData.forEach((t: { project_id: string; message: string }) => {
        map[t.project_id] = t.message;
      });
      setTemplates(map);
    }
    setLoading(false);
  }

  async function saveTemplate(projectId: string) {
    const message = templates[projectId]?.trim();
    if (!message) return;
    setSaving(prev => ({ ...prev, [projectId]: true }));
    setSaveStatus(prev => ({ ...prev, [projectId]: null }));
    const { error } = await supabase.rpc('save_my_whatsapp_template', {
      p_token: getSession(), p_project_id: projectId, p_message: message,
    });
    setSaving(prev => ({ ...prev, [projectId]: false }));
    if (error) {
      setSaveStatus(prev => ({ ...prev, [projectId]: 'error' }));
    } else {
      setSaveStatus(prev => ({ ...prev, [projectId]: 'saved' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [projectId]: null })), 2500);
    }
  }

  function formatPrice(price: number): string {
    if (price >= 10_000_000) return `₹${(price / 10_000_000).toFixed(1)}Cr`;
    return `₹${(price / 100_000).toFixed(0)}L`;
  }

  const topBar = (
    <nav className="h-14 flex items-center justify-between px-4"
      style={{ background: 'rgba(15,12,41,0.85)', borderBottom: '1px solid rgba(79,70,229,0.2)', flexShrink: 0 }}>
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-indigo-300 hover:text-white transition-colors">
          ← Back
        </button>
        <span className="text-white font-semibold text-sm">
          {section === 'templates' ? 'WhatsApp Templates' : 'My Profile'}
        </span>
      </div>
      <UserMenu user={user} groups={buildAccountMenu({ isAdmin: user.role === 'admin', ...nav })} />
    </nav>
  );

  if (loading) {
    return (
      <AppShell topBar={topBar}>
        <p className="text-indigo-300 text-sm animate-pulse text-center pt-20">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell topBar={topBar}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* User Card */}
        {section === 'profile' && (
        <div className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: 'rgba(30,27,75,0.8)', border: '1px solid rgba(79,70,229,0.2)' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #9333EA)' }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">{user.name}</h2>
            <p className="text-indigo-300 text-sm">{user.mobile_number}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium"
              style={{
                background: user.role === 'admin' ? 'rgba(79,70,229,0.25)' : 'rgba(16,185,129,0.2)',
                color: user.role === 'admin' ? '#A5B4FC' : '#10B981',
              }}>
              {user.role === 'admin' ? '⚙ Admin' : '👤 Salesperson'}
            </span>
          </div>
        </div>
        )}

        {/* Editing your name / photo isn't built yet — see the note in the
            handover rather than pretending the fields exist. */}
        {section === 'profile' && (
          <div className="rounded-2xl p-5 text-sm"
            style={{ background: 'rgba(30,27,75,0.5)', border: '1px dashed rgba(79,70,229,0.3)', color: '#94A3B8' }}>
            Editing your photo and details is coming soon. For now, ask an admin to update
            your name or mobile number from the Team screen.
          </div>
        )}

        {/* WhatsApp Templates */}
        {section === 'templates' && (
        <div>
          <h3 className="text-white font-semibold text-base mb-1">WhatsApp Message Templates</h3>
          <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>
            Set a personalised message per project. It auto-fills when you tap{' '}
            <span className="text-indigo-300">Send to Client</span> on the project page.
          </p>

          <div className="space-y-3">
            {projects.map(project => {
              const currentMsg = templates[project.id] ?? '';
              const isSet    = currentMsg.trim().length > 0;
              const isSaving = !!saving[project.id];
              const status   = saveStatus[project.id] ?? null;

              return (
                <div key={project.id} className="rounded-xl p-4"
                  style={{ background: 'rgba(30,27,75,0.75)', border: '1px solid rgba(79,70,229,0.18)' }}>

                  {/* Project header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{project.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#A5B4FC' }}>
                        {project.developer} · {project.location} · {formatPrice(project.price_min)}–{formatPrice(project.price_max)}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: isSet ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.12)',
                        color: isSet ? '#10B981' : '#F59E0B',
                      }}>
                      {isSet ? '✓ Set' : 'Not set'}
                    </span>
                  </div>

                  {/* Textarea */}
                  <textarea
                    value={currentMsg}
                    onChange={e => setTemplates(prev => ({ ...prev, [project.id]: e.target.value }))}
                    placeholder={`Hi [Name], sharing details on ${project.name} by ${project.developer}. Starts at ${formatPrice(project.price_min)} in ${project.location}. Want to know more?`}
                    rows={3}
                    className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                    style={{ background: 'rgba(15,12,41,0.55)', border: '1px solid rgba(79,70,229,0.22)' }}
                  />

                  {/* Save row */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs"
                      style={{ color: status === 'error' ? '#F87171' : status === 'saved' ? '#10B981' : 'transparent' }}>
                      {status === 'error' ? '✗ Save failed — try again' : status === 'saved' ? '✓ Saved' : '·'}
                    </span>
                    <button
                      onClick={() => saveTemplate(project.id)}
                      disabled={isSaving || !currentMsg.trim()}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: status === 'saved' ? '#10B981' : 'linear-gradient(135deg, #4F46E5, #9333EA)' }}>
                      {isSaving ? 'Saving…' : status === 'saved' ? '✓ Saved' : 'Save Message'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

      </div>
    </AppShell>
  );
}