import { useState, useEffect, useRef } from 'react';
import { supabase, getSession } from '../lib/supabase';
import AppShell from '../components/AppShell';
import UserMenu, { buildAccountMenu } from '../components/UserMenu';
import ThemeToggle from '../components/ThemeToggle';
import Avatar from '../components/Avatar';
import { formatPrice } from '../lib/format';
import { downscaleImage } from '../lib/image';

interface Salesperson {
  id: string;
  name: string;
  mobile_number: string;
  role: string;
  avatar_url?: string | null;
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
  /** Propagates a new/removed photo up so every top bar updates live. */
  onAvatarChange: (url: string | null) => void;
}

type SaveStatus = 'saved' | 'error' | null;

export default function Profile({ user, section, onBack, onAvatarChange, ...nav }: ProfileProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
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

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith('image/')) { setPhotoError('Please choose an image file.'); return; }
    setPhotoError('');
    setPhotoBusy(true);
    try {
      // Shrink to a small square data URL so the stored string stays a few KB.
      const dataUrl = await downscaleImage(file, 256);
      const { error } = await supabase.rpc('set_my_avatar', { p_token: getSession(), p_avatar: dataUrl });
      if (error) throw error;
      onAvatarChange(dataUrl);
    } catch (err: any) {
      setPhotoError(err?.message?.includes('function')
        ? 'Photo upload isn’t enabled yet — run the avatars migration.'
        : 'Could not save photo. Please try again.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true); setPhotoError('');
    const { error } = await supabase.rpc('set_my_avatar', { p_token: getSession(), p_avatar: null });
    setPhotoBusy(false);
    if (error) { setPhotoError('Could not remove photo.'); return; }
    onAvatarChange(null);
  }

  const topBar = (
    <nav className="h-14 flex items-center justify-between px-4"
      style={{ background: 'var(--bg-bar)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors">
          ← Back
        </button>
        <span className="text-[color:var(--text)] font-semibold text-sm">
          {section === 'templates' ? 'WhatsApp Templates' : 'My Profile'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserMenu user={user} groups={buildAccountMenu({ isAdmin: user.role === 'admin', ...nav })} />
      </div>
    </nav>
  );

  if (loading) {
    return (
      <AppShell topBar={topBar}>
        <p className="text-[color:var(--text-muted)] text-sm animate-pulse text-center pt-20">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell topBar={topBar}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* User Card */}
        {section === 'profile' && (
        <div className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="relative flex-shrink-0">
            <Avatar name={user.name} photo={user.avatar_url} size={64} />
            {/* Tap the badge or the avatar to pick a new photo. */}
            <button onClick={() => fileRef.current?.click()} disabled={photoBusy}
              title="Change photo" aria-label="Change photo"
              className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center"
              style={{ width: 24, height: 24, background: 'linear-gradient(135deg,#4F46E5,#9333EA)', border: '2px solid var(--bg-card)', color: '#FFFFFF', fontSize: 11, cursor: photoBusy ? 'default' : 'pointer' }}>
              {photoBusy ? '…' : '✎'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickPhoto} style={{ display: 'none' }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[color:var(--text)] font-bold text-lg leading-tight">{user.name}</h2>
            <p className="text-[color:var(--text-muted)] text-sm">{user.mobile_number}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium"
              style={{
                background: user.role === 'admin' ? 'var(--border)' : 'rgba(16,185,129,0.2)',
                color: user.role === 'admin' ? 'var(--text-muted)' : '#10B981',
              }}>
              {user.role === 'admin' ? '⚙ Admin' : '👤 Salesperson'}
            </span>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <button onClick={() => fileRef.current?.click()} disabled={photoBusy}
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: photoBusy ? 'default' : 'pointer', padding: 0 }}>
                {photoBusy ? 'Saving…' : user.avatar_url ? 'Change photo' : 'Upload photo'}
              </button>
              {user.avatar_url && !photoBusy && (
                <button onClick={removePhoto}
                  style={{ color: '#F87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Remove
                </button>
              )}
            </div>
            {photoError && <p className="text-xs mt-1" style={{ color: '#F87171' }}>{photoError}</p>}
          </div>
        </div>
        )}

        {/* WhatsApp Templates */}
        {section === 'templates' && (
        <div>
          <h3 className="text-[color:var(--text)] font-semibold text-base mb-1">WhatsApp Message Templates</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>
            Set a personalised message per project. It auto-fills when you tap{' '}
            <span className="text-[color:var(--text-muted)]">Send to Client</span> on the project page.
          </p>

          <div className="space-y-3">
            {projects.map(project => {
              const currentMsg = templates[project.id] ?? '';
              const isSet    = currentMsg.trim().length > 0;
              const isSaving = !!saving[project.id];
              const status   = saveStatus[project.id] ?? null;

              return (
                <div key={project.id} className="rounded-xl p-4"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

                  {/* Project header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-[color:var(--text)] font-medium text-sm truncate">{project.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
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
                    className="w-full rounded-lg px-3 py-2 text-sm text-[color:var(--text)] placeholder-[color:var(--text-fainter)] resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                    style={{ background: 'var(--bg-inset)', border: '1px solid rgba(79,70,229,0.22)' }}
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
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--text)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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