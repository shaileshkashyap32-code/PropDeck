import { useState, useEffect } from 'react';
import { supabase, getSession } from '../lib/supabase';
import AppShell from '../components/AppShell';
import UserMenu, { buildAccountMenu } from '../components/UserMenu';
import BrandLogo from '../components/BrandLogo';
import GlobalSearch from '../components/GlobalSearch';
import { formatPrice, formatRate } from '../lib/format';
import { statusMeta } from '../lib/status';
import { assetKindMeta, sortAssets, type ProjectAsset } from '../lib/assets';
import ThemeToggle from '../components/ThemeToggle';
import NotificationBell from '../components/NotificationBell';

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
  units_left?: number | null;
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

// Default two-message pair for "Send to Client". [Name] is substituted with the
// entered client name at send time. The details default is only used when the
// salesperson hasn't saved a per-project template in their Profile.
function defaultGreeting(projectName: string, sp: string) {
  return `Hi [Name], this is ${sp}. Thanks for connecting — sharing the details on ${projectName} below.`;
}
function defaultDetails(p: { name: string; developer: string; location: string; price_min: number; price_max: number; bhk_types: string[]; possession_date: string }, sp: string) {
  return `*${p.name}* by ${p.developer}\n\n📍 ${p.location}\n💰 ${formatPrice(p.price_min)} – ${formatPrice(p.price_max)}\n🏠 ${p.bhk_types?.join(', ')}\n📅 Possession: ${p.possession_date}\n\n– ${sp}`;
}

// Appends the project's brochure/plan/video links to the WhatsApp message, one
// per line: "📄 Master Plan: https://…"
function assetLinksBlock(assets: ProjectAsset[]): string {
  if (!assets.length) return '';
  return '\n\n' + assets.map((a) => `${assetKindMeta(a.kind).emoji} ${a.label}: ${a.url}`).join('\n');
}

// Inventory pill for the unit table. null/undefined = not tracked (—);
// 0 = sold out (red); low stock warns amber; otherwise green.
function availabilityBadge(unitsLeft: number | null | undefined) {
  if (unitsLeft == null) return <span style={{ color: 'var(--text-fainter)' }}>—</span>;
  const soldOut = unitsLeft === 0;
  const low = unitsLeft > 0 && unitsLeft <= 5;
  const color = soldOut ? '#F87171' : low ? '#F59E0B' : '#10B981';
  const bg = soldOut ? 'rgba(239,68,68,0.15)' : low ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)';
  const label = soldOut ? 'Sold out' : `${unitsLeft} left`;
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, color, background: bg }}>
      {label}
    </span>
  );
}

export default function ProjectPage({ projectId, user, onBack, onViewProject, ...menuNav }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [similar, setSimilar] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [persona, setPersona] = useState<PersonaKey>('investor');
  const [phone, setPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [greeting, setGreeting] = useState('');
  const [details, setDetails] = useState('');
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setTab('overview');
    setPhone(''); setClientName('');
    (async () => {
      const [{ data: p }, { data: s }, tmpl, assetRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('projects').select('*').neq('id', projectId).limit(3),
        supabase.rpc('get_my_whatsapp_templates', { p_token: getSession() }),
        supabase.from('project_assets').select('*').eq('project_id', projectId),
      ]);
      const proj = (p as Project) || null;
      setProject(proj);
      setSimilar((s as Project[]) || []);
      // Tolerate the assets table not existing yet (before the migration).
      const projAssets = assetRes.error ? [] : ((assetRes.data as ProjectAsset[]) || []).slice().sort(sortAssets);
      setAssets(projAssets);
      if (proj) {
        // Details defaults to the salesperson's saved per-project template
        // (set in Profile), falling back to a generated summary — then the
        // brochure/plan/video links are appended.
        const rows = (tmpl.data as { project_id: string; message: string }[]) || [];
        const saved = rows.find((r) => r.project_id === projectId)?.message;
        setGreeting(defaultGreeting(proj.name, user.name));
        setDetails((saved || defaultDetails(proj, user.name)) + assetLinksBlock(projAssets));
      }
      setLoading(false);
    })();
  }, [projectId]);

  // Fill [Name] with the entered client name (or a neutral fallback) and open
  // WhatsApp to the same number. WhatsApp only prefills one message per link, so
  // greeting and details are two separate sends to the same chat.
  const sendMsg = (text: string) => {
    if (phone.length !== 10) return;
    const filled = text.replace(/\[name\]/gi, clientName.trim() || 'there');
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(filled)}`, '_blank');
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  // Project-wide ₹/sqft summary for the stats box — spans the cheapest and dearest unit rates.
  const getRateLabel = () => {
    const units = (project?.unit_configs || []).filter(u => u.sba_min && u.price_min);
    if (units.length === 0) return null;
    const rates = units.flatMap(u => [
      u.price_min / u.sba_min!,
      (u.price_max || u.price_min) / (u.sba_max || u.sba_min!),
    ]);
    const min = Math.min(...rates), max = Math.max(...rates);
    return Math.round(min / 100) === Math.round(max / 100)
      ? formatRate(min)
      : `${formatRate(min).replace('/sqft', '')} – ${formatRate(max)}`;
  };

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
        <NotificationBell />
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
              <span style={{ background: statusMeta(project.status).solid, color: '#FFFFFF', fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>{project.status}</span>
              {project.rera_number && <span style={{ background: 'rgba(99,102,241,0.7)', color: '#FFFFFF', fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>RERA ✓</span>}
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#6366F1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>{project.developer}</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px' }}>{project.name}</h1>
            <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>📍 {project.location}</div>
          </div>

          {/* ── Stats strip (SBA box removed — SBA is shown per-unit in the table below) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 24 }}>
            {[
              ['Price', `${formatPrice(project.price_min)} – ${formatPrice(project.price_max)}`],
              ['Rate', getRateLabel()],
              ['BHK', project.bhk_types?.join(', ') || '—'],
              ['Possession', project.possession_date || '—'],
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={l} style={{ background: 'rgba(79,70,229,0.12)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: '#6366F1', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Tabs — Pitch Script tab hidden for now (kept in code, re-add to this list to restore) */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 10, padding: 4, border: '1px solid var(--border)', marginBottom: 22, gap: 3 }}>
            {[['overview','📋 Overview'],['landmarks','📍 Landmarks']].map(([t, l]) => (
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
              {getUnitRows().length > 0 && (() => {
                const rows = getUnitRows();
                // Only surface these columns when the admin is actually tracking them.
                const hasInventory = rows.some((u: UnitConfig) => u.units_left != null);
                const headers = [
                  'Type',
                  'Super Built-Up Area (SBA)',
                  'Price Range',
                  ...(hasInventory ? ['Availability'] : []),
                ];
                return (
                <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--border)' }}>
                        {headers.map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((u: UnitConfig, i: number) => (
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
                          {hasInventory && (
                            <td style={{ padding: '10px 14px' }}>{availabilityBadge(u.units_left)}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                );
              })()}
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
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: getRateLabel() ? 8 : 14 }}>Starting price onwards</div>
            {getRateLabel() && (
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14 }}>{getRateLabel()}</div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {project.bhk_types?.map(b => (
                <span key={b} style={{ background: 'rgba(99,102,241,0.2)', color: 'var(--text-muted)', fontSize: 11, padding: '3px 9px', borderRadius: 4 }}>{b}</span>
              ))}
            </div>
          </div>

          {assets.length > 0 && (
            <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>📎 Brochures & Assets</div>
              {assets.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, textDecoration: 'none', color: 'var(--text-bright)', fontSize: 13, background: 'rgba(79,70,229,0.08)', marginBottom: 6 }}>
                  <span style={{ flexShrink: 0 }}>{assetKindMeta(a.kind).emoji}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--accent)', flexShrink: 0 }}>↗</span>
                </a>
              ))}
            </div>
          )}

          {(() => {
            const ready = phone.length === 10;
            const field = { width: '100%', background: 'rgba(79,70,229,0.12)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const };
            const sendBtn = { width: '100%', padding: 9, borderRadius: 8, border: 'none', background: ready ? '#25D366' : 'rgba(37,211,102,0.2)', color: ready ? 'white' : 'var(--text-faint)', fontWeight: 600, cursor: ready ? 'pointer' : 'default', fontSize: 13 };
            return (
              <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>📲 Send to Client</div>

                {/* Entered once — used for both messages. */}
                <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client name"
                  style={{ ...field, marginBottom: 8 }} />
                <input type="tel" maxLength={10} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="Client's 10-digit number"
                  style={{ ...field, marginBottom: 14 }} />

                {/* Message 1 — greeting (personalise the name/context) */}
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>① Greeting</div>
                <textarea value={greeting} onChange={e => setGreeting(e.target.value)} rows={3}
                  style={{ ...field, resize: 'vertical', marginBottom: 6, fontFamily: 'inherit' }} />
                <button onClick={() => sendMsg(greeting)} disabled={!ready} style={{ ...sendBtn, marginBottom: 16 }}>
                  💬 Send greeting
                </button>

                {/* Message 2 — fixed project details (your saved template) */}
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>② Project details</div>
                <textarea value={details} onChange={e => setDetails(e.target.value)} rows={5}
                  style={{ ...field, resize: 'vertical', marginBottom: 6, fontFamily: 'inherit' }} />
                <button onClick={() => sendMsg(details)} disabled={!ready} style={sendBtn}>
                  💬 Send details
                </button>

                {!ready && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>Enter a 10-digit number to enable sending.</div>}
              </div>
            );
          })()}

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
