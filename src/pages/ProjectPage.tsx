import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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
  onLogout: () => void;
}

type PersonaKey = 'investor' | 'end_user' | 'first_time_buyer' | 'nri';

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`;
  return `₹${n}`;
}

export default function ProjectPage({ projectId, user, onBack, onLogout }: Props) {
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
        `📍 ${project.location}\n💰 ${fmt(project.price_min)} – ${fmt(project.price_max)}\n` +
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
    Object.values(project.persona_pitches).some(v => v)

  const PERSONAS: [PersonaKey, string, string][] = [
    ['investor',         '💰', 'Investor'],
    ['end_user',         '🏠', 'Family'],
    ['first_time_buyer', '🔑', 'First-Time'],
    ['nri',              '🌍', 'NRI'],
  ]

  // ── Nav ────────────────────────────────────────────────────────────────────
  const nav = (
    <nav style={{ background: 'rgba(30,27,75,0.95)', borderBottom: '1px solid rgba(79,70,229,0.25)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(12px)' }}>
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
  );

  if (loading) return <div style={{ minHeight: '100vh', background: '#0F0C29', color: 'white' }}>{nav}<div style={{ textAlign: 'center', padding: 80, color: '#A5B4FC' }}>Loading...</div></div>;
  if (!project) return <div style={{ minHeight: '100vh', background: '#0F0C29', color: 'white' }}>{nav}<div style={{ textAlign: 'center', padding: 80, color: '#A5B4FC' }}>Not found.</div></div>;

  const lms: Landmark[] = Array.isArray(project.landmarks) ? project.landmarks : [];

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0F0C29,#1E1B4B)', color: 'white', display: 'flex', flexDirection: 'column' }}>
      {nav}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, width: '100%', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start', boxSizing: 'border-box' }}>

        {/* ── LEFT ── */}
        <div>
          {/* Hero */}
          <div style={{ height: 240, borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg,rgba(79,70,229,0.3),rgba(147,51,234,0.3))', marginBottom: 20, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {project.image_url
              ? <img src={project.image_url} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 64, opacity: 0.3 }}>🏢</span>}
            <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 8 }}>
              <span style={{ background: project.status === 'Ready to Move' ? '#10B981' : '#F59E0B', color: 'white', fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>{project.status}</span>
              {project.rera_number && <span style={{ background: 'rgba(99,102,241,0.7)', color: 'white', fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>RERA ✓</span>}
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#6366F1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>{project.developer}</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px' }}>{project.name}</h1>
            <div style={{ color: '#94A3B8', fontSize: 14 }}>📍 {project.location}</div>
          </div>

          {/* ── Stats strip (CHANGE 1: Carpet Area → Super Built-Up Area) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
            {[
              ['Price', `${fmt(project.price_min)} – ${fmt(project.price_max)}`],
              ['BHK', project.bhk_types?.join(', ') || '—'],
              ['Super Built-Up Area', getSbaLabel()],
              ['Possession', project.possession_date || '—'],
            ].map(([l, v]) => (
              <div key={l} style={{ background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: '#6366F1', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', background: 'rgba(30,27,75,0.8)', borderRadius: 10, padding: 4, border: '1px solid rgba(79,70,229,0.2)', marginBottom: 22, gap: 3 }}>
            {[['overview','📋 Overview'],['landmarks','📍 Landmarks'],['pitch','🎯 Pitch Script']].map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400, background: tab === t ? 'linear-gradient(135deg,#4F46E5,#9333EA)' : 'transparent', color: tab === t ? 'white' : '#64748B' }}>{l}</button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ── */}
          {tab === 'overview' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#A5B4FC', marginBottom: 12 }}>Key Highlights</div>
              {project.usps?.filter(Boolean).length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24 }}>
                  {project.usps.filter(Boolean).map((u, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 14, color: '#E2E8F0' }}>
                      <span style={{ color: '#6366F1', fontWeight: 700 }}>✓</span>{u}
                    </li>
                  ))}
                </ul>
              ) : <div style={{ color: '#64748B', fontSize: 14, marginBottom: 20 }}>No highlights added yet.</div>}

              {/* ── CHANGE 2: Unit table — per-type pricing + SBA ── */}
              {getUnitRows().length > 0 && (
                <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(79,70,229,0.2)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'rgba(79,70,229,0.2)' }}>
                        {['Type', 'Super Built-Up Area (SBA)', 'Price Range'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#A5B4FC' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {getUnitRows().map((u, i) => (
                        <tr key={i} style={{ borderTop: '1px solid rgba(79,70,229,0.15)' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 500 }}>{u.type}</td>
                          <td style={{ padding: '10px 14px', color: '#94A3B8' }}>
                            {u.sba_min
                              ? `${u.sba_min}${u.sba_max && u.sba_max !== u.sba_min ? `–${u.sba_max}` : ''} sqft`
                              : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#A5B4FC' }}>
                            {fmt(u.price_min)}{u.price_max && u.price_max !== u.price_min ? ` – ${fmt(u.price_max)}` : ''}
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
              ? <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>No landmarks added yet.</div>
              : <div>
                  {lms.map((lm, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(79,70,229,0.1)', borderRadius: 8, padding: '12px 14px', marginBottom: 8, border: '1px solid rgba(79,70,229,0.2)' }}>
                      <div>
                        <div style={{ fontSize: 14, marginBottom: 4 }}>{lm.name}</div>
                        <span style={{ fontSize: 10, background: 'rgba(99,102,241,0.25)', color: '#A5B4FC', padding: '2px 8px', borderRadius: 10 }}>{lm.type}</span>
                      </div>
                      <div style={{ color: '#6366F1', fontWeight: 700 }}>{lm.distance}</div>
                    </div>
                  ))}
                </div>
          )}

          {/* ── PITCH TAB (CHANGE 3: 4 persona tabs) ── */}
          {tab === 'pitch' && (
            <div>
              {hasPersonas ? (
                <div>
                  {/* Persona selector buttons */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {PERSONAS.map(([key, icon, label]) => (
                      <button key={key} onClick={() => setPersona(key)}
                        style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: persona === key ? 600 : 400, borderColor: persona === key ? '#6366F1' : 'rgba(79,70,229,0.3)', background: persona === key ? 'linear-gradient(135deg,#4F46E5,#9333EA)' : 'transparent', color: persona === key ? 'white' : '#64748B' }}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>

                  {/* Persona label */}
                  <div style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>
                    {persona === 'investor' && 'For investors — focuses on rental yield, appreciation, airport corridor, infrastructure growth'}
                    {persona === 'end_user' && 'For families — focuses on schools, hospitals, daily convenience, community lifestyle'}
                    {persona === 'first_time_buyer' && 'For first-time buyers — focuses on entry price, EMI, RERA, trusted developer'}
                    {persona === 'nri' && 'For NRI buyers — focuses on developer reputation, rental income, NRI home loan, easy documentation'}
                  </div>

                  {/* Pitch content */}
                  <div style={{ background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: 12, padding: 22 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#A5B4FC' }}>
                        {PERSONAS.find(([k]) => k === persona)?.[1]} {PERSONAS.find(([k]) => k === persona)?.[2]} Pitch
                      </div>
                      <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.2)', color: '#10B981', padding: '3px 10px', borderRadius: 20 }}>AI Generated ✓</span>
                    </div>
                    <p style={{ color: '#E2E8F0', lineHeight: 1.9, fontSize: 14, marginBottom: 18, whiteSpace: 'pre-line' }}>
                      {project.persona_pitches![persona] || 'No pitch available for this persona.'}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(project.persona_pitches![persona] || '')
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      }}
                      style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 7, padding: '8px 18px', color: '#A5B4FC', cursor: 'pointer', fontSize: 13 }}>
                      {copied ? '✅ Copied!' : '📋 Copy Script'}
                    </button>
                  </div>
                </div>
              ) : project.pitch_script ? (
                /* Fallback: general pitch script */
                <div style={{ background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: 12, padding: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#A5B4FC' }}>General Pitch Script</div>
                    <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.2)', color: '#10B981', padding: '3px 10px', borderRadius: 20 }}>Script Ready ✓</span>
                  </div>
                  <p style={{ color: '#E2E8F0', lineHeight: 1.9, fontSize: 14, marginBottom: 18, whiteSpace: 'pre-line' }}>{project.pitch_script}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(project.pitch_script!); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                    style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 7, padding: '8px 18px', color: '#A5B4FC', cursor: 'pointer', fontSize: 13 }}>
                    {copied ? '✅ Copied!' : '📋 Copy Script'}
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>
                  No pitch script yet. Edit this project in Admin Panel → click ✨ Generate with AI.
                </div>
              )}
            </div>
          )}

          {/* Similar projects */}
          {similar.length > 0 && (
            <div style={{ marginTop: 36 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#A5B4FC', marginBottom: 14 }}>Similar Projects</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {similar.map(s => (
                  <div key={s.id} style={{ background: '#1E1B4B', borderRadius: 10, padding: 14, border: '1px solid rgba(79,70,229,0.2)' }}>
                    <div style={{ fontSize: 10, color: '#6366F1', marginBottom: 3 }}>{s.developer}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>📍 {s.location}</div>
                    <div style={{ fontSize: 13, color: '#A5B4FC', fontWeight: 600 }}>{fmt(s.price_min)} – {fmt(s.price_max)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div style={{ position: 'sticky', top: 72 }}>
          <div style={{ background: '#1E1B4B', border: '1px solid rgba(79,70,229,0.3)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 24, fontWeight: 700, background: 'linear-gradient(90deg,#818CF8,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>{fmt(project.price_min)}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>Starting price onwards</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {project.bhk_types?.map(b => (
                <span key={b} style={{ background: 'rgba(99,102,241,0.2)', color: '#A5B4FC', fontSize: 11, padding: '3px 9px', borderRadius: 4 }}>{b}</span>
              ))}
            </div>
          </div>

          <div style={{ background: '#1E1B4B', border: '1px solid rgba(79,70,229,0.3)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#A5B4FC', marginBottom: 12 }}>📲 Send to Client</div>
            <input type="tel" maxLength={10} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="Client's 10-digit number"
              style={{ width: '100%', background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: 8, padding: '9px 12px', color: 'white', fontSize: 13, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
            <button onClick={sendWA} disabled={phone.length !== 10}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: phone.length === 10 ? '#25D366' : 'rgba(37,211,102,0.2)', color: phone.length === 10 ? 'white' : '#64748B', fontWeight: 600, cursor: phone.length === 10 ? 'pointer' : 'default', fontSize: 14 }}>
              💬 Send on WhatsApp
            </button>
          </div>

          {project.google_maps_url && (
            <a href={project.google_maps_url} target="_blank" rel="noreferrer"
              style={{ display: 'block', background: 'rgba(79,70,229,0.15)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: 10, padding: 12, color: '#A5B4FC', textDecoration: 'none', textAlign: 'center', fontSize: 13 }}>
              🗺️ View on Google Maps
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
