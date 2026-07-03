import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  user: any
  onGoHome: () => void
  onLogout: () => void
}

interface Project {
  id: string; name: string; developer: string; location: string
  price_min: number; price_max: number; status: string
  bhk_types: string[]; possession_date: string
}

interface LocItem {
  id: number
  name: string
}

interface UnitConfig {
  type: string
  price_min: string
  price_max: string
  sba_min: string
  sba_max: string
}

interface FormData {
  name: string; developer: string; location: string
  rera_number: string; status: string; possession_date: string
  usp1: string; usp2: string; usp3: string; usp4: string; usp5: string
  pitch_script: string; image_url: string; google_maps_url: string; tags: string
  lm1_name: string; lm1_dist: string; lm1_type: string
  lm2_name: string; lm2_dist: string; lm2_type: string
  lm3_name: string; lm3_dist: string; lm3_type: string
  lm4_name: string; lm4_dist: string; lm4_type: string
}

const EMPTY: FormData = {
  name: '', developer: '', location: '', rera_number: '',
  status: 'Under Construction', possession_date: '',
  usp1: '', usp2: '', usp3: '', usp4: '', usp5: '',
  pitch_script: '', image_url: '', google_maps_url: '', tags: '',
  lm1_name: '', lm1_dist: '', lm1_type: 'Metro',
  lm2_name: '', lm2_dist: '', lm2_type: 'School',
  lm3_name: '', lm3_dist: '', lm3_type: 'Hospital',
  lm4_name: '', lm4_dist: '', lm4_type: 'IT Park',
}

const EMPTY_UNIT: UnitConfig = { type: '', price_min: '', price_max: '', sba_min: '', sba_max: '' }
const UNIT_TYPES = ['Studio','1BHK','2BHK','2.5BHK','3BHK','3.5BHK','4BHK','Penthouse','Villa','Townhouse','Plot']
const LM_TYPES = ['Metro','School','Hospital','IT Park','Mall','Airport','Highway','Other']

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.3)',
  borderRadius: 8, padding: '9px 12px', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box'
}
const lbl: React.CSSProperties = { fontSize: 12, color: '#94A3B8', marginBottom: 6, display: 'block' }
const card: React.CSSProperties = {
  background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)',
  borderRadius: 12, padding: 20, marginBottom: 20
}

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`
  return `₹${n}`
}

export default function AdminPanel({ user, onGoHome, onLogout }: Props) {
  const [section, setSection] = useState<'projects' | 'add' | 'locations' | 'team'>('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [form, setForm] = useState<FormData>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok')
  const [team, setTeam] = useState<any[]>([])
  const [newName, setNewName] = useState('')
  const [newMobile, setNewMobile] = useState('')
  const [newPass, setNewPass] = useState('')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [locations, setLocations] = useState<LocItem[]>([])
  const [locationCounts, setLocationCounts] = useState<Record<string, number>>({})
  const [newLocation, setNewLocation] = useState('')
  const [addLocWarning, setAddLocWarning] = useState('')
  const [addLocIsDuplicate, setAddLocIsDuplicate] = useState(false)
  const [addLocForce, setAddLocForce] = useState(false)
  const [formLocWarning, setFormLocWarning] = useState('')
  const [unitConfigs, setUnitConfigs] = useState<UnitConfig[]>([{ ...EMPTY_UNIT }])
  const [quickFillText, setQuickFillText] = useState('')
  const [generatingFill, setGeneratingFill] = useState(false)
  const [generatingScript, setGeneratingScript] = useState(false)
  const [generatingPersonas, setGeneratingPersonas] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const loadProjects = async () => {
    const { data } = await supabase.from('projects').select('*').order('name')
    const rows = (data as Project[]) || []
    setProjects(rows)
    const counts: Record<string, number> = {}
    rows.forEach(p => { counts[p.location] = (counts[p.location] || 0) + 1 })
    setLocationCounts(counts)
  }

  const loadLocations = async () => {
    const { data } = await supabase.from('locations').select('*').order('name')
    setLocations((data as LocItem[]) || [])
  }

  const loadTeam = async () => {
    const { data } = await supabase.from('salespersons').select('id,name,mobile_number,role').order('name')
    setTeam(data || [])
  }

  useEffect(() => { loadProjects(); loadTeam(); loadLocations() }, [])

  const flash = (m: string, t: 'ok' | 'err' = 'ok') => {
    setMsg(m); setMsgType(t); setTimeout(() => setMsg(''), 5000)
  }

  const setF = (k: keyof FormData, v: any) => setForm(f => ({ ...f, [k]: v }))

  // ─── Gemini helper ────────────────────────────────────────────────────────
  const callGemini = async (prompt: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    )
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  }

  const safeJSON = (raw: string) => {
    const strip = (s: string) => s.replace(/```json|```/g, '').trim()
    try { return JSON.parse(strip(raw)) } catch {}
    // Brace-tracking: handles when grounding annotations appear after JSON
    const start = raw.indexOf('{')
    if (start !== -1) {
      let depth = 0
      for (let i = start; i < raw.length; i++) {
        if (raw[i] === '{') depth++
        else if (raw[i] === '}') {
          depth--
          if (depth === 0) {
            try { return JSON.parse(raw.substring(start, i + 1)) } catch {}
            break
          }
        }
      }
    }
    return null
  }

  // ─── Quick Fill with AI ───────────────────────────────────────────────────
  const extractWithAI = async () => {
    if (!quickFillText.trim()) { flash('Paste some project info first.', 'err'); return }
    setGeneratingFill(true)
    const prompt = `You are a real estate data extraction expert for Bangalore, India.

Extract project details from the text below and return ONLY a valid JSON object (no markdown, no explanation).

Required JSON structure:
{
  "name": "full project name",
  "developer": "developer/builder name",
  "location": "micro-market area only (e.g. Sadahalli, Whitefield, Sarjapur Road — NOT full address)",
  "rera_number": "RERA number if present else empty string",
  "status": "Under Construction or Ready to Move",
  "possession_date": "possession timeline if mentioned else empty string",
  "unit_configs": [
    {
      "type": "one of: Studio, 1BHK, 2BHK, 2.5BHK, 3BHK, 3.5BHK, 4BHK, Penthouse, Villa, Townhouse, Plot",
      "price_min": "lowest price for this type as number in rupees (1Cr=10000000, 1L=100000). Empty string if unknown.",
      "price_max": "highest price for this type as number in rupees. Empty string if unknown.",
      "sba_min": "minimum super built-up/saleable area in sqft as number. Empty string if unknown.",
      "sba_max": "maximum super built-up/saleable area in sqft as number. Empty string if unknown."
    }
  ],
  "usps": [
    "USP 1 — think investor angle (appreciation, rental yield, infrastructure)",
    "USP 2 — think family/end-user angle (school, hospital, amenities)",
    "USP 3 — project scale or unique feature",
    "USP 4 — developer credibility or RERA status",
    "USP 5 — connectivity or location advantage"
  ],
  "landmarks": [
    {"name": "landmark name", "distance": "X km", "type": "Airport or Metro or School or Hospital or IT Park or Mall or Highway or Other"}
  ],
  "tags": ["tag1", "tag2", "tag3"]
}

Rules:
- Create one unit_config entry per distinct unit type mentioned
- For USPs: prioritise facts that a salesperson can say on a live call to different buyer types
- Include up to 4 landmarks with realistic distances
- Tags: 3-5 short keywords (e.g. Township, Airport Zone, Premium, NRI Friendly, Investment)
- Return ONLY the JSON object

Text:
${quickFillText}`

    try {
      const raw = await callGemini(prompt)
      const ex = safeJSON(raw)
      if (!ex) { flash('AI returned unexpected format. Try again.', 'err'); setGeneratingFill(false); return }

      if (ex.name) setF('name', ex.name)
      if (ex.developer) setF('developer', ex.developer)
      if (ex.location) { setF('location', ex.location); setFormLocWarning('') }
      if (ex.rera_number) setF('rera_number', ex.rera_number)
      if (ex.status === 'Under Construction' || ex.status === 'Ready to Move') setF('status', ex.status)
      if (ex.possession_date) setF('possession_date', ex.possession_date)
      if (Array.isArray(ex.usps)) {
        const keys: (keyof FormData)[] = ['usp1','usp2','usp3','usp4','usp5']
        keys.forEach((k, i) => { if (ex.usps[i]) setF(k, ex.usps[i]) })
      }
      if (Array.isArray(ex.landmarks)) {
        ex.landmarks.slice(0, 4).forEach((lm: any, i: number) => {
          setF(`lm${i+1}_name` as keyof FormData, lm.name || '')
          setF(`lm${i+1}_dist` as keyof FormData, lm.distance || '')
          setF(`lm${i+1}_type` as keyof FormData, lm.type || 'Other')
        })
      }
      if (Array.isArray(ex.tags)) setF('tags', ex.tags.join(', '))
      if (Array.isArray(ex.unit_configs) && ex.unit_configs.length > 0) {
        setUnitConfigs(ex.unit_configs.map((u: any) => ({
          type: u.type || '',
          price_min: String(u.price_min || ''),
          price_max: String(u.price_max || ''),
          sba_min: String(u.sba_min || ''),
          sba_max: String(u.sba_max || ''),
        })))
      }
      flash('✅ Fields filled! Review everything below, then click Publish.')
    } catch {
      flash('Extraction failed. Check pasted text and try again.', 'err')
    }
    setGeneratingFill(false)
  }

  // ─── Persona pitch generation (Google Search grounded) ─────────────────────
  const generatePersonaPitches = async (
    p: any, configs: UnitConfig[]
  ): Promise<Record<string, any>> => {
    const unitLines = configs
      .filter(u => u.type)
      .map(u => {
        const pMin = u.price_min ? fmt(Number(u.price_min)) : '?'
        const pMax = u.price_max ? `–${fmt(Number(u.price_max))}` : ''
        const sba = u.sba_min ? `, SBA ${u.sba_min}${u.sba_max && u.sba_max !== u.sba_min ? `–${u.sba_max}` : ''} sqft` : ''
        return `  ${u.type}: ${pMin}${pMax}${sba}`
      })
      .join('\n')
    const lmText = [1,2,3,4]
      .map(n => p.landmarks?.[n-1]?.name
        ? `${p.landmarks[n-1].name} (${p.landmarks[n-1].distance}, ${p.landmarks[n-1].type})`
        : null)
      .filter(Boolean).join(', ')
    const validConfigs = configs.filter(u => u.price_min)

    // Cheapest config = "entry" unit type — used for EMI / entry price / NRI conversion,
    // so every unit-specific figure can name the exact configuration it's based on.
    const entryConfig = validConfigs.length > 0
      ? validConfigs.reduce((min, u) => Number(u.price_min) < Number(min.price_min) ? u : min, validConfigs[0])
      : null
    const entryPrice = entryConfig ? fmt(Number(entryConfig.price_min)) : 'entry price'
    const entryType = entryConfig ? entryConfig.type : 'entry unit'

    // A second, distinct unit type (if one exists) for the investor tab's second yield point
    const secondConfig = validConfigs.find(u => u.type !== entryType)
    const secondType = secondConfig ? secondConfig.type : entryType

    // Family-oriented config for the Upgrade tab — prefers larger, family-friendly types
    const FAMILY_TYPE_PRIORITY = ['3BHK','2.5BHK','2BHK','3.5BHK','4BHK','Townhouse','Villa','Penthouse','Studio','1BHK','Plot']
    const familyConfig = FAMILY_TYPE_PRIORITY.map(t => validConfigs.find(u => u.type === t)).find(Boolean) || validConfigs[0]
    const familyType = familyConfig ? familyConfig.type : 'family unit'

    const unitTypesList = validConfigs.map(u => u.type).join(', ') || 'Mixed configurations'

    const prompt = `You are a real estate sales intelligence system for Bangalore, India.

STEP 1 - Search the web now for current data about:
- Property appreciation % in ${p.location} area over last 2-3 years
- Upcoming infrastructure near ${p.location}: metro, highway, IT parks, airport expansion
- Competing / comparable projects in ${p.location} or nearby with current prices
- ${p.developer} delivery history and reputation for past projects
- Average monthly rental rates for apartments near ${p.location}
- Any recent news or developments affecting property value in this corridor

STEP 2 - Using that research + the project data below, generate a sales cheat sheet.

Project: ${p.name} by ${p.developer} in ${p.location}
Units:
${unitLines || '  Mixed configurations'}
Status: ${p.status} | Possession: ${p.possession_date || 'TBD'}
Highlights: ${p.usps?.join(', ')}
Landmarks: ${lmText}
RERA: ${p.rera_number || 'Approved'}

These are NOT scripts and NOT full paragraphs. They are a glanceable cheat sheet — a salesperson reads each line in 2-3 seconds mid-call while the client is talking, so treat every point like a highlight card, never a bare fragment and never a wall of text.

STRICT FORMAT RULES — follow exactly:
1. Each point: roughly 14-20 words — about one to one-and-a-half lines on screen. Enough room for ONE fact plus the context needed to actually use it on a call. Never a 4-word fragment, never a multi-sentence paragraph.
2. This project's ACTUAL unit types are: ${unitTypesList}. Whenever a point cites a price, EMI, rent, yield, SBA, or price/sqft figure that belongs to ONE specific unit type (not the whole project), name that exact unit type inline in the sentence — e.g. "3BHK EMI at 90%..." or "Studio rental yield is...". NEVER reference a BHK/unit type that isn't in this list, and NEVER leave a unit-specific number floating without saying which configuration it's for.
3. Wrap the single most important number, %, year, or ₹ figure in double asterisks — e.g. **62%**, **₹22,200/mo**, **2026-27**. Exactly ONE bolded figure per point. Do not bold anything else.
4. Cut pure filler ("approximately", "estimated around", "translating to a yield of") — but DO keep the words needed to name the unit type, so the point is self-contained and unambiguous on its own.
5. Pull real, specific data from your search — actual numbers, %, and years, never vague statements like "prices are rising."
6. If a fact genuinely has no number, lead with a short bolded keyword instead — e.g. **Metro 2026**, **RERA Approved**.

Return ONLY valid JSON, no markdown fences, no citation numbers inside text. Follow this exact structure and style (bracketed parts show what to research and insert — write real short data, not the brackets themselves):
{
  "investor": [
    "Appreciation: **[X%]** in ${p.location} over the last 3 years",
    "${entryType} rental yield: **[X%]** annual, around ₹[rent]/mo rent",
    "${secondType !== entryType ? secondType + ' rental yield: **[X%]** annual, around ₹[rent]/mo rent' : 'Price/sqft trend: **₹[X]/sqft**, up [Y]% year-on-year'}",
    "Infra boost: **[project/station name]** completes around [year]",
    "Rival project: **[name]** priced from **[₹X]** for a comparable config",
    "${entryType} entry price **${entryPrice}** — before infra-driven appreciation",
    "${p.developer} delivery record: **[X]** projects completed on time",
    "Resale driver: **[short reason, e.g. IT corridor demand]**"
  ],
  "first_time_buyer": [
    "${entryType} EMI at 90% loan, 20yr: **₹[X]/mo** approx",
    "${entryType}-sized rent nearby for comparison: **₹[X]/mo**",
    "RERA No: **${p.rera_number || 'Approved'}** — protects your booking amount",
    "${p.developer} track record: **[X]%** of past projects delivered on time",
    "${entryType} price here vs comparable projects nearby: **[X]%** cheaper or costlier",
    "Home loan access: financed by **[bank names]**",
    "Tax saving under 80C+24b: up to **₹[X]/yr**",
    "5-7yr value outlook here: **[short keyword reason]**"
  ],
  "upgrade_buyer": [
    "${familyType} SBA here: **[X] sqft** vs a typical ${familyType} elsewhere at [Y] sqft",
    "${familyType} price per sqft: **₹[X]** vs area average of ₹[Y]",
    "Standout amenity vs standalone buildings: **[specific feature]**",
    "Nearest school for families: **[name]**, [distance] away",
    "Best fit for a family of 3-4: **${familyType}**, from [price]",
    "Bridge loan cost while transitioning: **~₹[X]/mo**",
    "${p.developer} build quality vs standalone builder floors: **[keyword spec]**",
    "Township lifestyle edge: **[keyword, e.g. 24x7 gated security]**"
  ],
  "nri": [
    "${entryType} entry price in USD: **~$[X]** at today's exchange rate",
    "${entryType} rental yield: **[X%]** annual for remote owners",
    "${entryType} estimated monthly rent: **₹[X]/mo**",
    "RERA protection for remote buyers: **[short reason]**",
    "NRI home loan LTV: **[X%]** available via [bank]",
    "Remote property management fee: **~₹[X]/mo**",
    "FEMA repatriation limit for sale proceeds: **$1M/yr**",
    "5yr ROI here vs NRI FD returns: **[X%] vs [Y%]**"
  ]
}`

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }]
          })
        }
      )
      const d = await res.json()
      const raw = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
      const parsed = safeJSON(raw)
      return parsed || { investor: [], first_time_buyer: [], upgrade_buyer: [], nri: [] }
    } catch {
      return { investor: [], first_time_buyer: [], upgrade_buyer: [], nri: [] }
    }
  }

  // ─── Image upload ────────────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { flash('Image too large. Max 5MB.', 'err'); return }
    setUploadingImage(true)
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const { data, error } = await supabase.storage
      .from('project-images')
      .upload(fileName, file, { contentType: file.type })
    if (error) { flash('Upload failed: ' + error.message, 'err'); setUploadingImage(false); return }
    const { data: urlData } = supabase.storage.from('project-images').getPublicUrl(data.path)
    setF('image_url', urlData.publicUrl)
    flash('✅ Image uploaded successfully!')
    setUploadingImage(false)
  }

  // ─── Pitch script generation (section ⑥) ─────────────────────────────────
  const generatePitchScript = async () => {
    if (!form.name || !form.developer || !form.location) {
      flash('Fill in Name, Developer, and Location first.', 'err'); return
    }
    setGeneratingScript(true)
    const usps = [form.usp1, form.usp2, form.usp3, form.usp4, form.usp5].filter(Boolean)
    const unitSummary = unitConfigs.filter(u => u.type && u.price_min)
      .map(u => `${u.type} from ${fmt(Number(u.price_min))}`).join(', ')
    const prompt = `Expert real estate sales trainer in Bangalore. Write a confident, conversational 4-5 line pitch script (under 80 words) for a salesperson on a live call. First person. Specific numbers. Soft CTA at end.

Project: ${form.name} | Developer: ${form.developer} | Location: ${form.location}
${unitSummary ? `Units: ${unitSummary}` : ''}
Status: ${form.status} | Possession: ${form.possession_date || 'TBD'}
Highlights: ${usps.join(', ')}

Write ONLY the pitch script. No labels or preamble.`

    try {
      const script = await callGemini(prompt)
      if (script) { setF('pitch_script', script); flash('✅ Pitch script generated!') }
      else flash('No output. Try again.', 'err')
    } catch { flash('API error.', 'err') }
    setGeneratingScript(false)
  }

  // ─── Location helpers ─────────────────────────────────────────────────────
  const findSimilar = (typed: string, locs: LocItem[]) => {
    const t = typed.toLowerCase().trim()
    return locs.find(l => { const e = l.name.toLowerCase(); return e !== t && (e.includes(t) || t.includes(e)) })
  }

  const handleLocationInput = (val: string) => {
    setF('location', val); setFormLocWarning('')
    if (!val.trim()) return
    const exact = locations.find(l => l.name.toLowerCase() === val.toLowerCase().trim())
    if (exact) return
    const similar = findSimilar(val, locations)
    if (similar) setFormLocWarning(`Similar to "${similar.name}" — did you mean that?`)
  }

  const useExistingLocation = () => {
    const similar = findSimilar(form.location, locations)
    if (similar) { setF('location', similar.name); setFormLocWarning('') }
  }

  const handleNewLocationInput = (val: string) => {
    setNewLocation(val); setAddLocWarning(''); setAddLocIsDuplicate(false); setAddLocForce(false)
    if (!val.trim()) return
    const t = val.toLowerCase().trim()
    const exact = locations.find(l => l.name.toLowerCase() === t)
    if (exact) { setAddLocWarning(`"${exact.name}" already exists.`); setAddLocIsDuplicate(true); return }
    const similar = findSimilar(val, locations)
    if (similar) setAddLocWarning(`Similar to "${similar.name}" — is this intentionally a new location?`)
  }

  const addLocation = async () => {
    const name = newLocation.trim()
    if (!name || addLocIsDuplicate) return
    const { error } = await supabase.from('locations').insert({ name })
    if (error) { flash('Error: ' + error.message, 'err'); return }
    flash(`✅ "${name}" added!`)
    setNewLocation(''); setAddLocWarning(''); setAddLocForce(false); setAddLocIsDuplicate(false)
    loadLocations()
  }

  const deleteLocation = async (id: number, name: string) => {
    const count = locationCounts[name] || 0
    if (count > 0) { flash(`Cannot delete "${name}" — ${count} project${count > 1 ? 's' : ''} use this location.`, 'err'); return }
    if (!confirm(`Delete "${name}"?`)) return
    await supabase.from('locations').delete().eq('id', id)
    flash(`"${name}" removed.`); loadLocations()
  }

  // ─── Edit project ─────────────────────────────────────────────────────────
  const startEdit = (p: any) => {
    setForm({
      name: p.name || '', developer: p.developer || '', location: p.location || '',
      rera_number: p.rera_number || '', status: p.status || 'Under Construction',
      possession_date: p.possession_date || '',
      usp1: p.usps?.[0] || '', usp2: p.usps?.[1] || '', usp3: p.usps?.[2] || '',
      usp4: p.usps?.[3] || '', usp5: p.usps?.[4] || '',
      pitch_script: p.pitch_script || '', image_url: p.image_url || '',
      google_maps_url: p.google_maps_url || '', tags: p.tags?.join(', ') || '',
      lm1_name: p.landmarks?.[0]?.name || '', lm1_dist: p.landmarks?.[0]?.distance || '', lm1_type: p.landmarks?.[0]?.type || 'Metro',
      lm2_name: p.landmarks?.[1]?.name || '', lm2_dist: p.landmarks?.[1]?.distance || '', lm2_type: p.landmarks?.[1]?.type || 'School',
      lm3_name: p.landmarks?.[2]?.name || '', lm3_dist: p.landmarks?.[2]?.distance || '', lm3_type: p.landmarks?.[2]?.type || 'Hospital',
      lm4_name: p.landmarks?.[3]?.name || '', lm4_dist: p.landmarks?.[3]?.distance || '', lm4_type: p.landmarks?.[3]?.type || 'IT Park',
    })
    if (Array.isArray(p.unit_configs) && p.unit_configs.length > 0) {
      setUnitConfigs(p.unit_configs.map((u: any) => ({
        type: u.type || '', price_min: String(u.price_min || ''),
        price_max: String(u.price_max || ''), sba_min: String(u.sba_min || ''), sba_max: String(u.sba_max || ''),
      })))
    } else if (Array.isArray(p.bhk_types) && p.bhk_types.length > 0) {
      setUnitConfigs(p.bhk_types.map((type: string) => ({
        type, price_min: String(p.price_min || ''), price_max: String(p.price_max || ''),
        sba_min: '', sba_max: '',
      })))
    } else {
      setUnitConfigs([{ ...EMPTY_UNIT }])
    }
    setFormLocWarning(''); setQuickFillText(''); setEditId(p.id); setSection('add')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project?')) return
    await supabase.from('projects').delete().eq('id', id)
    flash('Project deleted.'); loadProjects()
  }

  // ─── Save project ─────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.name || !form.developer || !form.location) {
      flash('Fill required: Name, Developer, Location.', 'err'); return
    }
    const validConfigs = unitConfigs.filter(u => u.type && u.price_min)
    if (validConfigs.length === 0) {
      flash('Add at least one unit type with a price.', 'err'); return
    }
    setSaving(true)

    const unitConfigsData = validConfigs.map(u => ({
      type: u.type,
      price_min: Number(u.price_min),
      price_max: Number(u.price_max || u.price_min),
      sba_min: u.sba_min ? Number(u.sba_min) : null,
      sba_max: u.sba_max ? Number(u.sba_max) : null,
    }))

    const allPrices = unitConfigsData.flatMap(u => [u.price_min, u.price_max])
    const derivedBhkTypes = [...new Set(unitConfigsData.map(u => u.type))]

    const landmarks = [
      { name: form.lm1_name, distance: form.lm1_dist, type: form.lm1_type },
      { name: form.lm2_name, distance: form.lm2_dist, type: form.lm2_type },
      { name: form.lm3_name, distance: form.lm3_dist, type: form.lm3_type },
      { name: form.lm4_name, distance: form.lm4_dist, type: form.lm4_type },
    ].filter(l => l.name)

    const uspsList = [form.usp1, form.usp2, form.usp3, form.usp4, form.usp5].filter(Boolean)

    const payload: any = {
      name: form.name, developer: form.developer, location: form.location,
      area: form.location,
      rera_number: form.rera_number || null, status: form.status,
      possession_date: form.possession_date,
      price_min: Math.min(...allPrices),
      price_max: Math.max(...allPrices),
      carpet_area_min: null, carpet_area_max: null,
      bhk_types: derivedBhkTypes,
      unit_configs: unitConfigsData,
      usps: uspsList,
      landmarks,
      pitch_script: form.pitch_script || null,
      image_url: form.image_url || null,
      google_maps_url: form.google_maps_url || null,
      tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : null,
    }

    let savedId: string | null = editId
    let saveError: any = null

    if (editId) {
      const { error } = await supabase.from('projects').update(payload).eq('id', editId)
      saveError = error
    } else {
      const { data, error } = await supabase.from('projects').insert(payload).select('id').single()
      saveError = error
      if (data) savedId = (data as any).id
    }

    if (saveError) { setSaving(false); flash('Save error: ' + saveError.message, 'err'); return }

    const locExists = locations.find(l => l.name.toLowerCase() === form.location.toLowerCase())
    if (!locExists) { await supabase.from('locations').insert({ name: form.location.trim() }); loadLocations() }

    setSaving(false)
    flash('✅ Project saved! Generating persona cheat sheets with web search — takes 15-20 sec…')
    setGeneratingPersonas(true)

    const personas = await generatePersonaPitches({ ...payload, usps: uspsList }, validConfigs)

    if (savedId && (personas.investor || personas.end_user)) {
      await supabase.from('projects').update({ persona_pitches: personas }).eq('id', savedId)
    }

    setGeneratingPersonas(false)
    flash(editId ? '✅ Project updated with 4 AI persona pitches!' : '✅ Project published with 4 AI persona pitches!')

    setForm(EMPTY); setEditId(null); setFormLocWarning('')
    setUnitConfigs([{ ...EMPTY_UNIT }]); setQuickFillText('')
    loadProjects(); setSection('projects')
  }

  const addTeamMember = async () => {
    if (!newName || !newMobile || !newPass) { flash('Fill all fields.', 'err'); return }
    const { error } = await supabase.from('salespersons').insert({ name: newName, mobile_number: newMobile, password: newPass, role: 'salesperson' })
    if (error) { flash('Error: ' + error.message, 'err'); return }
    flash('✅ Team member added!'); setNewName(''); setNewMobile(''); setNewPass(''); loadTeam()
  }

  const removeTeamMember = async (id: string) => {
    if (!confirm('Remove this person?')) return
    await supabase.from('salespersons').delete().eq('id', id); loadTeam()
  }

  const updateUnit = (idx: number, field: keyof UnitConfig, val: string) =>
    setUnitConfigs(prev => prev.map((u, i) => i === idx ? { ...u, [field]: val } : u))
  const addUnit = () => setUnitConfigs(prev => [...prev, { ...EMPTY_UNIT }])
  const removeUnit = (idx: number) => setUnitConfigs(prev => prev.filter((_, i) => i !== idx))

  const resetForm = () => {
    setEditId(null); setForm(EMPTY); setUnitConfigs([{ ...EMPTY_UNIT }])
    setFormLocWarning(''); setQuickFillText('')
  }

  const canAddLoc = newLocation.trim() && !addLocIsDuplicate && (!addLocWarning || addLocForce)

  const NAV_ITEMS: [string, string][] = [
    ['projects', '📋 All Projects'],
    ['add', editId ? '✏️ Edit Project' : '➕ Add Project'],
    ['locations', '📍 Locations'],
    ['team', '👥 Team'],
  ]

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0F0C29,#1E1B4B)', color: 'white', display: 'flex', flexDirection: 'column' }}>

      {/* NAV */}
      <nav style={{ background: 'rgba(30,27,75,0.95)', borderBottom: '1px solid rgba(79,70,229,0.25)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#9333EA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>P</div>
          {!isMobile && <span style={{ fontWeight: 700, fontSize: 17, background: 'linear-gradient(90deg,#818CF8,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PropDeck</span>}
          <span style={{ fontSize: 11, background: 'rgba(147,51,234,0.3)', color: '#C084FC', padding: '2px 8px', borderRadius: 10 }}>Admin</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={onGoHome} style={{ background: 'rgba(79,70,229,0.2)', border: '1px solid rgba(79,70,229,0.4)', borderRadius: 7, padding: '6px 12px', color: '#A5B4FC', cursor: 'pointer', fontSize: 12 }}>← Home</button>
          {!isMobile && <span style={{ fontSize: 13, color: '#A5B4FC' }}>{user.name}</span>}
          <button onClick={onLogout} style={{ background: 'none', border: '1px solid rgba(165,180,252,0.3)', borderRadius: 6, padding: '6px 12px', color: '#A5B4FC', cursor: 'pointer', fontSize: 12 }}>Logout</button>
        </div>
      </nav>

      {/* MOBILE TABS */}
      {isMobile && (
        <div style={{ display: 'flex', background: 'rgba(10,8,30,0.9)', borderBottom: '1px solid rgba(79,70,229,0.2)', overflowX: 'auto' }}>
          {NAV_ITEMS.map(([k, l]) => (
            <button key={k} onClick={() => { setSection(k as any); if (k !== 'add') resetForm() }}
              style={{ flexShrink: 0, padding: '12px 10px', border: 'none', fontSize: 11, cursor: 'pointer', background: 'transparent', color: section === k ? '#A5B4FC' : '#64748B', borderBottom: section === k ? '2px solid #6366F1' : '2px solid transparent', fontWeight: section === k ? 600 : 400 }}>
              {l}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* DESKTOP SIDEBAR */}
        {!isMobile && (
          <aside style={{ width: 220, background: 'rgba(10,8,30,0.8)', borderRight: '1px solid rgba(79,70,229,0.2)', padding: 16, flexShrink: 0 }}>
            {NAV_ITEMS.map(([k, l]) => (
              <button key={k} onClick={() => { setSection(k as any); if (k !== 'add') resetForm() }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', marginBottom: 6, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, background: section === k ? 'rgba(79,70,229,0.35)' : 'transparent', color: section === k ? '#A5B4FC' : '#64748B' }}>
                {l}
                {k === 'projects' && <span style={{ float: 'right', background: 'rgba(79,70,229,0.4)', padding: '1px 7px', borderRadius: 10, fontSize: 11 }}>{projects.length}</span>}
                {k === 'locations' && <span style={{ float: 'right', background: 'rgba(79,70,229,0.4)', padding: '1px 7px', borderRadius: 10, fontSize: 11 }}>{locations.length}</span>}
              </button>
            ))}
          </aside>
        )}

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 24 }}>
          {msg && (
            <div style={{ background: msgType === 'ok' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${msgType === 'ok' ? '#10B981' : '#EF4444'}`, borderRadius: 8, padding: '10px 16px', marginBottom: 18, color: msgType === 'ok' ? '#10B981' : '#FCA5A5', fontSize: 14 }}>
              {msg}
            </div>
          )}

          {/* ═══ ALL PROJECTS ═══════════════════════════════════════════════ */}
          {section === 'projects' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: isMobile ? 17 : 20 }}>All Projects ({projects.length})</h2>
                <button onClick={() => { resetForm(); setSection('add') }} style={{ background: 'linear-gradient(135deg,#4F46E5,#9333EA)', border: 'none', borderRadius: 8, padding: '9px 14px', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>+ Add New</button>
              </div>
              {projects.length === 0
                ? <div style={{ textAlign: 'center', padding: 60, color: '#64748B' }}>No projects yet.</div>
                : isMobile
                  ? <div>{projects.map(p => (
                      <div key={p.id} style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.name}</div>
                        <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 8 }}>{p.developer} · {p.location}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: p.status === 'Ready to Move' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)', color: p.status === 'Ready to Move' ? '#10B981' : '#F59E0B' }}>{p.status === 'Ready to Move' ? 'Ready' : 'UC'}</span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => startEdit(p)} style={{ background: 'rgba(79,70,229,0.3)', border: 'none', borderRadius: 6, padding: '5px 12px', color: '#A5B4FC', cursor: 'pointer', fontSize: 13 }}>Edit</button>
                            <button onClick={() => handleDelete(p.id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 6, padding: '5px 12px', color: '#F87171', cursor: 'pointer', fontSize: 13 }}>Del</button>
                          </div>
                        </div>
                      </div>
                    ))}</div>
                  : <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(79,70,229,0.2)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                          <tr style={{ background: 'rgba(79,70,229,0.2)' }}>
                            {['Project','Developer','Location','Status','Price Range','Actions'].map(h => (
                              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#A5B4FC', fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {projects.map(p => (
                            <tr key={p.id} style={{ borderTop: '1px solid rgba(79,70,229,0.12)' }}>
                              <td style={{ padding: '13px 16px', fontWeight: 600 }}>{p.name}</td>
                              <td style={{ padding: '13px 16px', color: '#94A3B8' }}>{p.developer}</td>
                              <td style={{ padding: '13px 16px', color: '#94A3B8' }}>{p.location}</td>
                              <td style={{ padding: '13px 16px' }}>
                                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: p.status === 'Ready to Move' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)', color: p.status === 'Ready to Move' ? '#10B981' : '#F59E0B' }}>{p.status}</span>
                              </td>
                              <td style={{ padding: '13px 16px', color: '#A5B4FC' }}>{fmt(p.price_min)} – {fmt(p.price_max)}</td>
                              <td style={{ padding: '13px 16px' }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button onClick={() => startEdit(p)} style={{ background: 'rgba(79,70,229,0.3)', border: 'none', borderRadius: 6, padding: '5px 14px', color: '#A5B4FC', cursor: 'pointer', fontSize: 13 }}>Edit</button>
                                  <button onClick={() => handleDelete(p.id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 6, padding: '5px 14px', color: '#F87171', cursor: 'pointer', fontSize: 13 }}>Delete</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
              }
            </div>
          )}

          {/* ═══ ADD / EDIT ══════════════════════════════════════════════════ */}
          {section === 'add' && (
            <div style={{ maxWidth: 800 }}>
              <h2 style={{ fontSize: isMobile ? 17 : 20, marginBottom: 20 }}>{editId ? '✏️ Edit Project' : '➕ Add New Project'}</h2>

              {/* 0️⃣ QUICK FILL */}
              <div style={{ ...card, borderColor: 'rgba(139,92,246,0.5)', background: 'rgba(88,28,219,0.1)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#C084FC', marginBottom: 4 }}>🪄 Quick Fill with AI</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>
                  Paste WhatsApp forwards, website copy, or any project text — AI extracts and fills all fields below automatically.
                </div>
                <textarea
                  value={quickFillText}
                  onChange={e => setQuickFillText(e.target.value)}
                  placeholder={`Paste everything here — WhatsApp forward, brochure text, pricing table, any raw project info...\n\nExample:\n"Project: Bhartiya Garden Estate Nikoo 7\nLocation: Sadahalli opposite Prestige Tech Cloud\n2BHK starting ₹85L, Villa ₹5.79Cr...\nKIAL Airport 8km, Metro 4km..."`}
                  rows={7}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, fontSize: 13 }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    onClick={extractWithAI}
                    disabled={generatingFill || !quickFillText.trim()}
                    style={{ background: 'linear-gradient(135deg,#7C3AED,#9333EA)', border: 'none', borderRadius: 8, padding: '10px 22px', color: 'white', fontWeight: 700, cursor: generatingFill || !quickFillText.trim() ? 'default' : 'pointer', fontSize: 14, opacity: !quickFillText.trim() ? 0.5 : 1 }}>
                    {generatingFill ? '⏳ Extracting fields…' : '🪄 Extract & Fill All Fields'}
                  </button>
                </div>
              </div>

              {/* ① BASIC INFO */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#A5B4FC', marginBottom: 16 }}>① Basic Information</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                  <div><label style={lbl}>Project Name *</label><input style={inp} value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. Bhartiya Garden Estate Nikoo 7" /></div>
                  <div><label style={lbl}>Developer *</label><input style={inp} value={form.developer} onChange={e => setF('developer', e.target.value)} placeholder="e.g. Bhartiya City Developers" /></div>
                  <div>
                    <label style={lbl}>Location *</label>
                    <input list="loc-suggestions" style={inp} value={form.location} onChange={e => handleLocationInput(e.target.value)} placeholder="Type or pick a location..." />
                    <datalist id="loc-suggestions">{locations.map(l => <option key={l.id} value={l.name} />)}</datalist>
                    {formLocWarning && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        ⚠ {formLocWarning}
                        <button onClick={useExistingLocation} style={{ fontSize: 11, background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 4, padding: '2px 8px', color: '#F59E0B', cursor: 'pointer' }}>Use existing</button>
                      </div>
                    )}
                  </div>
                  <div><label style={lbl}>RERA Number</label><input style={inp} value={form.rera_number} onChange={e => setF('rera_number', e.target.value)} placeholder="Optional" /></div>
                  <div>
                    <label style={lbl}>Status *</label>
                    <select style={inp} value={form.status} onChange={e => setF('status', e.target.value)}>
                      <option style={{ background: '#1E1B4B' }}>Under Construction</option>
                      <option style={{ background: '#1E1B4B' }}>Ready to Move</option>
                    </select>
                  </div>
                  <div><label style={lbl}>Possession Date</label><input style={inp} value={form.possession_date} onChange={e => setF('possession_date', e.target.value)} placeholder="e.g. Dec 2026" /></div>
                </div>
              </div>

              {/* ② UNIT CONFIGS */}
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#A5B4FC' }}>② Unit Types, Pricing & Super Built-Up Area</div>
                  <button onClick={addUnit} style={{ background: 'rgba(79,70,229,0.3)', border: '1px solid rgba(79,70,229,0.4)', borderRadius: 6, padding: '5px 12px', color: '#A5B4FC', cursor: 'pointer', fontSize: 12 }}>+ Add Unit Type</button>
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 14 }}>
                  Enter prices in ₹ (e.g. 4900000 = ₹49L · 10000000 = ₹1Cr · 57900000 = ₹5.79Cr) · SBA = Super Built-Up Area in sqft
                </div>
                {unitConfigs.map((u, idx) => (
                  <div key={idx} style={{ background: 'rgba(15,12,41,0.5)', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1.2fr 1fr 1fr 0.8fr 0.8fr 36px', gap: 8, alignItems: 'end' }}>
                      <div>
                        <label style={lbl}>Unit Type *</label>
                        <select style={inp} value={u.type} onChange={e => updateUnit(idx, 'type', e.target.value)}>
                          <option value="" style={{ background: '#1E1B4B' }}>Select type</option>
                          {UNIT_TYPES.map(t => <option key={t} value={t} style={{ background: '#1E1B4B' }}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Price Min (₹) *</label>
                        <input style={inp} type="number" value={u.price_min} onChange={e => updateUnit(idx, 'price_min', e.target.value)} placeholder="4900000" />
                      </div>
                      <div>
                        <label style={lbl}>Price Max (₹)</label>
                        <input style={inp} type="number" value={u.price_max} onChange={e => updateUnit(idx, 'price_max', e.target.value)} placeholder="8800000" />
                      </div>
                      <div>
                        <label style={lbl}>SBA Min (sqft)</label>
                        <input style={inp} type="number" value={u.sba_min} onChange={e => updateUnit(idx, 'sba_min', e.target.value)} placeholder="650" />
                      </div>
                      <div>
                        <label style={lbl}>SBA Max (sqft)</label>
                        <input style={inp} type="number" value={u.sba_max} onChange={e => updateUnit(idx, 'sba_max', e.target.value)} placeholder="1200" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 1 }}>
                        {unitConfigs.length > 1 && (
                          <button onClick={() => removeUnit(idx)} style={{ background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 6, width: 32, height: 36, color: '#F87171', cursor: 'pointer', fontSize: 14 }}>✕</button>
                        )}
                      </div>
                    </div>
                    {u.price_min && (
                      <div style={{ fontSize: 11, color: '#818CF8', marginTop: 6 }}>
                        → {u.type || 'Unit'}: {fmt(Number(u.price_min))}{u.price_max && u.price_max !== u.price_min ? `–${fmt(Number(u.price_max))}` : ''}
                        {u.sba_min ? ` · ${u.sba_min}${u.sba_max && u.sba_max !== u.sba_min ? `–${u.sba_max}` : ''} sqft SBA` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* ③ KEY HIGHLIGHTS */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#A5B4FC', marginBottom: 16 }}>③ Key Highlights</div>
                {(['usp1','usp2','usp3','usp4','usp5'] as const).map((k, i) => (
                  <div key={k} style={{ marginBottom: 10 }}>
                    <label style={lbl}>Highlight {i+1}{i === 0 ? ' *' : ''}</label>
                    <input style={inp} value={form[k]} onChange={e => setF(k, e.target.value)}
                      placeholder={[
                        'e.g. Most affordable Godrej in North Bangalore',
                        'e.g. 8km from KIAL — ideal for airline professionals & investors',
                        'e.g. RERA approved — Godrej brand with delivery guarantee',
                        'e.g. Future Metro Phase 2 will add 30%+ appreciation',
                        'e.g. High rental yield — airport proximity drives demand'
                      ][i]} />
                  </div>
                ))}
              </div>

              {/* ④ LANDMARKS */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#A5B4FC', marginBottom: 16 }}>④ Nearby Landmarks</div>
                {[1,2,3,4].map(n => (
                  <div key={n} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 0.6fr' : '1fr 0.6fr 0.8fr', gap: 10, marginBottom: 10 }}>
                    <div><label style={lbl}>Landmark {n}</label><input style={inp} value={(form as any)[`lm${n}_name`]} onChange={e => setF(`lm${n}_name` as any, e.target.value)} placeholder="e.g. Kempegowda Airport" /></div>
                    <div><label style={lbl}>Distance</label><input style={inp} value={(form as any)[`lm${n}_dist`]} onChange={e => setF(`lm${n}_dist` as any, e.target.value)} placeholder="8 km" /></div>
                    {!isMobile && (
                      <div><label style={lbl}>Type</label>
                        <select style={inp} value={(form as any)[`lm${n}_type`]} onChange={e => setF(`lm${n}_type` as any, e.target.value)}>
                          {LM_TYPES.map(t => <option key={t} style={{ background: '#1E1B4B' }}>{t}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* ⑤ IMAGE & MAP */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#A5B4FC', marginBottom: 16 }}>⑤ Image & Map</div>
                {/* Upload button */}
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Project Image</label>
                  {form.image_url ? (
                    <div>
                      <img src={form.image_url} alt="preview" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, marginBottom: 10, display: 'block' }} />
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <label style={{ cursor: 'pointer', background: 'rgba(79,70,229,0.2)', border: '1px solid rgba(79,70,229,0.4)', borderRadius: 7, padding: '7px 14px', color: '#A5B4FC', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          📷 Change Image
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploadingImage} />
                        </label>
                        <button onClick={() => setF('image_url', '')} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 7, padding: '7px 14px', color: '#F87171', cursor: 'pointer', fontSize: 13 }}>✕ Remove</button>
                        {uploadingImage && <span style={{ fontSize: 12, color: '#A5B4FC', alignSelf: 'center' }}>⏳ Uploading...</span>}
                      </div>
                    </div>
                  ) : (
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, borderRadius: 10, border: '2px dashed rgba(79,70,229,0.35)', cursor: uploadingImage ? 'default' : 'pointer', color: '#64748B', gap: 8, marginBottom: 8, background: 'rgba(79,70,229,0.04)' }}>
                      {uploadingImage
                        ? <span style={{ color: '#A5B4FC', fontSize: 14 }}>Uploading...</span>
                        : <><span style={{ fontSize: 36 }}>📷</span><span style={{ fontSize: 13 }}>Click to upload project image</span><span style={{ fontSize: 11 }}>JPG · PNG · WEBP — max 5MB</span></>
                      }
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploadingImage} />
                    </label>
                  )}
                  <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 4 }}>Or paste image URL directly</label>
                  <input style={{ ...inp, fontSize: 12 }} value={form.image_url} onChange={e => setF('image_url', e.target.value)} placeholder="https://images.unsplash.com/..." />
                </div>
                <div>
                  <label style={lbl}>Google Maps Embed URL</label>
                  <input style={inp} value={form.google_maps_url} onChange={e => setF('google_maps_url', e.target.value)} placeholder="https://maps.google.com/..." />
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 5 }}>Get embed URL: Google Maps → Share → Embed a map → copy the src value</div>
                </div>
              </div>

              {/* ⑥ PITCH SCRIPT */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#A5B4FC', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>⑥ General Pitch Script</span>
                  <button onClick={generatePitchScript} disabled={generatingScript || !form.name}
                    style={{ background: 'linear-gradient(135deg,#4F46E5,#9333EA)', border: 'none', borderRadius: 7, padding: '6px 14px', color: 'white', fontSize: 12, fontWeight: 600, cursor: generatingScript || !form.name ? 'default' : 'pointer', opacity: !form.name ? 0.4 : 1 }}>
                    {generatingScript ? '⏳ Generating…' : '✨ Generate with AI'}
                  </button>
                </div>
                <textarea
                  style={{ ...inp, height: 110, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7 }}
                  value={form.pitch_script} onChange={e => setF('pitch_script', e.target.value)}
                  placeholder="Write manually or click ✨ Generate with AI above…" />
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                  {form.pitch_script.length} chars · On save, 4 persona pitches (investor/family/first-time/NRI) will be auto-generated separately
                </div>
              </div>

              {/* TAGS */}
              <div style={{ marginBottom: 24 }}>
                <label style={lbl}>Tags (comma separated)</label>
                <input style={inp} value={form.tags} onChange={e => setF('tags', e.target.value)} placeholder="Premium, Airport Zone, NRI Friendly, Township, Investment" />
              </div>

              {/* SUBMIT */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', paddingBottom: 40 }}>
                <button onClick={save} disabled={saving || generatingPersonas}
                  style={{ background: 'linear-gradient(135deg,#4F46E5,#9333EA)', border: 'none', borderRadius: 8, padding: '12px 28px', color: 'white', fontWeight: 700, cursor: saving || generatingPersonas ? 'default' : 'pointer', fontSize: 15, opacity: saving || generatingPersonas ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : generatingPersonas ? '⏳ AI persona pitches generating…' : editId ? '✅ Update' : '🚀 Publish'}
                </button>
                <button onClick={() => { resetForm(); setSection('projects') }}
                  style={{ background: 'transparent', border: '1px solid rgba(165,180,252,0.3)', borderRadius: 8, padding: '12px 20px', color: '#A5B4FC', cursor: 'pointer', fontSize: 14 }}>
                  Cancel
                </button>
                {generatingPersonas && (
                  <span style={{ fontSize: 12, color: '#818CF8' }}>
                    Generating 4 AI pitches: 💰 Investor · 🏠 Family · 🔑 First-time · 🌍 NRI…
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ═══ LOCATIONS ════════════════════════════════════════════════════ */}
          {section === 'locations' && (
            <div>
              <h2 style={{ fontSize: isMobile ? 17 : 20, marginBottom: 6 }}>📍 Locations ({locations.length})</h2>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>Locations here appear in the salesperson filter. Only unused locations can be deleted.</p>
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#A5B4FC', marginBottom: 14 }}>Add New Location</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <input style={inp} value={newLocation} onChange={e => handleNewLocationInput(e.target.value)} placeholder="e.g. Devanahalli" onKeyDown={e => e.key === 'Enter' && canAddLoc && addLocation()} />
                    {addLocWarning && (
                      <div style={{ marginTop: 6, fontSize: 12, color: addLocIsDuplicate ? '#F87171' : '#F59E0B', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {addLocIsDuplicate ? '✗' : '⚠'} {addLocWarning}
                        {!addLocIsDuplicate && !addLocForce && (
                          <button onClick={() => setAddLocForce(true)} style={{ fontSize: 11, background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 4, padding: '2px 8px', color: '#F59E0B', cursor: 'pointer' }}>Yes, add anyway</button>
                        )}
                      </div>
                    )}
                    {addLocForce && <div style={{ marginTop: 4, fontSize: 11, color: '#10B981' }}>✓ Confirmed — click Add Location.</div>}
                  </div>
                  <button onClick={addLocation} disabled={!canAddLoc}
                    style={{ background: 'linear-gradient(135deg,#4F46E5,#9333EA)', border: 'none', borderRadius: 8, padding: '10px 20px', color: 'white', fontWeight: 600, cursor: canAddLoc ? 'pointer' : 'default', fontSize: 14, opacity: canAddLoc ? 1 : 0.4, whiteSpace: 'nowrap' }}>
                    + Add Location
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 10 }}>💡 Use full names — "Sarjapur Road" not "Sarj Rd".</div>
              </div>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(79,70,229,0.2)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: 'rgba(79,70,229,0.2)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#A5B4FC', fontWeight: 600 }}>Location</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', color: '#A5B4FC', fontWeight: 600 }}>Projects</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', color: '#A5B4FC', fontWeight: 600 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map(loc => {
                      const count = locationCounts[loc.name] || 0
                      return (
                        <tr key={loc.id} style={{ borderTop: '1px solid rgba(79,70,229,0.12)' }}>
                          <td style={{ padding: '13px 16px', fontWeight: 500 }}>{loc.name}</td>
                          <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                            {count > 0
                              ? <span style={{ background: 'rgba(99,102,241,0.2)', color: '#A5B4FC', padding: '2px 10px', borderRadius: 12, fontSize: 12 }}>{count} project{count > 1 ? 's' : ''}</span>
                              : <span style={{ color: '#475569', fontSize: 12 }}>—</span>}
                          </td>
                          <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                            {count > 0
                              ? <span style={{ fontSize: 12, color: '#475569' }}>🔒 In use</span>
                              : <button onClick={() => deleteLocation(loc.id, loc.name)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 6, padding: '5px 14px', color: '#F87171', cursor: 'pointer', fontSize: 13 }}>🗑 Delete</button>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ TEAM ═══════════════════════════════════════════════════════ */}
          {section === 'team' && (
            <div>
              <h2 style={{ fontSize: isMobile ? 17 : 20, marginBottom: 20 }}>👥 Team Accounts</h2>
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#A5B4FC', marginBottom: 16 }}>Add New Salesperson</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div><label style={lbl}>Name</label><input style={inp} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Rahul S." /></div>
                  <div><label style={lbl}>Mobile</label><input style={inp} value={newMobile} onChange={e => setNewMobile(e.target.value)} placeholder="9902700565" /></div>
                  <div><label style={lbl}>Password</label><input style={inp} type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Set password" /></div>
                </div>
                <button onClick={addTeamMember} style={{ background: 'linear-gradient(135deg,#4F46E5,#9333EA)', border: 'none', borderRadius: 7, padding: '10px 22px', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>+ Add Salesperson</button>
              </div>
              <div>
                {team.map(m => (
                  <div key={m.id} style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: 10, padding: 16, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</div>
                      <div style={{ fontSize: 13, color: '#94A3B8' }}>{m.mobile_number}</div>
                      <span style={{ background: m.role === 'admin' ? 'rgba(147,51,234,0.25)' : 'rgba(79,70,229,0.2)', color: m.role === 'admin' ? '#C084FC' : '#A5B4FC', fontSize: 11, padding: '2px 9px', borderRadius: 10, marginTop: 4, display: 'inline-block' }}>{m.role}</span>
                    </div>
                    {m.role !== 'admin' && (
                      <button onClick={() => removeTeamMember(m.id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 5, padding: '6px 14px', color: '#F87171', cursor: 'pointer', fontSize: 13 }}>Remove</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
