import { useState, useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import AppShell from '../components/AppShell';
import UserMenu, { buildAccountMenu } from '../components/UserMenu';
import MultiSelect from '../components/MultiSelect';
import BrandLogo from '../components/BrandLogo';
import GlobalSearch, { matchesQuery } from '../components/GlobalSearch';
import ThemeToggle from '../components/ThemeToggle';
import { ZONES, zoneLabel } from '../lib/zones';

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
  unit_configs: UnitConfig[] | null;
}
interface UnitConfig {
  type: string;
  price_min: number;
  price_max: number;
}
interface LocationRow {
  name: string;
  zones: string[];
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
// The handful of configurations that come up in most conversations. These sit
// outside the dropdown as one-click chips; the full list is still in it.
const POPULAR_TYPES = ['1BHK','2BHK','3BHK','4BHK'];
const POPULAR_LOCATION_COUNT = 5;
// Outer width of the filter sidebar, shared with the top bar's logo column so
// the two borders form one continuous vertical line. Border-box, so this
// includes the 18px padding and 1px border (content stays 248px as before).
const SIDEBAR_WIDTH = 285;

// Shared look for the quick-pick chips under both dropdowns.
const chipStyle = (on: boolean): CSSProperties => ({
  padding: '4px 11px',
  borderRadius: 20,
  fontSize: 12,
  cursor: 'pointer',
  border: '1px solid',
  borderColor: on ? '#6366F1' : 'var(--border-strong)',
  background: on ? 'rgba(99,102,241,0.3)' : 'transparent',
  color: on ? 'var(--text-muted)' : 'var(--text-faint)',
});
const PMIN = 5000000;
const PMAX = 80000000;
const STEP = 500000;

// Quick-select budget bands, in the brackets clients usually frame in.
// `max: PMAX` means "and above" (the slider's top is 8Cr+).
const BUDGET_PRESETS: { label: string; min: number; max: number }[] = [
  { label: 'Under ₹1Cr', min: PMIN, max: 10000000 },
  { label: '₹1–2Cr', min: 10000000, max: 20000000 },
  { label: '₹2–4Cr', min: 20000000, max: 40000000 },
  { label: '₹4Cr+', min: 40000000, max: PMAX },
];

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
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bMin, setBMin] = useState(PMIN);
  const [bMax, setBMax] = useState(PMAX);
  // Budget has two mutually exclusive modes: any number of preset bands
  // (matched as a union — "Under ₹1Cr" plus "₹4Cr+" means either), or a custom
  // slider range. Picking a band parks the slider; dragging the slider clears
  // the bands. Combining them would mean intersecting a union with a range,
  // which is impossible to read off the UI.
  const [bands, setBands] = useState<string[]>([]);
  const [selZones, setSelZones] = useState<string[]>([]);
  const [selLoc, setSelLoc] = useState<string[]>([]);
  const [selType, setSelType] = useState<string[]>([]);
  const [status, setStatus] = useState('all');

  useEffect(() => {
    (async () => {
      const { data: projectsData } = await supabase.from('projects').select('*').order('name');
      setProjects((projectsData as Project[]) || []);

      // Prefer name+zones, but tolerate the column not existing yet (before the
      // zones migration is run) so the page never hard-fails — areas just show
      // unzoned until then.
      let locs = await supabase.from('locations').select('name,zones').order('name');
      if (locs.error) locs = await supabase.from('locations').select('name').order('name');
      setLocations(((locs.data as { name: string; zones?: string[] | null }[]) || [])
        .map((l) => ({ name: l.name, zones: l.zones ?? [] })));

      setLoading(false);
    })();
  }, []);

  const toggleType = (b: string) => setSelType((p) => (p.includes(b) ? p.filter((x) => x !== b) : [...p, b]));
  const toggleLoc = (l: string) => setSelLoc((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));
  const toggleBand = (label: string) => setBands((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]));

  // The zone row only makes sense once locations actually carry zones (i.e.
  // after the zones migration is applied). Until then, hide it and fall back to
  // the flat area list, so a half-set-up DB never shows a zone that filters to
  // nothing. It switches on by itself the moment any area is zoned.
  const zonesAvailable = locations.some((l) => l.zones.length > 0);

  // Areas belonging to the picked zones (all areas when no zone is picked).
  // The area dropdown and popular chips are scoped to this so a salesperson who
  // said "North" only ever sees North's areas.
  const areasInScope = selZones.length
    ? locations.filter((l) => l.zones.some((z) => selZones.includes(z))).map((l) => l.name)
    : locations.map((l) => l.name);

  // Zones the map records for a given project's location (by exact name).
  const zonesOf = (loc: string) => locations.find((l) => l.name === loc)?.zones ?? [];

  const toggleZone = (z: string) => setSelZones((prev) => {
    const next = prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z];
    // Drop any already-picked area that falls outside the new zone set, so the
    // area chips can't contradict the zone chips.
    if (next.length) {
      const allowed = new Set(locations.filter((l) => l.zones.some((zz) => next.includes(zz))).map((l) => l.name));
      setSelLoc((locs) => locs.filter((l) => allowed.has(l)));
    }
    return next;
  });

  // A project matches a budget window if its price range overlaps it at all —
  // a ₹96L–₹5.8Cr project belongs in "Under ₹1Cr" and in "₹4Cr+".
  // The per-configuration price rows. Falls back to treating each listed BHK as
  // priced at the project's overall range when a project has no unit_configs, so
  // filtering still works for older/simpler entries.
  const unitsOf = (p: Project): UnitConfig[] =>
    p.unit_configs && p.unit_configs.length
      ? p.unit_configs
      : (p.bhk_types ?? []).map((t) => ({ type: t, price_min: p.price_min, price_max: p.price_max }));

  const squashType = (s: string) => s.replace(/\s+/g, '').toLowerCase();

  // Budget windows currently in force: the selected preset bands, else the
  // custom slider range, else none. Empty = no budget constraint.
  const budgetWindows: [number, number][] =
    bands.length > 0
      ? BUDGET_PRESETS.filter((b) => bands.includes(b.label)).map((b) => [b.min, b.max] as [number, number])
      : (bMin !== PMIN || bMax !== PMAX) ? [[bMin, bMax]] : [];

  // "Commonly used" locations are derived from the catalogue rather than
  // hardcoded, so a suggestion can never point at zero projects.
  const popularLocations = useMemo(() => {
    const inScope = new Set(areasInScope);
    const counts = new Map<string, number>();
    projects.forEach((p) => {
      if (!inScope.has(p.location)) return;
      counts.set(p.location, (counts.get(p.location) ?? 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, POPULAR_LOCATION_COUNT)
      .map(([name]) => name);
  }, [projects, areasInScope]);

  const clearAll = () => {
    setBMin(PMIN); setBMax(PMAX); setBands([]); setSelZones([]); setSelLoc([]); setSelType([]); setStatus('all'); setSearch('');
  };

  // Everything currently narrowing the results, each with its own undo. Without
  // this you have to scan four separate controls to work out why the list is
  // short — and a filter scrolled out of view is invisible entirely.
  const activeFilters: { key: string; label: string; remove: () => void }[] = [];
  if (bands.length > 0) {
    bands.forEach((b) => {
      activeFilters.push({ key: `band-${b}`, label: b, remove: () => toggleBand(b) });
    });
  } else if (bMin !== PMIN || bMax !== PMAX) {
    activeFilters.push({
      key: 'budget',
      label: `${fmt(bMin)} – ${fmt(bMax, bMax >= PMAX)}`,
      remove: () => { setBMin(PMIN); setBMax(PMAX); },
    });
  }
  selZones.forEach((z) => {
    activeFilters.push({ key: `zone-${z}`, label: zoneLabel(z), remove: () => toggleZone(z) });
  });
  selLoc.forEach((l) => {
    activeFilters.push({ key: `loc-${l}`, label: l, remove: () => toggleLoc(l) });
  });
  selType.forEach((t) => {
    activeFilters.push({ key: `type-${t}`, label: t, remove: () => toggleType(t) });
  });
  if (status !== 'all') {
    activeFilters.push({
      key: 'status',
      label: status === 'Ready to Move' ? 'Ready to Move' : 'Under Construction',
      remove: () => setStatus('all'),
    });
  }
  if (search.trim()) {
    activeFilters.push({ key: 'search', label: `“${search.trim()}”`, remove: () => setSearch('') });
  }

  const shown = projects.filter((p) => {
    // Budget and BHK are matched on the SAME configuration. "2BHK under ₹1Cr"
    // must find a 2BHK that is itself under ₹1Cr — not a project that merely
    // has a 2BHK somewhere and, separately, some other unit under ₹1Cr.
    if (selType.length > 0 || budgetWindows.length > 0) {
      const unitMatch = unitsOf(p).some((u) => {
        const typeOk = selType.length === 0 || selType.some((t) => squashType(t) === squashType(u.type));
        const priceOk = budgetWindows.length === 0 ||
          budgetWindows.some(([mn, mx]) => u.price_max >= mn && u.price_min <= (mx >= PMAX ? Infinity : mx));
        return typeOk && priceOk;
      });
      if (!unitMatch) return false;
    }
    // Specific areas win; otherwise a picked zone means "anywhere in that zone".
    if (selLoc.length > 0) {
      if (!selLoc.some((l) => p.location.toLowerCase().includes(l.toLowerCase()))) return false;
    } else if (selZones.length > 0 && !zonesOf(p.location).some((z) => selZones.includes(z))) {
      return false;
    }
    if (status !== 'all' && p.status !== status) return false;
    // Same matcher the search dropdown uses, so the cards behind it agree.
    if (search && !matchesQuery(p, search)) return false;
    return true;
  });

  return (
    <AppShell
      mainStyle={{ padding: 20 }}
      topBar={
        <nav style={{ background: 'var(--bg-bar)', borderBottom: '1px solid var(--border)', padding: 0, height: 56, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {/* Logo sits in its own column, its divider continuing the sidebar
              border directly below. */}
          <BrandLogo onClick={nav.onGoHome} zoneWidth={SIDEBAR_WIDTH} />
          {/* Search sits on the right, just left of the account controls. */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', minWidth: 0, justifyContent: 'flex-end' }}>
            <div style={{ flex: '0 1 440px', minWidth: 0, display: 'flex' }}>
              <GlobalSearch projects={projects} value={search} onQueryChange={setSearch} onSelectProject={onViewProject} />
            </div>
            <ThemeToggle />
            {/* Already home, so no Home entry in the menu here. */}
            <UserMenu user={user} groups={buildAccountMenu({ ...nav, isAdmin: user.role === 'admin', onGoHome: undefined })} />
          </div>
        </nav>
      }
      sidebar={
        <aside style={{ width: SIDEBAR_WIDTH, boxSizing: 'border-box', background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)', padding: 18, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: activeFilters.length ? 12 : 20 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Filters</span>
            {activeFilters.length > 0 && (
              <button onClick={clearAll} style={{ background: 'none', border: 'none', color: '#6366F1', cursor: 'pointer', fontSize: 12 }}>Clear all</button>
            )}
          </div>

          {/* Applied filters, each removable on its own. */}
          {activeFilters.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={f.remove}
                  title={`Remove ${f.label}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', padding: '4px 8px 4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid #6366F1', background: 'rgba(99,102,241,0.3)', color: 'var(--on-tint)' }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                  <span aria-hidden style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1 }}>×</span>
                </button>
              ))}
            </div>
          )}

          {/* Budget */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Budget Range</div>
            {/* The slider is parked while bands are driving the filter — it can't
                show a union of disjoint ranges, so pretending it does would lie. */}
            <div style={{ opacity: bands.length ? 0.4 : 1, transition: 'opacity 120ms' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14 }}>
                <span style={{ background: 'var(--border)', padding: '3px 10px', borderRadius: 6 }}>{fmt(bMin)}</span>
                <span style={{ color: 'var(--text-fainter)' }}>to</span>
                <span style={{ background: 'var(--border)', padding: '3px 10px', borderRadius: 6 }}>{fmt(bMax, bMax >= PMAX)}</span>
              </div>
              {/* Dragging drops back to a custom range. */}
              <DualSlider vMin={bMin} vMax={bMax} onChange={(a, b) => { setBands([]); setBMin(a); setBMax(b); }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-fainter)', marginTop: 6 }}>
                <span>₹50L</span><span>₹8Cr+</span>
              </div>
            </div>
            {/* Bands are multi-select: pick as many as you like, matched as a union. */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {BUDGET_PRESETS.map((p) => (
                <button key={p.label} onClick={() => toggleBand(p.label)} style={chipStyle(bands.includes(p.label))}>
                  {p.label}
                </button>
              ))}
            </div>
            {bands.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 7 }}>
                Matching {bands.length === 1 ? 'this band' : `any of ${bands.length} bands`} — drag the slider for a custom range.
              </div>
            )}
          </div>

          {/* Location — pick a Bangalore zone first, then narrow to its areas.
              No zone = All Bangalore, the area list spans every zone. */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Location</div>
            {zonesAvailable && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {ZONES.map((z) => (
                  <button key={z} onClick={() => toggleZone(z)} style={chipStyle(selZones.includes(z))}>
                    {z}
                  </button>
                ))}
              </div>
            )}
            <MultiSelect
              options={areasInScope}
              selected={selLoc}
              onToggle={toggleLoc}
              onClear={() => setSelLoc([])}
              placeholder={selZones.length ? `All areas in ${selZones.map(zoneLabel).join(', ')}` : 'All Locations'}
              clearLabel="Clear locations"
            />
            {popularLocations.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
                {popularLocations.map((l) => (
                  <button
                    key={l}
                    // Tapping an active chip removes just that location.
                    onClick={() => toggleLoc(l)}
                    style={{ ...chipStyle(selLoc.includes(l)), maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Property Type — same shape: everything in the dropdown, the
              common configurations as chips underneath. */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Property Type</div>
            <MultiSelect
              options={TYPES}
              selected={selType}
              onToggle={toggleType}
              onClear={() => setSelType([])}
              placeholder="All Types"
              renderLabel={(t) => (t === 'Plot' ? '🏞️ Plot' : t)}
              clearLabel="Clear property types"
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
              {POPULAR_TYPES.map((b) => (
                <button key={b} onClick={() => toggleType(b)} style={chipStyle(selType.includes(b))}>
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>Status</div>
            <div style={{ display: 'flex', background: 'rgba(79,70,229,0.1)', borderRadius: 8, padding: 3, gap: 2 }}>
              {[['all','All'],['Ready to Move','Ready'],['Under Construction','UC']].map(([v, l]) => (
                <button key={v} onClick={() => setStatus(v)} style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: 'none', fontSize: 11, cursor: 'pointer', background: status === v ? 'linear-gradient(135deg,#4F46E5,#9333EA)' : 'transparent', color: status === v ? 'white' : 'var(--text-faint)', fontWeight: status === v ? 600 : 400 }}>{l}</button>
              ))}
            </div>
          </div>
        </aside>
      }
    >
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            {loading ? 'Loading...' : `Showing ${shown.length} of ${projects.length} projects`}
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>Loading projects...</div>
          ) : shown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
              <div style={{ color: 'var(--text-faint)' }}>No projects match your filters.</div>
              <button onClick={clearAll} style={{ marginTop: 16, background: 'var(--border-strong)', border: '1px solid rgba(79,70,229,0.4)', borderRadius: 8, padding: '8px 20px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>Clear Filters</button>
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
    <div onClick={() => onView(p.id)} style={{ background: 'var(--bg-raised)', borderRadius: 14, border: `1px solid ${isPlot ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, boxShadow: 'var(--card-shadow)', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s' }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}>
      <div style={{ height: 150, background: isPlot ? 'linear-gradient(135deg,rgba(16,185,129,0.2),rgba(5,150,105,0.3))' : 'linear-gradient(135deg,var(--border-strong),rgba(147,51,234,0.3))', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 48, opacity: 0.3 }}>{isPlot ? '🏞️' : '🏢'}</span>}
        <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: p.status === 'Ready to Move' ? '#10B981' : '#F59E0B', color: '#FFFFFF' }}>{p.status === 'Ready to Move' ? 'Ready' : 'UC'}</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 11, color: isPlot ? '#10B981' : '#6366F1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{p.developer}</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{p.name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 10 }}>📍 {p.location}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>{fmt(p.price_min)} – {fmt(p.price_max)}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
          {p.bhk_types?.map((b) => <span key={b} style={{ background: b === 'Plot' ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)', color: b === 'Plot' ? '#10B981' : 'var(--text-muted)', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{b}</span>)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14 }}>📅 {p.possession_date}</div>
        <button onClick={(e) => { e.stopPropagation(); onView(p.id); }} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: isPlot ? 'linear-gradient(135deg,#059669,#10B981)' : 'linear-gradient(135deg,#4F46E5,#9333EA)', color: '#FFFFFF', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>View Details →</button>
      </div>
    </div>
  );
}
