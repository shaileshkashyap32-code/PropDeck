import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  user: any;
  onLogout: () => void;
  onViewProject: (id: string) => void;
  onGoAdmin?: () => void;
}

interface Project {
  id: string;
  name: string;
  developer: string;
  location: string;
  price_min: number;
  price_max: number;
  status: string;
  bhk_types: string[];
  possession_date: string;
}

interface FormData {
  name: string;
  developer: string;
  location: string;
  rera_number: string;
  status: string;
  possession_date: string;
  price_min: string;
  price_max: string;
  carpet_area_min: string;
  carpet_area_max: string;
  bhk_types: string[];
  usp1: string;
  usp2: string;
  usp3: string;
  usp4: string;
  usp5: string;
  pitch_script: string;
  image_url: string;
  google_maps_url: string;
  tags: string;
  lm1_name: string;
  lm1_dist: string;
  lm1_type: string;
  lm2_name: string;
  lm2_dist: string;
  lm2_type: string;
  lm3_name: string;
  lm3_dist: string;
  lm3_type: string;
  lm4_name: string;
  lm4_dist: string;
  lm4_type: string;
}

const EMPTY: FormData = {
  name: '',
  developer: '',
  location: '',
  rera_number: '',
  status: 'Under Construction',
  possession_date: '',
  price_min: '',
  price_max: '',
  carpet_area_min: '',
  carpet_area_max: '',
  bhk_types: [],
  usp1: '',
  usp2: '',
  usp3: '',
  usp4: '',
  usp5: '',
  pitch_script: '',
  image_url: '',
  google_maps_url: '',
  tags: '',
  lm1_name: '',
  lm1_dist: '',
  lm1_type: 'Metro',
  lm2_name: '',
  lm2_dist: '',
  lm2_type: 'School',
  lm3_name: '',
  lm3_dist: '',
  lm3_type: 'Hospital',
  lm4_name: '',
  lm4_dist: '',
  lm4_type: 'IT Park',
};

const LOCS = [
  'Bagalur Road',
  'Bannerghatta Rd',
  'Electronic City',
  'Hebbal',
  'Hoskote',
  'Kanakapura Road',
  'KR Puram',
  'Sarjapur',
  'Thanisandra',
  'Whitefield',
  'Yelahanka',
];
const BHKS = [
  'Studio',
  '1BHK',
  '2BHK',
  '2.5BHK',
  '3BHK',
  '4BHK',
  'Villa',
  'Plot',
];
const LM_TYPES = [
  'Metro',
  'School',
  'Hospital',
  'IT Park',
  'Mall',
  'Airport',
  'Highway',
  'Other',
];

const inp: React.CSSProperties = {
  width: '100%',
  background: 'rgba(79,70,229,0.12)',
  border: '1px solid rgba(79,70,229,0.3)',
  borderRadius: 8,
  padding: '9px 12px',
  color: 'white',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  fontSize: 12,
  color: '#94A3B8',
  marginBottom: 6,
  display: 'block',
};
const card: React.CSSProperties = {
  background: 'rgba(79,70,229,0.08)',
  border: '1px solid rgba(79,70,229,0.2)',
  borderRadius: 12,
  padding: 20,
  marginBottom: 20,
};

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`;
  return `₹${n}`;
}

export default function AdminPanel({ user, onGoHome, onLogout }: Props) {
  const [section, setSection] = useState<'projects' | 'add' | 'team'>(
    'projects'
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok');
  const [team, setTeam] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newPass, setNewPass] = useState('');

  const loadProjects = async () => {
    const { data } = await supabase.from('projects').select('*').order('name');
    setProjects((data as Project[]) || []);
  };
  const loadTeam = async () => {
    const { data } = await supabase
      .from('salespersons')
      .select('id,name,mobile_number,role')
      .order('name');
    setTeam(data || []);
  };

  useEffect(() => {
    loadProjects();
    loadTeam();
  }, []);

  const flash = (m: string, t: 'ok' | 'err' = 'ok') => {
    setMsg(m);
    setMsgType(t);
    setTimeout(() => setMsg(''), 3000);
  };

  const setF = (k: keyof FormData, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));
  const toggleBHK = (b: string) =>
    setF(
      'bhk_types',
      form.bhk_types.includes(b)
        ? form.bhk_types.filter((x) => x !== b)
        : [...form.bhk_types, b]
    );

  const startEdit = (p: any) => {
    setForm({
      name: p.name || '',
      developer: p.developer || '',
      location: p.location || '',
      rera_number: p.rera_number || '',
      status: p.status || 'Under Construction',
      possession_date: p.possession_date || '',
      price_min: String(p.price_min || ''),
      price_max: String(p.price_max || ''),
      carpet_area_min: String(p.carpet_area_min || ''),
      carpet_area_max: String(p.carpet_area_max || ''),
      bhk_types: p.bhk_types || [],
      usp1: p.usps?.[0] || '',
      usp2: p.usps?.[1] || '',
      usp3: p.usps?.[2] || '',
      usp4: p.usps?.[3] || '',
      usp5: p.usps?.[4] || '',
      pitch_script: p.pitch_script || '',
      image_url: p.image_url || '',
      google_maps_url: p.google_maps_url || '',
      tags: p.tags?.join(', ') || '',
      lm1_name: p.landmarks?.[0]?.name || '',
      lm1_dist: p.landmarks?.[0]?.distance || '',
      lm1_type: p.landmarks?.[0]?.type || 'Metro',
      lm2_name: p.landmarks?.[1]?.name || '',
      lm2_dist: p.landmarks?.[1]?.distance || '',
      lm2_type: p.landmarks?.[1]?.type || 'School',
      lm3_name: p.landmarks?.[2]?.name || '',
      lm3_dist: p.landmarks?.[2]?.distance || '',
      lm3_type: p.landmarks?.[2]?.type || 'Hospital',
      lm4_name: p.landmarks?.[3]?.name || '',
      lm4_dist: p.landmarks?.[3]?.distance || '',
      lm4_type: p.landmarks?.[3]?.type || 'IT Park',
    });
    setEditId(p.id);
    setSection('add');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project?')) return;
    await supabase.from('projects').delete().eq('id', id);
    flash('Project deleted.');
    loadProjects();
  };

  const save = async () => {
    if (!form.name || !form.developer || !form.location || !form.price_min) {
      flash('Fill required fields: Name, Developer, Location, Price.', 'err');
      return;
    }
    setSaving(true);
    const landmarks = [
      { name: form.lm1_name, distance: form.lm1_dist, type: form.lm1_type },
      { name: form.lm2_name, distance: form.lm2_dist, type: form.lm2_type },
      { name: form.lm3_name, distance: form.lm3_dist, type: form.lm3_type },
      { name: form.lm4_name, distance: form.lm4_dist, type: form.lm4_type },
    ].filter((l) => l.name);

    const payload = {
      name: form.name,
      developer: form.developer,
      location: form.location,
      rera_number: form.rera_number || null,
      status: form.status,
      possession_date: form.possession_date,
      price_min: Number(form.price_min),
      price_max: Number(form.price_max || form.price_min),
      carpet_area_min: form.carpet_area_min
        ? Number(form.carpet_area_min)
        : null,
      carpet_area_max: form.carpet_area_max
        ? Number(form.carpet_area_max)
        : null,
      bhk_types: form.bhk_types,
      usps: [form.usp1, form.usp2, form.usp3, form.usp4, form.usp5].filter(
        Boolean
      ),
      landmarks,
      pitch_script: form.pitch_script || null,
      image_url: form.image_url || null,
      google_maps_url: form.google_maps_url || null,
      tags: form.tags
        ? form.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : null,
    };

    const { error } = editId
      ? await supabase.from('projects').update(payload).eq('id', editId)
      : await supabase.from('projects').insert(payload);

    setSaving(false);
    if (error) {
      flash('Error: ' + error.message, 'err');
      return;
    }
    flash(editId ? '✅ Project updated!' : '✅ Project published!');
    setForm(EMPTY);
    setEditId(null);
    loadProjects();
    setSection('projects');
  };

  const addTeamMember = async () => {
    if (!newName || !newMobile || !newPass) {
      flash('Fill all fields.', 'err');
      return;
    }
    const { error } = await supabase.from('salespersons').insert({
      name: newName,
      mobile_number: newMobile,
      password: newPass,
      role: 'salesperson',
    });
    if (error) {
      flash('Error: ' + error.message, 'err');
      return;
    }
    flash('✅ Team member added!');
    setNewName('');
    setNewMobile('');
    setNewPass('');
    loadTeam();
  };

  const removeTeamMember = async (id: string) => {
    if (!confirm('Remove this person?')) return;
    await supabase.from('salespersons').delete().eq('id', id);
    loadTeam();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#0F0C29,#1E1B4B)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* NAV */}
      <nav
        style={{
          background: 'rgba(30,27,75,0.95)',
          borderBottom: '1px solid rgba(79,70,229,0.25)',
          padding: '0 24px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg,#4F46E5,#9333EA)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            P
          </div>
          <span
            style={{
              fontWeight: 700,
              fontSize: 17,
              background: 'linear-gradient(90deg,#818CF8,#A78BFA)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            PropDeck
          </span>
          <span
            style={{
              fontSize: 11,
              background: 'rgba(147,51,234,0.3)',
              color: '#C084FC',
              padding: '2px 8px',
              borderRadius: 10,
              marginLeft: 4,
            }}
          >
            Admin
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={onGoHome}
            style={{
              background: 'rgba(79,70,229,0.2)',
              border: '1px solid rgba(79,70,229,0.4)',
              borderRadius: 7,
              padding: '6px 16px',
              color: '#A5B4FC',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ← Home View
          </button>

          <span style={{ fontSize: 13, color: '#A5B4FC' }}>{user.name}</span>
          <button
            onClick={onLogout}
            style={{
              background: 'none',
              border: '1px solid rgba(165,180,252,0.3)',
              borderRadius: 6,
              padding: '6px 14px',
              color: '#A5B4FC',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Logout
          </button>
        </div>
      </nav>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* SIDEBAR */}
        <aside
          style={{
            width: 220,
            background: 'rgba(10,8,30,0.8)',
            borderRight: '1px solid rgba(79,70,229,0.2)',
            padding: 16,
            flexShrink: 0,
          }}
        >
          {[
            ['projects', '📋 All Projects'],
            ['add', editId ? '✏️ Edit Project' : '➕ Add Project'],
            ['team', '👥 Team'],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => {
                setSection(k as any);
                if (k !== 'add') {
                  setEditId(null);
                  setForm(EMPTY);
                }
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '11px 14px',
                marginBottom: 6,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                background:
                  section === k ? 'rgba(79,70,229,0.35)' : 'transparent',
                color: section === k ? '#A5B4FC' : '#64748B',
              }}
            >
              {l}{' '}
              {k === 'projects' && (
                <span
                  style={{
                    float: 'right',
                    background: 'rgba(79,70,229,0.4)',
                    padding: '1px 7px',
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                >
                  {projects.length}
                </span>
              )}
            </button>
          ))}
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {msg && (
            <div
              style={{
                background:
                  msgType === 'ok'
                    ? 'rgba(16,185,129,0.15)'
                    : 'rgba(239,68,68,0.15)',
                border: `1px solid ${msgType === 'ok' ? '#10B981' : '#EF4444'}`,
                borderRadius: 8,
                padding: '10px 16px',
                marginBottom: 18,
                color: msgType === 'ok' ? '#10B981' : '#FCA5A5',
                fontSize: 14,
              }}
            >
              {msg}
            </div>
          )}

          {/* ALL PROJECTS */}
          {section === 'projects' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 22,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 20 }}>All Projects</h2>
                <button
                  onClick={() => setSection('add')}
                  style={{
                    background: 'linear-gradient(135deg,#4F46E5,#9333EA)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '9px 20px',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  + Add New Project
                </button>
              </div>
              {projects.length === 0 ? (
                <div
                  style={{ textAlign: 'center', padding: 60, color: '#64748B' }}
                >
                  No projects yet. Add your first one!
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: '1px solid rgba(79,70,229,0.2)',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 14,
                    }}
                  >
                    <thead>
                      <tr style={{ background: 'rgba(79,70,229,0.2)' }}>
                        {[
                          'Project',
                          'Developer',
                          'Location',
                          'Status',
                          'Price',
                          'Actions',
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              color: '#A5B4FC',
                              fontWeight: 600,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p) => (
                        <tr
                          key={p.id}
                          style={{
                            borderTop: '1px solid rgba(79,70,229,0.12)',
                          }}
                        >
                          <td style={{ padding: '13px 16px', fontWeight: 600 }}>
                            {p.name}
                          </td>
                          <td
                            style={{ padding: '13px 16px', color: '#94A3B8' }}
                          >
                            {p.developer}
                          </td>
                          <td
                            style={{ padding: '13px 16px', color: '#94A3B8' }}
                          >
                            {p.location}
                          </td>
                          <td style={{ padding: '13px 16px' }}>
                            <span
                              style={{
                                fontSize: 12,
                                padding: '3px 10px',
                                borderRadius: 20,
                                background:
                                  p.status === 'Ready to Move'
                                    ? 'rgba(16,185,129,0.2)'
                                    : 'rgba(245,158,11,0.2)',
                                color:
                                  p.status === 'Ready to Move'
                                    ? '#10B981'
                                    : '#F59E0B',
                              }}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td
                            style={{ padding: '13px 16px', color: '#A5B4FC' }}
                          >
                            {fmt(p.price_min)} – {fmt(p.price_max)}
                          </td>
                          <td style={{ padding: '13px 16px' }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => startEdit(p)}
                                style={{
                                  background: 'rgba(79,70,229,0.3)',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '5px 14px',
                                  color: '#A5B4FC',
                                  cursor: 'pointer',
                                  fontSize: 13,
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                style={{
                                  background: 'rgba(239,68,68,0.15)',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '5px 14px',
                                  color: '#F87171',
                                  cursor: 'pointer',
                                  fontSize: 13,
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ADD / EDIT */}
          {section === 'add' && (
            <div style={{ maxWidth: 720 }}>
              <h2 style={{ fontSize: 20, marginBottom: 24 }}>
                {editId ? '✏️ Edit Project' : '➕ Add New Project'}
              </h2>

              {/* Basic Info */}
              <div style={card}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#A5B4FC',
                    marginBottom: 16,
                  }}
                >
                  ① Basic Information
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 14,
                  }}
                >
                  <div>
                    <label style={lbl}>Project Name *</label>
                    <input
                      style={inp}
                      value={form.name}
                      onChange={(e) => setF('name', e.target.value)}
                      placeholder="e.g. Sobha City"
                    />
                  </div>
                  <div>
                    <label style={lbl}>Developer *</label>
                    <input
                      style={inp}
                      value={form.developer}
                      onChange={(e) => setF('developer', e.target.value)}
                      placeholder="e.g. Sobha Developers"
                    />
                  </div>
                  <div>
                    <label style={lbl}>Location *</label>
                    <select
                      style={inp}
                      value={form.location}
                      onChange={(e) => setF('location', e.target.value)}
                    >
                      <option value="" style={{ background: '#1E1B4B' }}>
                        Select location
                      </option>
                      {LOCS.map((l) => (
                        <option
                          key={l}
                          value={l}
                          style={{ background: '#1E1B4B' }}
                        >
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>RERA Number</label>
                    <input
                      style={inp}
                      value={form.rera_number}
                      onChange={(e) => setF('rera_number', e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label style={lbl}>Status *</label>
                    <select
                      style={inp}
                      value={form.status}
                      onChange={(e) => setF('status', e.target.value)}
                    >
                      <option style={{ background: '#1E1B4B' }}>
                        Under Construction
                      </option>
                      <option style={{ background: '#1E1B4B' }}>
                        Ready to Move
                      </option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Possession Date *</label>
                    <input
                      style={inp}
                      value={form.possession_date}
                      onChange={(e) => setF('possession_date', e.target.value)}
                      placeholder="e.g. Dec 2026"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div style={card}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#A5B4FC',
                    marginBottom: 16,
                  }}
                >
                  ② Pricing & Configuration
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 14,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label style={lbl}>Min Price (₹) *</label>
                    <input
                      style={inp}
                      type="number"
                      value={form.price_min}
                      onChange={(e) => setF('price_min', e.target.value)}
                      placeholder="e.g. 4900000"
                    />
                  </div>
                  <div>
                    <label style={lbl}>Max Price (₹) *</label>
                    <input
                      style={inp}
                      type="number"
                      value={form.price_max}
                      onChange={(e) => setF('price_max', e.target.value)}
                      placeholder="e.g. 8800000"
                    />
                  </div>
                  <div>
                    <label style={lbl}>Carpet Area Min (sqft)</label>
                    <input
                      style={inp}
                      type="number"
                      value={form.carpet_area_min}
                      onChange={(e) => setF('carpet_area_min', e.target.value)}
                      placeholder="e.g. 650"
                    />
                  </div>
                  <div>
                    <label style={lbl}>Carpet Area Max (sqft)</label>
                    <input
                      style={inp}
                      type="number"
                      value={form.carpet_area_max}
                      onChange={(e) => setF('carpet_area_max', e.target.value)}
                      placeholder="e.g. 1200"
                    />
                  </div>
                </div>
                <label style={lbl}>BHK / Property Type *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {BHKS.map((b) => {
                    const on = form.bhk_types.includes(b);
                    return (
                      <button
                        key={b}
                        onClick={() => toggleBHK(b)}
                        style={{
                          padding: '5px 14px',
                          borderRadius: 20,
                          fontSize: 13,
                          cursor: 'pointer',
                          border: '1px solid',
                          borderColor: on ? '#6366F1' : 'rgba(79,70,229,0.3)',
                          background: on
                            ? 'rgba(99,102,241,0.3)'
                            : 'transparent',
                          color: on ? '#A5B4FC' : '#64748B',
                        }}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* USPs */}
              <div style={card}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#A5B4FC',
                    marginBottom: 16,
                  }}
                >
                  ③ Key Highlights (USPs)
                </div>
                {(['usp1', 'usp2', 'usp3', 'usp4', 'usp5'] as const).map(
                  (k, i) => (
                    <div key={k} style={{ marginBottom: 10 }}>
                      <label style={lbl}>
                        Highlight {i + 1}
                        {i === 0 ? ' *' : ''}
                      </label>
                      <input
                        style={inp}
                        value={form[k]}
                        onChange={(e) => setF(k, e.target.value)}
                        placeholder={
                          [
                            'Metro connectivity nearby',
                            'Club house with swimming pool',
                            'RERA approved project',
                            '24/7 security & CCTV',
                            'Green zone with 40% open space',
                          ][i]
                        }
                      />
                    </div>
                  )
                )}
              </div>

              {/* Landmarks */}
              <div style={card}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#A5B4FC',
                    marginBottom: 16,
                  }}
                >
                  ④ Nearby Landmarks
                </div>
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 0.6fr 0.8fr',
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <label style={lbl}>Landmark {n} Name</label>
                      <input
                        style={inp}
                        value={(form as any)[`lm${n}_name`]}
                        onChange={(e) =>
                          setF(`lm${n}_name` as any, e.target.value)
                        }
                        placeholder="e.g. Kempegowda Airport"
                      />
                    </div>
                    <div>
                      <label style={lbl}>Distance</label>
                      <input
                        style={inp}
                        value={(form as any)[`lm${n}_dist`]}
                        onChange={(e) =>
                          setF(`lm${n}_dist` as any, e.target.value)
                        }
                        placeholder="e.g. 8 km"
                      />
                    </div>
                    <div>
                      <label style={lbl}>Type</label>
                      <select
                        style={inp}
                        value={(form as any)[`lm${n}_type`]}
                        onChange={(e) =>
                          setF(`lm${n}_type` as any, e.target.value)
                        }
                      >
                        {LM_TYPES.map((t) => (
                          <option key={t} style={{ background: '#1E1B4B' }}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Image & Map */}
              <div style={card}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#A5B4FC',
                    marginBottom: 16,
                  }}
                >
                  ⑤ Image & Map
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Image URL (cover photo)</label>
                  <input
                    style={inp}
                    value={form.image_url}
                    onChange={(e) => setF('image_url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label style={lbl}>Google Maps Embed URL</label>
                  <input
                    style={inp}
                    value={form.google_maps_url}
                    onChange={(e) => setF('google_maps_url', e.target.value)}
                    placeholder="https://maps.google.com/..."
                  />
                </div>
              </div>

              {/* Pitch Script */}
              <div style={card}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#A5B4FC',
                    marginBottom: 10,
                  }}
                >
                  ⑥ Pitch Script
                </div>
                <textarea
                  style={{
                    ...inp,
                    height: 120,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: 1.7,
                  }}
                  value={form.pitch_script}
                  onChange={(e) => setF('pitch_script', e.target.value)}
                  placeholder="Write 3-5 lines a salesperson can say on a live call. E.g.: This is a Godrej project in North Bangalore, starting at just ₹49L. It's ideal for airline professionals due to its proximity to the airport. Metro Phase 2 connectivity is planned nearby. RERA approved and possession by Mid 2026."
                />
                <div style={{ fontSize: 11, color: '#475569', marginTop: 5 }}>
                  {form.pitch_script.length} characters
                </div>
              </div>

              {/* Tags */}
              <div style={{ marginBottom: 24 }}>
                <label style={lbl}>Tags (comma separated)</label>
                <input
                  style={inp}
                  value={form.tags}
                  onChange={(e) => setF('tags', e.target.value)}
                  placeholder="e.g. Premium, Airport Zone, Metro Nearby"
                />
              </div>

              {/* Buttons */}
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  paddingBottom: 40,
                }}
              >
                <button
                  onClick={save}
                  disabled={saving}
                  style={{
                    background: 'linear-gradient(135deg,#4F46E5,#9333EA)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 32px',
                    color: 'white',
                    fontWeight: 700,
                    cursor: saving ? 'default' : 'pointer',
                    fontSize: 15,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving
                    ? 'Saving...'
                    : editId
                    ? '✅ Update Project'
                    : '🚀 Publish Project'}
                </button>
                <button
                  onClick={() => {
                    setForm(EMPTY);
                    setEditId(null);
                    setSection('projects');
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(165,180,252,0.3)',
                    borderRadius: 8,
                    padding: '12px 24px',
                    color: '#A5B4FC',
                    cursor: 'pointer',
                    fontSize: 15,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* TEAM */}
          {section === 'team' && (
            <div style={{ maxWidth: 680 }}>
              <h2 style={{ fontSize: 20, marginBottom: 22 }}>
                👥 Team Accounts
              </h2>
              <div style={card}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#A5B4FC',
                    marginBottom: 16,
                  }}
                >
                  Add New Salesperson
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <label style={lbl}>Name</label>
                    <input
                      style={inp}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Rahul S."
                    />
                  </div>
                  <div>
                    <label style={lbl}>Mobile Number</label>
                    <input
                      style={inp}
                      value={newMobile}
                      onChange={(e) => setNewMobile(e.target.value)}
                      placeholder="9902700565"
                    />
                  </div>
                  <div>
                    <label style={lbl}>Password</label>
                    <input
                      style={inp}
                      type="password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="Set password"
                    />
                  </div>
                </div>
                <button
                  onClick={addTeamMember}
                  style={{
                    background: 'linear-gradient(135deg,#4F46E5,#9333EA)',
                    border: 'none',
                    borderRadius: 7,
                    padding: '10px 22px',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  + Add Salesperson
                </button>
              </div>

              <div
                style={{
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: '1px solid rgba(79,70,229,0.2)',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 14,
                  }}
                >
                  <thead>
                    <tr style={{ background: 'rgba(79,70,229,0.2)' }}>
                      {['Name', 'Mobile', 'Role', 'Action'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            color: '#A5B4FC',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((m) => (
                      <tr
                        key={m.id}
                        style={{ borderTop: '1px solid rgba(79,70,229,0.12)' }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                          {m.name}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#94A3B8' }}>
                          {m.mobile_number}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              background:
                                m.role === 'admin'
                                  ? 'rgba(147,51,234,0.25)'
                                  : 'rgba(79,70,229,0.2)',
                              color: m.role === 'admin' ? '#C084FC' : '#A5B4FC',
                              fontSize: 12,
                              padding: '2px 9px',
                              borderRadius: 10,
                            }}
                          >
                            {m.role}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {m.role !== 'admin' && (
                            <button
                              onClick={() => removeTeamMember(m.id)}
                              style={{
                                background: 'rgba(239,68,68,0.15)',
                                border: 'none',
                                borderRadius: 5,
                                padding: '4px 12px',
                                color: '#F87171',
                                cursor: 'pointer',
                                fontSize: 13,
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
