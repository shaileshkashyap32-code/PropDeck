import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AppShell from '../components/AppShell';
import UserMenu, { buildAccountMenu } from '../components/UserMenu';
import BrandLogo from '../components/BrandLogo';
import GlobalSearch from '../components/GlobalSearch';
import { formatPrice } from '../lib/format';
import ThemeToggle from '../components/ThemeToggle';

interface Landmark {
  name: string;
  distance: string;
  type: string;
}

interface UnitConfig {
  type: string;
  price_min: number;
  price_max: number;
  sba_min: number | null;
  sba_max: number | null;
}

interface Project {
  id: string;
  name: string;
  developer: string;
  location: string;
  price_min: number;
  price_max: number;
  bhk_types: string[];
  possession_date: string;
  status: string;
  image_url: string | null;
  carpet_area_min: number | null;
  carpet_area_max: number | null;
  usps: string[];
  landmarks: Landmark[];
  pitch_script: string | null;
  google_maps_url: string | null;
  rera_number: string | null;
  tags: string[] | null;
  unit_configs: UnitConfig[] | null;
  persona_pitches: Record<string, string> | null;
}

interface Props {
  projectId: string;
  user: any;
  onBack: () => void;
  onViewProject: (id: string) => void;
  onGoHome: () => void;
  onGoAdmin?: () => void;
  onGoProfile: () => void;
  onGoTemplates: () => void;
  onLogout: () => void;
}

type PersonaKey = 'investor' | 'upgrade_buyer' | 'end_user' | 'first_time_buyer' | 'nri';


// Renders "text **bold** text" as real bold spans instead of showing raw asterisks.
// Only the wrapped portion is bolded/highlighted — everything else stays plain.
function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: 'var(--accent-bright)', fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// Strips ** markers for clean plain-text copy (WhatsApp / clipboard)
function stripBold(text: string) {
  return text.replace(/\*\*/g, '');
}

export default function ProjectPage({ projectId, user, onBack, onViewProject, ...menuNav }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [similar, setSimilar] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [persona, setPersona] = useState<PersonaKey>('investor');
  const [phone, setPhone] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setTab('overview');
    Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('projects').select('*').neq('id', projectId).limit(3),
    ]).then(([{ data: p }, { data: s }]) => {
      setProject((p as Project) || null);
      setSimilar((s as Project[]) || []);
      setLoading(false);
    });
  }, [projectId]);

  const sendWA = () => {
    if (!project || phone.length !== 10) return;
    const msg = encodeURIComponent(
      `Hi! Here are details for *${project.name}* by ${project.developer}\n\n` +
        `📍 ${project.location}\n💰 ${formatPrice(project.price_min)} – ${formatPrice(project.price_max)}\n` +
        `🏠 ${project.bhk_types?.join(', ')}\n📅 Possession: ${project.possession_date}\n\n– ${user.name}`
    );
    window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  // SBA summary for stats strip
  const getSbaLabel = () => {
    if (project?.unit_configs?.length) {
      const withSba = project.unit_configs.filter(u => u.sba_min)
      if (withSba.length === 0) return '—'
      const min = Math.min(...withSba.map(u => u.sba_min!))
      const max = Math.max(...withSba.map(u => u.sba_max || u.sba_min!))
      return min === max ? `${min} sqft` : `${min}–${max} sqft`
    }
    if (project?.carpet_area_min)
      return `${project.carpet_area_min}–${project.carpet_area_max} sqft`
    return '—'
  }

  // Unit rows for table: use unit_configs if available, else fall back to bhk_types
  const getUnitRows = () => {
    if (project?.unit_configs?.length) return project.unit_configs
    return (project?.bhk_types || []).map(type => ({
      type, price_min: project!.price_min, price_max: project!.price_max,
      sba_min: null, sba_max: null,
    }))
  }

  // Persona pitches
  const hasPersonas = project?.persona_pitches &&
    ['investor','upgrade_buyer','end_user','first_time_buyer','nri']
      .some(k => project.persona_pitches![k])

  const PERSONAS: [PersonaKey, string, string][] = [
    ['investor',         '💰', 'Investor'],
    ['upgrade_buyer',    '🏠', 'Upgrade'],
    ['first_time_buyer', '🔑', 'First-Time'],
    ['nri',              '🌍', 'NRI'],
  ]

  // Handles both old string format and new array format, and upgrade_buyer/end_user key
  const getPersonaContent = (key: string): string | string[] | null => {
    if (!project?.persona_pitches) return null
    return project.persona_pitches[key] ||
      (key === 'upgrade_buyer' ? project.persona_pitches['end_user'] : null) || null
  }

  // ── Nav ────────────────────────────────────────────────────────────────────
  const nav = (
    <nav style={{ background: 'var(--bg-bar)', borderBottom: '1px solid var(--border)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
      <BrandLogo onClick={menuNav.onGoHome} />
      {/* Spacer pushes search and controls to the right. */}
      <div style={{ flex: 1 }} />
      <div style={{ flex: '0 1 440px', minWidth: 0, display: 'flex' }}>
        <GlobalSearch onSelectProject={onViewProject} />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={onBack} style={{ background: 'var(--border)', border: '1px solid rgba(79,70,229,0.4)', borderRadius: 7, padding: '6px 16px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        <ThemeToggle />
        <UserMenu user={user} groups={buildAccountMenu({ ...menuNav, isAdmin: user.role === 'admin' })} />
      </div>
    </nav>
  );

  if (loading) return <AppShell topBar={nav}><div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>Loading...</div></AppShell>;
  if (!project) return <AppShell topBar={nav}><div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>Not found.</div></AppShell>;

  const lms: Landmark[] = Array.isArray(project.landmarks) ? project.landmarks : [];

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <AppShell topBar={nav}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, width: '100%', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start', boxSizing: 'border-box' }}>

        {/* ── LEFT ── */}
        <div>
          {/* Hero */}
          <div style={{ height: 240, borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg,var(--border-strong),rgba(147,51,234,0.3))', marginBottom: 20, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {project.image_url
              ? <img src={project.image_url} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 64, opacity: 0.3 }}>🏢</span>}
            <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 8 }}>
              <span style={{ background: project.status === 'Ready to Move' ? '#10B981' : '#F59E0B', color: '#FFFFFF', fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>{project.status}</span>
              {project.rera_number && <span style={{ background: 'rgba(99,102,241,0.7)', color: '#FFFFFF', fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>RERA ✓</span>}
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#6366F1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>{project.developer}</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px' }}>{project.name}</h1>
            <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>📍 {project.location}</div>
          </div>

          {/* ── Stats strip (CHANGE 1: Carpet Area → Super Built-Up Area) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
            {[
              ['Price', `${formatPrice(project.price_min)} – ${formatPrice(project.price_max)}`],
              ['BHK', project.bhk_types?.join(', ') || '—'],
              ['Super Built-Up Area', getSbaLabel()],
              ['Possession', project.possession_date || '—'],
            ].map(([l, v]) => (
              <div key={l} style={{ background: 'rgba(79,70,229,0.12)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: '#6366F1', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 10, padding: 4, border: '1px solid var(--border)', marginBottom: 22, gap: 3 }}>
            {[['overview','📋 Overview'],['landmarks','📍 Landmarks'],['pitch','🎯 Pitch Script']].map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400, background: tab === t ? 'linear-gradient(135deg,#4F46E5,#9333EA)' : 'transparent', color: tab === t ? 'white' : 'var(--text-faint)' }}>{l}</button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ── */}
          {tab === 'overview' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>Key Highlights</div>
              {project.usps?.filter(Boolean).length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24 }}>
                  {project.usps.filter(Boolean).map((u, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 14, color: 'var(--text-bright)' }}>
                      <span style={{ color: '#6366F1', fontWeight: 700 }}>✓</span>{u}
                    </li>
                  ))}
                </ul>
              ) : <div style={{ color: 'var(--text-faint)', fontSize: 14, marginBottom: 20 }}>No highlights added yet.</div>}

              {/* ── CHANGE 2: Unit table — per-type pricing + SBA ── */}
              {getUnitRows().length > 0 && (
                <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--border)' }}>
                        {['Type', 'Super Built-Up Area (SBA)', 'Price Range'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {getUnitRows().map((u, i) => (
                        <tr key={i} style={{ borderTop: '1px solid rgba(79,70,229,0.15)' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 500 }}>{u.type}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-dim)' }}>
                            {u.sba_min
                              ? `${u.sba_min}${u.sba_max && u.sba_max !== u.sba_min ? `–${u.sba_max}` : ''} sqft`
                              : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                            {formatPrice(u.price_min)}{u.price_max && u.price_max !== u.price_min ? ` – ${formatPrice(u.price_max)}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── LANDMARKS TAB ── */}
          {tab === 'landmarks' && (
            lms.length === 0
              ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)' }}>No landmarks added yet.</div>
              : <div>
                  {lms.map((lm, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(79,70,229,0.1)', borderRadius: 8, padding: '12px 14px', marginBottom: 8, border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 14, marginBottom: 4 }}>{lm.name}</div>
                        <span style={{ fontSize: 10, background: 'rgba(99,102,241,0.25)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 10 }}>{lm.type}</span>
                      </div>
                      <div style={{ color: '#6366F1', fontWeight: 700 }}>{lm.distance}</div>
                    </div>
                  ))}
                </div>
          )}

          {/* ── PITCH TAB (CHANGE 3: 4 persona tabs, CHANGE 4: bold highlights rendered) ── */}
          {tab === 'pitch' && (
            <div>
              {hasPersonas ? (
                <div>
                  {/* Persona selector buttons */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {PERSONAS.map(([key, icon, label]) => (
                      <button key={key} onClick={() => setPersona(key)}
                        style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: persona === key ? 600 : 400, borderColor: persona === key ? '#6366F1' : 'var(--border-strong)', background: persona === key ? 'linear-gradient(135deg,#4F46E5,#9333EA)' : 'transparent', color: persona === key ? 'white' : 'var(--text-faint)' }}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>

                  {/* Persona label */}
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10 }}>
                    {persona === 'investor' && '🔍 Web-researched: appreciation %, rental yield, upcoming infrastructure, competition prices'}
                    {(persona === 'upgrade_buyer' || persona === 'end_user') && '🔍 Web-researched: size comparison, price per sqft, family amenities, upgrade math'}
                    {persona === 'first_time_buyer' && '🔍 Web-researched: EMI estimate, rent vs buy, price comparison, tax benefits'}
                    {persona === 'nri' && '🔍 Web-researched: currency advantage, rental yield, NRI loans, repatriation rules'}
                  </div>

                  {/* Pitch content */}
                  <div style={{ background: 'rgba(79,70,229,0.1)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 22 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
                        {PERSONAS.find(([k]) => k === persona)?.[1]} {PERSONAS.find(([k]) => k === persona)?.[2]} Pitch
                      </div>
                      <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.2)', color: '#10B981', padding: '3px 10px', borderRadius: 20 }}>AI Generated ✓</span>
                    </div>
                    {(() => {
                        const content = getPersonaContent(persona)
                        if (Array.isArray(content) && content.length > 0) {
                          return (
                            <div>
                              {content.map((point, i) => (
                                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < content.length - 1 ? '1px solid rgba(79,70,229,0.12)' : 'none', alignItems: 'flex-start' }}>
                                  <span style={{ color: '#6366F1', fontWeight: 700, fontSize: 15, flexShrink: 0, marginTop: 2 }}>•</span>
                                  <span style={{ color: 'var(--text-bright)', fontSize: 14, lineHeight: 1.5 }}>{renderBold(point)}</span>
                                </div>
                              ))}
                              <div style={{ marginTop: 16 }}>
                                <button onClick={() => { navigator.clipboard.writeText(content.map(stripBold).join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                                  style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 7, padding: '8px 18px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
                                  {copied ? '✅ Copied!' : '📋 Copy All Points'}
                                </button>
                              </div>
                            </div>
                          )
                        } else if (typeof content === 'string' && content) {
                          return (
                            <div>
                              <p style={{ color: 'var(--text-bright)', lineHeight: 1.9, fontSize: 14, marginBottom: 16, whiteSpace: 'pre-line' }}>{renderBold(content)}</p>
                              <button onClick={() => { navigator.clipboard.writeText(stripBold(content)); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                                style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 7, padding: '8px 18px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
                                {copied ? '✅ Copied!' : '📋 Copy Script'}
                              </button>
                            </div>
                          )
                        }
                        return <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>No talking points yet. Re-save this project to generate with web search.</p>
                      })()}
                  </div>
                </div>
              ) : project.pitch_script ? (
                /* Fallback: general pitch script */
                <div style={{ background: 'rgba(79,70,229,0.1)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>General Pitch Script</div>
                    <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.2)', color: '#10B981', padding: '3px 10px', borderRadius: 20 }}>Script Ready ✓</span>
                  </div>
                  <p style={{ color: 'var(--text-bright)', lineHeight: 1.9, fontSize: 14, marginBottom: 18, whiteSpace: 'pre-line' }}>{project.pitch_script}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(project.pitch_script!); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                    style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 7, padding: '8px 18px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
                    {copied ? '✅ Copied!' : '📋 Copy Script'}
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)' }}>
                  No pitch script yet. Edit this project in Admin Panel → click ✨ Generate with AI.
                </div>
              )}
            </div>
          )}

          {/* Similar projects */}
          {similar.length > 0 && (
            <div style={{ marginTop: 36 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14 }}>Similar Projects</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {similar.map(s => (
                  <div key={s.id} style={{ background: 'var(--bg-raised)', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: '#6366F1', marginBottom: 3 }}>{s.developer}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>📍 {s.location}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{formatPrice(s.price_min)} – {formatPrice(s.price_max)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 24, fontWeight: 700, background: 'linear-gradient(90deg,var(--brand-from),var(--brand-to))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>{formatPrice(project.price_min)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14 }}>Starting price onwards</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {project.bhk_types?.map(b => (
                <span key={b} style={{ background: 'rgba(99,102,241,0.2)', color: 'var(--text-muted)', fontSize: 11, padding: '3px 9px', borderRadius: 4 }}>{b}</span>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>📲 Send to Client</div>
            <input type="tel" maxLength={10} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="Client's 10-digit number"
              style={{ width: '100%', background: 'rgba(79,70,229,0.12)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
            <button onClick={sendWA} disabled={phone.length !== 10}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: phone.length === 10 ? '#25D366' : 'rgba(37,211,102,0.2)', color: phone.length === 10 ? 'white' : 'var(--text-faint)', fontWeight: 600, cursor: phone.length === 10 ? 'pointer' : 'default', fontSize: 14 }}>
              💬 Send on WhatsApp
            </button>
          </div>

          {project.google_maps_url && (
            <a href={project.google_maps_url} target="_blank" rel="noreferrer"
              style={{ display: 'block', background: 'rgba(79,70,229,0.15)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: 12, color: 'var(--text-muted)', textDecoration: 'none', textAlign: 'center', fontSize: 13 }}>
              🗺️ View on Google Maps
            </a>
          )}
        </div>
      </div>
    </AppShell>
  );
}
