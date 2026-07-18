import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AppShell from '../components/AppShell';
import UserMenu, { buildAccountMenu } from '../components/UserMenu';

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
}
interface Props {
  user: any
  onViewProject: (id: string) => void
  onGoHome: () => void
  onGoAdmin?: () => void
  onGoProfile: () => void
  onGoTemplates: () => void
  onLogout: () => void
}

const TYPES = ['Studio','1BHK','2BHK','2.5BHK','3BHK','3.5BHK','4BHK','Penthouse','Villa','Townhouse','Plot'];
const PMIN = 5000000;
const PMAX = 80000000;
const STEP = 500000;

function fmt(n: number, atMax = false) {
  if (atMax || n >= PMAX) return '8Cr+';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`;
  return `₹${n}`;
}

function DualSlider({ vMin, vMax, onChange }: { vMin: number; vMax: number; onChange: (a: number, b: number) => void }) {
  const pct = (v: number) => ((v - PMIN) / (PMAX - PMIN)) * 100;
  return (
    <div>
      <style>{`.ds input[type=range]{position:absolute;width:100%;height:4px;background:transparent;-webkit-appearance:none;pointer-events:none;outline:none;top:0;left:0;margin:0;padding:0}.ds input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:all;width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#4F46E5,#9333EA);cursor:pointer;border:2.5px solid #E0E7FF;box-shadow:0 2px 8px rgba(79,70,229,0.5)}`}</style>
      <div style={{ position: 'relative', height: 4, background: 'rgba(99,102,241,0.15)', borderRadius: 3, marginBottom: 18 }}>
        <div style={{ position: 'absolute', left: `${pct(vMin)}%`, right: `${100 - pct(vMax)}%`, height: '100%', background: 'linear-gradient(90deg,#4F46E5,#9333EA)', borderRadius: 3 }} />
      </div>
      <div className="ds" style={{ position: 'relative', height: 20 }}>
        <input type="range" min={PMIN} max={PMAX} step={STEP} value={vMin} onChange={(e) => onChange(Math.min(+e.target.value, vMax - STEP), vMax)} />
        <input type="range" min={PMIN} max={PMAX} step={STEP} value={vMax} onChange={(e) => onChange(vMin, Math.max(+e.target.value, vMin + STEP))} />
      </div>
    </div>
  );
}

export default function Home({ user, onViewProject, ...nav }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bMin, setBMin] = useState(PMIN);
  const [bMax, setBMax] = useState(PMAX);
  const [location, setLocation] = useState('');
  const [selType, setSelType] = useState<string[]>([]);
  const [status, setStatus] = useState('all');

  useEffect(() => {
    Promise.all([
      supabase.from('projects').select('*').order('name'),
      supabase.from('locations').select('name').order('name'),
    ]).then(([{ data: projectsData }, { data: locsData }]) => {
      setProjects((projectsData as Project[]) || []);
      setLocations((locsData || []).map((l: { name: string }) => l.name));
      setLoading(false);
    });
  }, []);

  const toggleType = (b: string) => setSelType((p) => (p.includes(b) ? p.filter((x) => x !== b) : [...p, b]));

  const clearAll = () => {
    setBMin(PMIN); setBMax(PMAX); setLocation(''); setSelType([]); setStatus('all'); setSearch('');
  };

  const shown = projects.filter((p) => {
    const maxB = bMax >= PMAX ? Infinity : bMax;
    if (p.price_max < bMin) return false;
    if (p.price_min > maxB) return false;
    if (location && !p.location.toLowerCase().includes(location.toLowerCase())) return false;
    if (selType.length > 0 && !selType.some((b) => p.bhk_types?.some((t) => t.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase()))) return false;
    if (status !== 'all' && p.status !== status) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.developer.toLowerCase().includes(q) && !p.location.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <AppShell
      mainStyle={{ padding: 20 }}
      topBar={
        <nav style={{ background: 'rgba(30,27,75,0.95)', borderBottom: '1px solid rgba(79,70,229,0.25)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#9333EA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>P</div>
          <span style={{ fontWeight: 700, fontSize: 17, background: 'linear-gradient(90deg,#818CF8,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PropDeck</span>
        </div>
        <input
          style={{ flex: 1, maxWidth: 400, background: 'rgba(79,70,229,0.15)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: 8, padding: '8px 14px', color: 'white', fontSize: 13, outline: 'none' }}
          placeholder="Search projects, developers, locations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ marginLeft: 'auto' }}>
          {/* Already home, so no Home entry in the menu here. */}
          <UserMenu user={user} groups={buildAccountMenu({ ...nav, isAdmin: user.role === 'admin', onGoHome: undefined })} />
        </div>
        </nav>
      }
      sidebar={
        <aside style={{ width: 248, background: 'rgba(10,8,30,0.8)', borderRight: '1px solid rgba(79,70,229,0.2)', padding: 18, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1 }}>Filters</span>
            <button onClick={clearAll} style={{ background: 'none', border: 'none', color: '#6366F1', cursor: 'pointer', fontSize: 12 }}>Clear all</button>
          </div>

          {/* Budget */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>Budget Range</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: '#A5B4FC', marginBottom: 14 }}>
              <span style={{ background: 'rgba(79,70,229,0.2)', padding: '3px 10px', borderRadius: 6 }}>{fmt(bMin)}</span>
              <span style={{ color: '#475569' }}>to</span>
              <span style={{ background: 'rgba(79,70,229,0.2)', padding: '3px 10px', borderRadius: 6 }}>{fmt(bMax, bMax >= PMAX)}</span>
            </div>
            <DualSlider vMin={bMin} vMax={bMax} onChange={(a, b) => { setBMin(a); setBMax(b); }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginTop: 6 }}>
              <span>₹50L</span><span>₹8Cr+</span>
            </div>
          </div>

          {/* Location — dynamic from DB */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>Location</div>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{ width: '100%', background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: 8, padding: '8px 12px', color: 'white', fontSize: 13, outline: 'none' }}
            >
              <option value="" style={{ background: '#1E1B4B' }}>All Locations</option>
              {locations.map((l) => (
                <option key={l} value={l} style={{ background: '#1E1B4B' }}>{l}</option>
              ))}
            </select>
          </div>

          {/* Property Type */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>Property Type</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {TYPES.map((b) => {
                const on = selType.includes(b);
                const isPlot = b === 'Plot';
                return (
                  <button key={b} onClick={() => toggleType(b)} style={{ padding: '4px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid', borderColor: on ? (isPlot ? '#10B981' : '#6366F1') : 'rgba(79,70,229,0.3)', background: on ? (isPlot ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.3)') : 'transparent', color: on ? (isPlot ? '#10B981' : '#A5B4FC') : '#64748B' }}>
                    {isPlot ? '🏞️ Plot' : b}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>Status</div>
            <div style={{ display: 'flex', background: 'rgba(79,70,229,0.1)', borderRadius: 8, padding: 3, gap: 2 }}>
              {[['all','All'],['Ready to Move','Ready'],['Under Construction','UC']].map(([v, l]) => (
                <button key={v} onClick={() => setStatus(v)} style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: 'none', fontSize: 11, cursor: 'pointer', background: status === v ? 'linear-gradient(135deg,#4F46E5,#9333EA)' : 'transparent', color: status === v ? 'white' : '#64748B', fontWeight: status === v ? 600 : 400 }}>{l}</button>
              ))}
            </div>
          </div>
        </aside>
      }
    >
          <div style={{ fontSize: 13, color: '#A5B4FC', marginBottom: 16 }}>
            {loading ? 'Loading...' : `Showing ${shown.length} of ${projects.length} projects`}
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 80, color: '#A5B4FC' }}>Loading projects...</div>
          ) : shown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
              <div style={{ color: '#64748B' }}>No projects match your filters.</div>
              <button onClick={clearAll} style={{ marginTop: 16, background: 'rgba(79,70,229,0.3)', border: '1px solid rgba(79,70,229,0.4)', borderRadius: 8, padding: '8px 20px', color: '#A5B4FC', cursor: 'pointer', fontSize: 13 }}>Clear Filters</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 18 }}>
              {shown.map((p) => <Card key={p.id} project={p} onView={onViewProject} />)}
            </div>
          )}
    </AppShell>
  );
}

function Card({ project: p, onView }: { project: Project; onView: (id: string) => void }) {
  const isPlot = p.bhk_types?.includes('Plot');
  return (
    <div onClick={() => onView(p.id)} style={{ background: '#1E1B4B', borderRadius: 14, border: `1px solid ${isPlot ? 'rgba(16,185,129,0.3)' : 'rgba(79,70,229,0.2)'}`, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s' }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}>
      <div style={{ height: 150, background: isPlot ? 'linear-gradient(135deg,rgba(16,185,129,0.2),rgba(5,150,105,0.3))' : 'linear-gradient(135deg,rgba(79,70,229,0.3),rgba(147,51,234,0.3))', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 48, opacity: 0.3 }}>{isPlot ? '🏞️' : '🏢'}</span>}
        <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: p.status === 'Ready to Move' ? '#10B981' : '#F59E0B', color: 'white' }}>{p.status === 'Ready to Move' ? 'Ready' : 'UC'}</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 11, color: isPlot ? '#10B981' : '#6366F1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{p.developer}</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{p.name}</div>
        <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 10 }}>📍 {p.location}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#A5B4FC', marginBottom: 10 }}>{fmt(p.price_min)} – {fmt(p.price_max)}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
          {p.bhk_types?.map((b) => <span key={b} style={{ background: b === 'Plot' ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)', color: b === 'Plot' ? '#10B981' : '#A5B4FC', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{b}</span>)}
        </div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>📅 {p.possession_date}</div>
        <button onClick={(e) => { e.stopPropagation(); onView(p.id); }} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: isPlot ? 'linear-gradient(135deg,#059669,#10B981)' : 'linear-gradient(135deg,#4F46E5,#9333EA)', color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>View Details →</button>
      </div>
    </div>
  );
}
