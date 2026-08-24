import { useState, useEffect } from 'react'
import { supabase, getSession } from '../lib/supabase'
import AppShell from '../components/AppShell'
import UserMenu, { buildAccountMenu } from '../components/UserMenu'
import BrandLogo from '../components/BrandLogo'
import GlobalSearch from '../components/GlobalSearch'
import ThemeToggle from '../components/ThemeToggle'
import NotificationBell from '../components/NotificationBell'
import { ZONES } from '../lib/zones'
import { PROJECT_STATUSES, RERA_NA_STATUSES, statusMeta } from '../lib/status'
import { ASSET_KINDS, assetKindMeta, sortAssets, type ProjectAsset } from '../lib/assets'
import { uploadFileWithProgress } from '../lib/upload'
import { extractFileText } from '../lib/extractText'
import { formatPrice } from '../lib/format'

interface Props {
  user: any
  onGoHome: () => void
  onViewProject: (id: string) => void
  onGoAdmin?: () => void
  onGoProfile: () => void
  onGoTemplates: () => void
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
  zones: string[]
}

interface UnitConfig {
  type: string
  price_min: string
  price_max: string
  sba_min: string
  sba_max: string
  units_left: string   // '' = availability not tracked; '0' = sold out
  rate: string         // editor-only ₹/sqft helper; not persisted (price is derived from it)
}

interface FormData {
  name: string; developer: string; location: string
  rera_number: string; status: string; possession_date: string
  usp1: string; usp2: string; usp3: string; usp4: string; usp5: string
  pitch_script: string; image_url: string; google_maps_url: string; tags: string
}

interface LandmarkItem { name: string; distance: string; type: string }

const EMPTY: FormData = {
  name: '', developer: '', location: '', rera_number: '',
  status: 'Launched', possession_date: '',
  usp1: '', usp2: '', usp3: '', usp4: '', usp5: '',
  pitch_script: '', image_url: '', google_maps_url: '', tags: '',
}

const EMPTY_UNIT: UnitConfig = { type: '', price_min: '', price_max: '', sba_min: '', sba_max: '', units_left: '', rate: '' }

// Given a unit's ₹/sqft rate + SBA range, derive its price range. No rate/SBA → prices untouched.
const withDerivedPrice = (u: UnitConfig): UnitConfig => {
  const rate = Number(u.rate), sbaMin = Number(u.sba_min)
  if (!(rate > 0) || !(sbaMin > 0)) return u
  const sbaMax = Number(u.sba_max) > 0 ? Number(u.sba_max) : sbaMin
  return { ...u, price_min: String(Math.round(rate * sbaMin)), price_max: String(Math.round(rate * sbaMax)) }
}

// Back-compute a display rate from an existing unit's price ÷ SBA, rounded to a clean ₹100.
const rateFromUnit = (priceMin: any, sbaMin: any): string => {
  const p = Number(priceMin), s = Number(sbaMin)
  return p > 0 && s > 0 ? String(Math.round(p / s / 100) * 100) : ''
}
const UNIT_TYPES = ['Studio','1BHK','1.5BHK','2BHK','2.5BHK','3BHK','3.5BHK','4BHK','Duplex','Penthouse','Villa','Row house','Plot']
const LM_TYPES = ['Metro','School','Hospital','IT Park','Mall','Airport','Highway','Other']

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(79,70,229,0.12)', border: '1px solid var(--border-strong)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box'
}
const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--text-dim)', marginBottom: 6, display: 'block' }
const card: React.CSSProperties = {
  background: 'rgba(79,70,229,0.08)', border: '1px solid var(--border)',
  borderRadius: 12, padding: 20, marginBottom: 20
}


export default function AdminPanel({ user, onViewProject, ...nav }: Props) {
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
  const [newEmail, setNewEmail] = useState('')
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editTeam, setEditTeam] = useState({ name: '', mobile_number: '', email: '', password: '' })
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [locations, setLocations] = useState<LocItem[]>([])
  const [locationCounts, setLocationCounts] = useState<Record<string, number>>({})
  const [newLocation, setNewLocation] = useState('')
  const [newLocZones, setNewLocZones] = useState<string[]>([])
  const [addLocWarning, setAddLocWarning] = useState('')
  const [addLocIsDuplicate, setAddLocIsDuplicate] = useState(false)
  const [addLocForce, setAddLocForce] = useState(false)
  const [formLocWarning, setFormLocWarning] = useState('')
  const [errFields, setErrFields] = useState<Set<string>>(new Set())
  const [unitConfigs, setUnitConfigs] = useState<UnitConfig[]>([{ ...EMPTY_UNIT }])
  const [psfRate, setPsfRate] = useState('')
  const [landmarks, setLandmarks] = useState<LandmarkItem[]>([])
  const [mapResolving, setMapResolving] = useState(false)
  const [mapPin, setMapPin] = useState('')
  const [dragUnit, setDragUnit] = useState<number | null>(null)
  const [dragOverUnit, setDragOverUnit] = useState<number | null>(null)
  const [quickFillText, setQuickFillText] = useState('')
  const [generatingFill, setGeneratingFill] = useState(false)
  const [extractingFiles, setExtractingFiles] = useState(false)
  const [extractStatus, setExtractStatus] = useState('')
  const [generatingScript, setGeneratingScript] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  // Assets (brochures/plans/gallery/video) for the project being edited.
  const [assets, setAssets] = useState<ProjectAsset[]>([])
  const [assetKind, setAssetKind] = useState<string>(ASSET_KINDS[0].key)
  const [assetLabel, setAssetLabel] = useState('')
  const [assetUrl, setAssetUrl] = useState('')
  const [uploadingAsset, setUploadingAsset] = useState(false)
  const [assetProgress, setAssetProgress] = useState(0)

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
    setLocations(((data as any[]) || []).map((l) => ({ id: l.id, name: l.name, zones: l.zones ?? [] })))
  }

  const loadTeam = async () => {
    // Team data lives in the now-locked salespersons table, so it comes back
    // through an admin-only function that checks our session token first.
    const { data } = await supabase.rpc('admin_list_team', { p_token: getSession() })
    setTeam(data || [])
  }

  useEffect(() => { loadProjects(); loadTeam(); loadLocations() }, [])

  const flash = (m: string, t: 'ok' | 'err' = 'ok') => {
    setMsg(m); setMsgType(t); setTimeout(() => setMsg(''), 5000)
  }

  const setF = (k: keyof FormData, v: any) => {
    setForm(f => ({ ...f, [k]: v }))
    // Clear a required-field error as soon as the user starts fixing it.
    if (errFields.has(k)) setErrFields(prev => { const next = new Set(prev); next.delete(k); return next })
  }

  // Red border + tint + glow for a required field flagged blank on publish.
  const inpErr = (field: string): React.CSSProperties =>
    errFields.has(field)
      ? { ...inp, border: '2px solid #EF4444', background: 'rgba(239,68,68,0.15)', boxShadow: '0 0 0 3px rgba(239,68,68,0.25)' }
      : inp

  // ─── Gemini helper ────────────────────────────────────────────────────────
  // Calls go through our own /api/gemini server function so the API key stays
  // on the server and never ships in the browser bundle. Pass useSearch=true to
  // let Gemini ground its answer in a live Google search.
  const callGemini = async (prompt: string, useSearch = false, image?: { mimeType: string; data: string }): Promise<string> => {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, useSearch, image })
    })
    const data = await res.json()
    return data.text?.trim() || ''
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

  // Every upload lands its text in the Quick Fill box. Documents (PDF/PPTX/DOCX/
  // text) are read locally; images are transcribed by Gemini vision. Then one
  // "Extract & Fill" reads the whole box and reconciles across sources.
  const handleBrochureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    setExtractingFiles(true)
    let added = ''
    let emptyCount = 0
    for (const file of files) {
      try {
        let text = ''
        if (file.type.startsWith('image/')) {
          setExtractStatus(`Reading ${file.name} with AI…`)
          text = (await transcribeImageWithGemini(file)).trim()
        } else {
          setExtractStatus(`Reading ${file.name}…`)
          const r = await extractFileText(file)
          if (r.empty) { emptyCount++; continue }
          text = r.text
        }
        if (text.length < 5) { emptyCount++; continue }
        added += `\n\n----- ${file.name} -----\n${text}`
      } catch (err) {
        flash(`Could not read "${file.name}": ${err instanceof Error ? err.message : 'error'}`, 'err')
      }
    }
    if (added) setQuickFillText((prev) => (prev.trim() ? prev + added : added.trim()))
    setExtractStatus('')
    setExtractingFiles(false)
    if (emptyCount > 0 && !added) flash(`Couldn't read any text from the file(s).`, 'err')
    else if (added) flash('✅ Added to the box — review it, then click Extract & Fill.')
  }

  // Applies an extracted-fields JSON object onto the form. Shared by the text
  // path (Quick Fill box) and the image path (Gemini vision).
  const applyExtracted = (ex: any) => {
    if (ex.name) setF('name', ex.name)
    if (ex.developer) setF('developer', ex.developer)
    if (ex.location) { setF('location', ex.location); setFormLocWarning('') }
    if (ex.rera_number) setF('rera_number', ex.rera_number)
    if (ex.status) setF('status', ex.status)
    if (ex.possession_date) setF('possession_date', ex.possession_date)
    if (Array.isArray(ex.usps)) {
      const keys: (keyof FormData)[] = ['usp1','usp2','usp3','usp4','usp5']
      keys.forEach((k, i) => { if (ex.usps[i]) setF(k, ex.usps[i]) })
    }
    if (Array.isArray(ex.landmarks)) {
      setLandmarks(ex.landmarks
        .filter((lm: any) => lm?.name)
        .map((lm: any) => ({ name: lm.name || '', distance: lm.distance || '', type: LM_TYPES.includes(lm.type) ? lm.type : 'Other' })))
    }
    if (Array.isArray(ex.tags)) setF('tags', ex.tags.join(', '))
    if (Array.isArray(ex.unit_configs) && ex.unit_configs.length > 0) {
      setUnitConfigs(ex.unit_configs.map((u: any) => ({
        type: u.type || '',
        price_min: String(u.price_min || ''),
        price_max: String(u.price_max || ''),
        sba_min: String(u.sba_min || ''),
        sba_max: String(u.sba_max || ''),
        units_left: u.units_left === 0 || u.units_left ? String(u.units_left) : '',
        rate: rateFromUnit(u.price_min, u.sba_min),
      })))
    }
  }

  // The extraction prompt, shared by text and image paths. `source` describes
  // where the details are ("the text below" / "the image").
  const extractionPrompt = (source: string, text = '') => `You are a real estate data extraction expert for Bangalore, India.

Extract project details from ${source} and return ONLY a valid JSON object (no markdown, no explanation).

Required JSON structure:
{
  "name": "full project name",
  "developer": "developer/builder name",
  "location": "micro-market area only (e.g. Sadahalli, Whitefield, Sarjapur Road — NOT full address)",
  "rera_number": "RERA number if present else empty string",
  "status": "one of: Pre launch, Launched, Ready to move in, Resale",
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
- The content may combine several sources (pasted text + uploaded brochures/price images). Cross-check them.
- If the SAME value (especially a unit's price) appears more than once with different numbers, prefer the figure from a dated or labelled pricing table (e.g. "Q1 FY27", "Pricing Grid") and the most specific/recent one; ignore clearly older or vaguer figures.
- Prefer an explicit pricing table over a casual mention when both exist.
- Create one unit_config entry per distinct unit type mentioned
- For USPs: prioritise facts that a salesperson can say on a live call to different buyer types
- Include all notable landmarks with realistic distances (hospitals, schools, tech parks, malls, metro, airport, highways)
- Tags: 3-5 short keywords (e.g. Township, Airport Zone, Premium, NRI Friendly, Investment)
- Return ONLY the JSON object${text ? `\n\nText:\n${text}` : ''}`

  // Quick Fill: extract fields from the pasted/extracted text in the box.
  const extractWithAI = async () => {
    if (!quickFillText.trim()) { flash('Paste some project info first.', 'err'); return }
    setGeneratingFill(true)
    try {
      const raw = await callGemini(extractionPrompt('the text below', quickFillText))
      const ex = safeJSON(raw)
      if (!ex) { flash('AI returned unexpected format. Try again.', 'err'); setGeneratingFill(false); return }
      applyExtracted(ex)
      flash('✅ Fields filled! Review everything below, then click Publish.')
    } catch {
      flash('Extraction failed. Check pasted text and try again.', 'err')
    }
    setGeneratingFill(false)
  }

  // Transcribes a brochure/pricing-table IMAGE to plain text via Gemini vision
  // (reliable on tables, unlike client OCR) and returns it — so it lands in the
  // Quick Fill box alongside everything else, ready for one combined extract.
  const transcribeImageWithGemini = async (file: File): Promise<string> => {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error('Could not read image'))
      r.readAsDataURL(file)
    })
    const base64 = dataUrl.split(',')[1] || ''
    const prompt = `Read the attached image of a real-estate document (brochure, price list, pricing table, floor plan, etc.).
Output ALL text you can see, EXACTLY as written — every unit type, area (sqft), and price. Preserve table structure: one row per line, columns separated by " | ". Include any title/date on the sheet.
Output plain text only — no commentary, no markdown.`
    return await callGemini(prompt, false, { mimeType: file.type || 'image/jpeg', data: base64 })
  }

  // ─── Persona pitch generation (Google Search grounded) ─────────────────────
  const generatePersonaPitches = async (
    p: any, configs: UnitConfig[]
  ): Promise<Record<string, any>> => {
    const unitLines = configs
      .filter(u => u.type)
      .map(u => {
        const pMin = u.price_min ? formatPrice(Number(u.price_min)) : '?'
        const pMax = u.price_max ? `–${formatPrice(Number(u.price_max))}` : ''
        const sba = u.sba_min ? `, SBA ${u.sba_min}${u.sba_max && u.sba_max !== u.sba_min ? `–${u.sba_max}` : ''} sqft` : ''
        return `  ${u.type}: ${pMin}${pMax}${sba}`
      })
      .join('\n')
    const lmText = (p.landmarks || [])
      .filter((lm: any) => lm?.name)
      .map((lm: any) => `${lm.name} (${lm.distance}, ${lm.type})`)
      .join(', ')
    const validConfigs = configs.filter(u => u.price_min)

    // Cheapest config = "entry" unit type — used for EMI / entry price / NRI conversion,
    // so every unit-specific figure can name the exact configuration it's based on.
    const entryConfig = validConfigs.length > 0
      ? validConfigs.reduce((min, u) => Number(u.price_min) < Number(min.price_min) ? u : min, validConfigs[0])
      : null
    const entryPrice = entryConfig ? formatPrice(Number(entryConfig.price_min)) : 'entry price'
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
      const raw = await callGemini(prompt, true)
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

  // ─── Project assets (brochures / plans / gallery / video) ──────────────────
  const loadAssets = async (projectId: string) => {
    const { data } = await supabase.from('project_assets').select('*').eq('project_id', projectId)
    setAssets(((data as ProjectAsset[]) || []).slice().sort(sortAssets))
  }

  // Uploads a PDF/image into the existing public bucket (under an assets/
  // prefix) and drops the resulting URL into the asset form. Video and other
  // large files should be pasted as links instead.
  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 250 * 1024 * 1024) { flash('File too large. Max 250MB — for bigger videos, host on YouTube/Drive and paste the link.', 'err'); return }
    setUploadingAsset(true); setAssetProgress(0)
    try {
      const fileName = `assets/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const { publicUrl } = await uploadFileWithProgress('project-images', fileName, file, setAssetProgress)
      setAssetUrl(publicUrl)
      if (!assetLabel.trim()) setAssetLabel(assetKindMeta(assetKind).label)
      flash('✅ File uploaded — now click Add.')
    } catch (err) {
      flash('Upload failed: ' + (err instanceof Error ? err.message : 'unknown error'), 'err')
    } finally {
      setUploadingAsset(false); setAssetProgress(0)
    }
  }

  const addAsset = async () => {
    if (!editId) { flash('Save the project first, then add brochures.', 'err'); return }
    if (!assetUrl.trim()) { flash('Upload a file or paste a link first.', 'err'); return }
    const label = assetLabel.trim() || assetKindMeta(assetKind).label
    const { error } = await supabase.rpc('admin_add_project_asset', {
      p_token: getSession(), p_project_id: editId, p_kind: assetKind, p_label: label, p_url: assetUrl.trim(),
    })
    if (error) { flash('Error: ' + error.message, 'err'); return }
    setAssetLabel(''); setAssetUrl('')
    loadAssets(editId)
    flash('✅ Asset added.')
  }

  const removeAsset = async (id: string) => {
    const { error } = await supabase.rpc('admin_delete_project_asset', { p_token: getSession(), p_id: id })
    if (error) { flash('Error: ' + error.message, 'err'); return }
    if (editId) loadAssets(editId)
  }

  // ─── Pitch script generation (section ⑥) ─────────────────────────────────
  const generatePitchScript = async () => {
    if (!form.name || !form.developer || !form.location) {
      flash('Fill in Name, Developer, and Location first.', 'err'); return
    }
    setGeneratingScript(true)
    const usps = [form.usp1, form.usp2, form.usp3, form.usp4, form.usp5].filter(Boolean)
    const unitSummary = unitConfigs.filter(u => u.type && u.price_min)
      .map(u => `${u.type} from ${formatPrice(Number(u.price_min))}`).join(', ')
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
    let { error } = await supabase.rpc('admin_add_location', { p_token: getSession(), p_name: name, p_zones: newLocZones })
    // Before the zones migration runs, the 3-arg RPC doesn't exist — fall back
    // to the original so adding locations keeps working (unzoned).
    if (error && /function|does not exist|schema cache/i.test(error.message)) {
      ({ error } = await supabase.rpc('admin_add_location', { p_token: getSession(), p_name: name }))
    }
    if (error) { flash('Error: ' + error.message, 'err'); return }
    flash(`✅ "${name}" added!`)
    setNewLocation(''); setNewLocZones([]); setAddLocWarning(''); setAddLocForce(false); setAddLocIsDuplicate(false)
    loadLocations()
  }

  // Save an existing area's zones. Optimistic — the picker updates in place.
  const setLocationZones = async (id: number, zones: string[]) => {
    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, zones } : l)))
    const { error } = await supabase.rpc('admin_set_location_zones', { p_token: getSession(), p_id: id, p_zones: zones })
    if (error) { flash('Error: ' + error.message, 'err'); loadLocations() }
  }

  const deleteLocation = async (id: number, name: string) => {
    const count = locationCounts[name] || 0
    if (count > 0) { flash(`Cannot delete "${name}" — ${count} project${count > 1 ? 's' : ''} use this location.`, 'err'); return }
    if (!confirm(`Delete "${name}"?`)) return
    const { error } = await supabase.rpc('admin_delete_location', { p_token: getSession(), p_id: id })
    if (error) { flash('Error: ' + error.message, 'err'); return }
    flash(`"${name}" removed.`); loadLocations()
  }

  // ─── Edit project ─────────────────────────────────────────────────────────
  const startEdit = (p: any) => {
    setForm({
      name: p.name || '', developer: p.developer || '', location: p.location || '',
      rera_number: p.rera_number || '', status: p.status || 'Launched',
      // Possession is required now; fill legacy blanks with a safe placeholder
      // so editing an old project isn't blocked.
      possession_date: p.possession_date || '2040',
      usp1: p.usps?.[0] || '', usp2: p.usps?.[1] || '', usp3: p.usps?.[2] || '',
      usp4: p.usps?.[3] || '', usp5: p.usps?.[4] || '',
      pitch_script: p.pitch_script || '', image_url: p.image_url || '',
      google_maps_url: p.google_maps_url || '', tags: p.tags?.join(', ') || '',
    })
    setLandmarks(Array.isArray(p.landmarks)
      ? p.landmarks.filter((lm: any) => lm?.name).map((lm: any) => ({ name: lm.name || '', distance: lm.distance || '', type: LM_TYPES.includes(lm.type) ? lm.type : 'Other' }))
      : [])
    if (Array.isArray(p.unit_configs) && p.unit_configs.length > 0) {
      setUnitConfigs(p.unit_configs.map((u: any) => ({
        type: u.type || '', price_min: String(u.price_min || ''),
        price_max: String(u.price_max || ''), sba_min: String(u.sba_min || ''), sba_max: String(u.sba_max || ''),
        units_left: u.units_left === 0 || u.units_left ? String(u.units_left) : '',
        rate: rateFromUnit(u.price_min, u.sba_min),
      })))
    } else if (Array.isArray(p.bhk_types) && p.bhk_types.length > 0) {
      setUnitConfigs(p.bhk_types.map((type: string) => ({
        type, price_min: String(p.price_min || ''), price_max: String(p.price_max || ''),
        sba_min: '', sba_max: '', units_left: '', rate: '',
      })))
    } else {
      setUnitConfigs([{ ...EMPTY_UNIT }])
    }
    // Pre-fill the project's ₹/sqft from the first unit that has both price & SBA.
    const rateUnit = (p.unit_configs || []).find((u: any) => Number(u.price_min) > 0 && Number(u.sba_min) > 0)
    setPsfRate(rateUnit ? rateFromUnit(rateUnit.price_min, rateUnit.sba_min) : '')
    setFormLocWarning(''); setQuickFillText(''); setEditId(p.id); setSection('add')
    setAssetKind(ASSET_KINDS[0].key); setAssetLabel(''); setAssetUrl('')
    loadAssets(p.id)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project?')) return
    const { error } = await supabase.rpc('admin_delete_project', { p_token: getSession(), p_id: id })
    if (error) { flash('Error: ' + error.message, 'err'); return }
    flash('Project deleted.'); loadProjects()
  }

  // ─── Save project ─────────────────────────────────────────────────────────
  const save = async () => {
    // Required fields, in on-screen order — flag every blank one, then jump to the first.
    const required: (keyof FormData)[] = ['name', 'developer', 'location', 'rera_number', 'status', 'possession_date']
    const blanks = required.filter(k => !String(form[k] ?? '').trim())
    if (blanks.length > 0) {
      setErrFields(new Set(blanks))
      const first = document.getElementById('f-' + blanks[0])
      if (first) {
        first.scrollIntoView({ behavior: 'smooth', block: 'center' })
        first.focus({ preventScroll: true })
      }
      flash('Fill all required fields: Name, Developer, Location, RERA Number, Status, Possession Date. Use "NA" for RERA if pre-launch/resale.', 'err'); return
    }
    setErrFields(new Set())
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
      units_left: u.units_left.trim() === '' ? null : Number(u.units_left),
    }))

    const allPrices = unitConfigsData.flatMap(u => [u.price_min, u.price_max])
    const derivedBhkTypes = [...new Set(unitConfigsData.map(u => u.type))]

    const landmarksData = landmarks
      .map(l => ({ name: l.name.trim(), distance: l.distance.trim(), type: l.type }))
      .filter(l => l.name)

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
      landmarks: landmarksData,
      pitch_script: form.pitch_script || null,
      image_url: form.image_url || null,
      google_maps_url: form.google_maps_url || null,
      tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : null,
    }

    const { data: savedIdData, error: saveError } = await supabase.rpc('admin_save_project', {
      p_token: getSession(), p_id: editId, p_payload: payload,
    })

    if (saveError) { setSaving(false); flash('Save error: ' + saveError.message, 'err'); return }

    const savedId: string | null = savedIdData

    const locExists = locations.find(l => l.name.toLowerCase() === form.location.toLowerCase())
    if (!locExists) {
      await supabase.rpc('admin_add_location', { p_token: getSession(), p_name: form.location.trim() })
      loadLocations()
    }

    setSaving(false)

    // The project is saved at this point. The persona cheat-sheets take 15–20s
    // of Gemini web search, so DON'T make the admin wait on them — return to the
    // list right away and let the pitches generate in the background. They land
    // on the project once ready; the save itself is instant.
    flash(editId
      ? '✅ Project updated! AI persona pitches are refreshing in the background.'
      : '✅ Project published! AI persona pitches are generating in the background.')

    setForm(EMPTY); setEditId(null); setFormLocWarning('')
    setUnitConfigs([{ ...EMPTY_UNIT }]); setQuickFillText(''); setPsfRate(''); setLandmarks([])
    loadProjects(); setSection('projects')

    // Fire-and-forget: not awaited, so the UI is already back on the projects
    // list. If the AI call fails, the project is still saved — pitches are
    // best-effort and can be regenerated by editing again.
    void (async () => {
      try {
        const personas = await generatePersonaPitches({ ...payload, usps: uspsList }, validConfigs)
        if (savedId && (personas.investor || personas.end_user)) {
          await supabase.rpc('admin_update_project_personas', {
            p_token: getSession(), p_id: savedId, p_personas: personas,
          })
          loadProjects()
        }
      } catch { /* project already saved; persona refresh is best-effort */ }
    })()
  }

  const addTeamMember = async () => {
    if (!newName || !newMobile || !newPass || !newEmail) { flash('Fill all fields, including email — it\'s needed for Forgot Password.', 'err'); return }
    const { error } = await supabase.rpc('admin_add_salesperson', {
      p_token: getSession(), p_name: newName, p_mobile: newMobile, p_email: newEmail, p_password: newPass,
    })
    if (error) { flash('Error: ' + error.message, 'err'); return }
    flash('✅ Team member added!'); setNewName(''); setNewMobile(''); setNewEmail(''); setNewPass(''); loadTeam()
  }

  const removeTeamMember = async (id: string) => {
    if (!confirm('Remove this person?')) return
    const { error } = await supabase.rpc('admin_remove_salesperson', { p_token: getSession(), p_id: id })
    if (error) { flash('Error: ' + error.message, 'err'); return }
    loadTeam()
  }

  const startEditTeam = (m: any) => {
    setEditingTeamId(m.id)
    setEditTeam({ name: m.name || '', mobile_number: m.mobile_number || '', email: m.email || '', password: '' })
  }

  const cancelEditTeam = () => { setEditingTeamId(null); setEditTeam({ name: '', mobile_number: '', email: '', password: '' }) }

  const saveEditTeam = async (id: string) => {
    if (!editTeam.name || !editTeam.mobile_number || !editTeam.email) { flash('Name, mobile and email are all required.', 'err'); return }
    // Passing an empty password tells the function to keep the current one.
    const { error } = await supabase.rpc('admin_update_salesperson', {
      p_token: getSession(),
      p_id: id,
      p_name: editTeam.name,
      p_mobile: editTeam.mobile_number,
      p_email: editTeam.email,
      p_password: editTeam.password.trim(),
    })
    if (error) { flash('Error: ' + error.message, 'err'); return }
    flash('✅ Updated!'); cancelEditTeam(); loadTeam()
  }

  const updateUnit = (idx: number, field: keyof UnitConfig, val: string) =>
    setUnitConfigs(prev => prev.map((u, i) => {
      if (i !== idx) return u
      const next = { ...u, [field]: val }
      // Editing the rate or the SBA re-derives this unit's price range.
      return (field === 'rate' || field === 'sba_min' || field === 'sba_max') ? withDerivedPrice(next) : next
    }))

  // Bulk shortcut: stamp one ₹/sqft rate onto every unit and derive each price from its SBA.
  // Per-unit rate fields can still be tweaked afterwards, so this is a starting point, not a lock.
  const applyPsfRate = () => {
    const rate = Number(psfRate)
    if (!rate || rate <= 0) { flash('Enter a valid ₹/sqft rate first (e.g. 10000).', 'err'); return }
    const eligible = unitConfigs.filter(u => Number(u.sba_min) > 0)
    if (eligible.length === 0) { flash('Add SBA Min to at least one unit — price is rate × SBA.', 'err'); return }
    setUnitConfigs(prev => prev.map(u => Number(u.sba_min) > 0 ? withDerivedPrice({ ...u, rate: String(rate) }) : u))
    const skipped = unitConfigs.length - eligible.length
    flash(`Applied ₹${rate.toLocaleString('en-IN')}/sqft to ${eligible.length} unit${eligible.length > 1 ? 's' : ''}.${skipped > 0 ? ` ${skipped} skipped (no SBA).` : ''}`)
  }
  // Expand a pasted Google Maps link (incl. short share links) to its exact pin,
  // then store the resolved URL so the project's distance checker is precise.
  const fetchExactLocation = async () => {
    const url = form.google_maps_url.trim()
    if (!url) { flash('Paste a Google Maps link first.', 'err'); return }
    setMapResolving(true); setMapPin('')
    try {
      const r = await fetch('/api/resolve-maps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await r.json()
      if (data.lat != null && data.lng != null) {
        if (data.url) setF('google_maps_url', data.url)
        setMapPin(`📍 Pinned at ${Number(data.lat).toFixed(5)}, ${Number(data.lng).toFixed(5)}`)
        flash('Exact location captured.')
      } else {
        setMapPin('⚠ Couldn\'t read coordinates — open the place in Google Maps and paste the full link (the one with @lat,lng).')
      }
    } catch {
      flash('Could not resolve the link — check the URL and try again.', 'err')
    } finally {
      setMapResolving(false)
    }
  }

  const addLandmark = () => setLandmarks(prev => [...prev, { name: '', distance: '', type: LM_TYPES[0] }])
  const updateLandmark = (idx: number, field: keyof LandmarkItem, val: string) =>
    setLandmarks(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l))
  const removeLandmark = (idx: number) => setLandmarks(prev => prev.filter((_, i) => i !== idx))

  const addUnit = () => setUnitConfigs(prev => [...prev, { ...EMPTY_UNIT }])
  const removeUnit = (idx: number) => setUnitConfigs(prev => prev.filter((_, i) => i !== idx))
  // Drag a unit row by its handle and drop it on another to reorder.
  const moveUnit = (from: number, to: number) => setUnitConfigs(prev => {
    if (from === to || from < 0 || to < 0) return prev
    const next = [...prev]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
  })

  const resetForm = () => {
    setEditId(null); setForm(EMPTY); setUnitConfigs([{ ...EMPTY_UNIT }]); setPsfRate(''); setLandmarks([])
    setFormLocWarning(''); setQuickFillText('')
    setAssets([]); setAssetKind(ASSET_KINDS[0].key); setAssetLabel(''); setAssetUrl('')
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
    <AppShell
      mainStyle={{ padding: isMobile ? 16 : 24 }}
      topBar={
        <nav style={{ background: 'var(--bg-bar)', borderBottom: '1px solid var(--border)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <BrandLogo onClick={nav.onGoHome} compact={isMobile} badge="Admin" />
        {/* Spacer pushes search and controls to the right. */}
        <div style={{ flex: 1 }} />
        {/* The panel is desktop-first; on mobile the bar has no room for search. */}
        {!isMobile && (
          <div style={{ flex: '0 1 440px', minWidth: 0, display: 'flex' }}>
            <GlobalSearch onSelectProject={onViewProject} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NotificationBell />
          <ThemeToggle />
          {/* Already in the panel, so the menu drops its Admin Panel entry here. */}
          <UserMenu user={user} groups={buildAccountMenu({ ...nav, isAdmin: user.role === 'admin', onGoAdmin: undefined })} />
        </div>
        </nav>
      }
      subBar={isMobile && (
        <div style={{ display: 'flex', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {NAV_ITEMS.map(([k, l]) => (
            <button key={k} onClick={() => { setSection(k as any); if (k !== 'add') resetForm() }}
              style={{ flexShrink: 0, padding: '12px 10px', border: 'none', fontSize: 11, cursor: 'pointer', background: 'transparent', color: section === k ? 'var(--text-muted)' : 'var(--text-faint)', borderBottom: section === k ? '2px solid #6366F1' : '2px solid transparent', fontWeight: section === k ? 600 : 400 }}>
              {l}
            </button>
          ))}
        </div>
      )}
      sidebar={!isMobile && (
        <aside style={{ width: 220, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)', padding: 16, flexShrink: 0 }}>
            {NAV_ITEMS.map(([k, l]) => (
              <button key={k} onClick={() => { setSection(k as any); if (k !== 'add') resetForm() }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', marginBottom: 6, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, background: section === k ? 'rgba(79,70,229,0.35)' : 'transparent', color: section === k ? 'var(--text-muted)' : 'var(--text-faint)' }}>
                {l}
                {k === 'projects' && <span style={{ float: 'right', background: 'rgba(79,70,229,0.4)', padding: '1px 7px', borderRadius: 10, fontSize: 11 }}>{projects.length}</span>}
                {k === 'locations' && <span style={{ float: 'right', background: 'rgba(79,70,229,0.4)', padding: '1px 7px', borderRadius: 10, fontSize: 11 }}>{locations.length}</span>}
              </button>
            ))}
          </aside>
        )}
    >
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
                <button onClick={() => { resetForm(); setSection('add') }} style={{ background: 'linear-gradient(135deg,#4F46E5,#9333EA)', border: 'none', borderRadius: 8, padding: '9px 14px', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>+ Add New</button>
              </div>
              {projects.length === 0
                ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-faint)' }}>No projects yet.</div>
                : isMobile
                  ? <div>{projects.map(p => (
                      <div key={p.id} style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.name}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>{p.developer} · {p.location}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: statusMeta(p.status).tint, color: statusMeta(p.status).text }}>{p.status || '—'}</span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => startEdit(p)} style={{ background: 'var(--border-strong)', border: 'none', borderRadius: 6, padding: '5px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>Edit</button>
                            <button onClick={() => handleDelete(p.id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 6, padding: '5px 12px', color: '#F87171', cursor: 'pointer', fontSize: 13 }}>Del</button>
                          </div>
                        </div>
                      </div>
                    ))}</div>
                  : <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                          <tr style={{ background: 'var(--border)' }}>
                            {['Project','Developer','Location','Status','Price Range','Actions'].map(h => (
                              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {projects.map(p => (
                            <tr key={p.id} style={{ borderTop: '1px solid rgba(79,70,229,0.12)' }}>
                              <td style={{ padding: '13px 16px', fontWeight: 600 }}>{p.name}</td>
                              <td style={{ padding: '13px 16px', color: 'var(--text-dim)' }}>{p.developer}</td>
                              <td style={{ padding: '13px 16px', color: 'var(--text-dim)' }}>{p.location}</td>
                              <td style={{ padding: '13px 16px' }}>
                                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: statusMeta(p.status).tint, color: statusMeta(p.status).text }}>{p.status || '—'}</span>
                              </td>
                              <td style={{ padding: '13px 16px', color: 'var(--text-muted)' }}>{formatPrice(p.price_min)} – {formatPrice(p.price_max)}</td>
                              <td style={{ padding: '13px 16px' }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button onClick={() => startEdit(p)} style={{ background: 'var(--border-strong)', border: 'none', borderRadius: 6, padding: '5px 14px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>Edit</button>
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
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-bright)', marginBottom: 4 }}>🪄 Quick Fill with AI</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
                  Paste WhatsApp forwards, website copy, or any project text — or upload a brochure PDF and its text is pulled out here. AI then fills all fields below.
                </div>

                {/* Upload files — text is extracted locally (PDF/PPT/Word/image)
                    and only the text goes to the AI, so files never touch Gemini. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.5)', borderRadius: 8, padding: '8px 14px', cursor: extractingFiles ? 'default' : 'pointer', color: 'var(--accent-bright)', fontSize: 13, fontWeight: 600 }}>
                    {extractingFiles ? '⏳ Reading…' : '📎 Upload files (PDF, PPT, Word, image…)'}
                    <input type="file" accept=".pdf,.pptx,.docx,.txt,.csv,image/*,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple style={{ display: 'none' }} onChange={handleBrochureUpload} disabled={extractingFiles} />
                  </label>
                  {extractStatus && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{extractStatus}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-fainter)', marginBottom: 10 }}>PDF, PowerPoint, Word, images or text. Each file's text lands in the box below — upload several, then click Extract &amp; Fill once to read them all together.</div>

                <textarea
                  value={quickFillText}
                  onChange={e => setQuickFillText(e.target.value)}
                  placeholder={`Paste everything here, or upload a brochure PDF above — WhatsApp forward, brochure text, pricing table, any raw project info...\n\nExample:\n"Project: Bhartiya Garden Estate Nikoo 7\nLocation: Sadahalli opposite Prestige Tech Cloud\n2BHK starting ₹85L, Villa ₹5.79Cr...\nKIAL Airport 8km, Metro 4km..."`}
                  rows={7}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, fontSize: 13 }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    onClick={extractWithAI}
                    disabled={generatingFill || !quickFillText.trim()}
                    style={{ background: 'linear-gradient(135deg,#7C3AED,#9333EA)', border: 'none', borderRadius: 8, padding: '10px 22px', color: '#FFFFFF', fontWeight: 700, cursor: generatingFill || !quickFillText.trim() ? 'default' : 'pointer', fontSize: 14, opacity: !quickFillText.trim() ? 0.5 : 1 }}>
                    {generatingFill ? '⏳ Extracting fields…' : '🪄 Extract & Fill All Fields'}
                  </button>
                </div>
              </div>

              {/* ① BASIC INFO */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 16 }}>① Basic Information</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                  <div><label style={lbl}>Project Name *</label><input id="f-name" style={inpErr('name')} value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. Bhartiya Garden Estate Nikoo 7" /></div>
                  <div><label style={lbl}>Developer *</label><input id="f-developer" style={inpErr('developer')} value={form.developer} onChange={e => setF('developer', e.target.value)} placeholder="e.g. Bhartiya City Developers" /></div>
                  <div>
                    <label style={lbl}>Location *</label>
                    <input id="f-location" list="loc-suggestions" style={inpErr('location')} value={form.location} onChange={e => handleLocationInput(e.target.value)} placeholder="Type or pick a location..." />
                    <datalist id="loc-suggestions">{locations.map(l => <option key={l.id} value={l.name} />)}</datalist>
                    {formLocWarning && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        ⚠ {formLocWarning}
                        <button onClick={useExistingLocation} style={{ fontSize: 11, background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 4, padding: '2px 8px', color: '#F59E0B', cursor: 'pointer' }}>Use existing</button>
                      </div>
                    )}
                  </div>
                  <div><label style={lbl}>RERA Number *</label><input id="f-rera_number" style={inpErr('rera_number')} value={form.rera_number} onChange={e => setF('rera_number', e.target.value)} placeholder='RERA no. — or "NA"' /></div>
                  <div>
                    <label style={lbl}>Status *</label>
                    <select
                      id="f-status"
                      style={inpErr('status')}
                      value={form.status}
                      onChange={e => {
                        const next = e.target.value
                        setF('status', next)
                        // Pre-launch/resale have no RERA — auto-fill "NA" if blank.
                        if (RERA_NA_STATUSES.includes(next) && !form.rera_number.trim()) setF('rera_number', 'NA')
                      }}
                    >
                      {/* Keep any legacy value selectable until the backfill runs. */}
                      {(PROJECT_STATUSES as readonly string[]).includes(form.status)
                        ? null
                        : <option style={{ background: 'var(--bg-raised)' }}>{form.status}</option>}
                      {PROJECT_STATUSES.map(s => (
                        <option key={s} style={{ background: 'var(--bg-raised)' }}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div><label style={lbl}>Possession Date *</label><input id="f-possession_date" style={inpErr('possession_date')} value={form.possession_date} onChange={e => setF('possession_date', e.target.value)} placeholder="e.g. Dec 2026 · 2040 if unknown" /></div>
                </div>
              </div>

              {/* ② UNIT CONFIGS */}
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>② Unit Types, Pricing & Super Built-Up Area</div>
                  <button onClick={addUnit} style={{ background: 'var(--border-strong)', border: '1px solid rgba(79,70,229,0.4)', borderRadius: 6, padding: '5px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>+ Add Unit Type</button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 14 }}>
                  Enter prices in ₹ (e.g. 4900000 = ₹49L · 10000000 = ₹1Cr · 57900000 = ₹5.79Cr) · SBA = Super Built-Up Area in sqft
                </div>
                {/* Project rate — one ₹/sqft that derives every unit's price range (Bangalore = SBA × rate). */}
                <div style={{ background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.35)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>💰 Price per sq.ft (this project)</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10 }}>
                    Enter one ₹/sqft rate — each unit's price fills as <b>SBA × rate</b> (e.g. 600–700 sqft @ ₹13,000 → ₹78L–₹91L). Prices stay editable below.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>₹</span>
                      <input type="number" value={psfRate} onChange={e => setPsfRate(e.target.value)} placeholder="13000"
                        style={{ ...inp, width: 130, fontSize: 16, fontWeight: 600 }} />
                      <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>/sqft</span>
                    </div>
                    <button onClick={applyPsfRate}
                      style={{ background: 'linear-gradient(135deg,#4F46E5,#9333EA)', border: 'none', borderRadius: 6, padding: '9px 18px', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                      Apply to all units
                    </button>
                  </div>
                </div>
                {unitConfigs.length > 1 && (
                  <div style={{ fontSize: 11, color: 'var(--text-fainter)', marginBottom: 8 }}>Drag the ⠿ handle to reorder — the first unit shows as the project's starting configuration.</div>
                )}
                {unitConfigs.map((u, idx) => (
                  <div key={idx}
                    onDragOver={e => { if (dragUnit !== null) { e.preventDefault(); setDragOverUnit(idx) } }}
                    onDragLeave={() => setDragOverUnit(d => (d === idx ? null : d))}
                    onDrop={() => { if (dragUnit !== null) moveUnit(dragUnit, idx); setDragUnit(null); setDragOverUnit(null) }}
                    style={{ background: 'var(--bg-inset)', border: `1px solid ${dragOverUnit === idx && dragUnit !== idx ? '#6366F1' : 'rgba(79,70,229,0.15)'}`, borderRadius: 8, padding: 12, marginBottom: 10, opacity: dragUnit === idx ? 0.4 : 1, transition: 'opacity 0.12s' }}>
                    {unitConfigs.length > 1 && (
                      <div draggable
                        onDragStart={() => setDragUnit(idx)}
                        onDragEnd={() => { setDragUnit(null); setDragOverUnit(null) }}
                        title="Drag to reorder"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'grab', marginBottom: 8, color: 'var(--text-faint)', fontSize: 12, userSelect: 'none' }}>
                        <span style={{ fontSize: 16, letterSpacing: -2 }}>⠿</span>
                        <span>Unit {idx + 1}{idx === 0 ? ' · starting config' : ''}</span>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1.1fr 0.85fr 0.85fr 1fr 1fr 0.7fr 36px', gap: 8, alignItems: 'end' }}>
                      <div>
                        <label style={lbl}>Unit Type *</label>
                        <select style={inp} value={u.type} onChange={e => updateUnit(idx, 'type', e.target.value)}>
                          <option value="" style={{ background: 'var(--bg-raised)' }}>Select type</option>
                          {UNIT_TYPES.map(t => <option key={t} value={t} style={{ background: 'var(--bg-raised)' }}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>SBA Min (sqft)</label>
                        <input style={inp} type="number" value={u.sba_min} onChange={e => updateUnit(idx, 'sba_min', e.target.value)} placeholder="650" />
                      </div>
                      <div>
                        <label style={lbl}>SBA Max (sqft)</label>
                        <input style={inp} type="number" value={u.sba_max} onChange={e => updateUnit(idx, 'sba_max', e.target.value)} placeholder="1200" />
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
                        <label style={lbl}>Units left</label>
                        <input style={inp} type="number" min="0" value={u.units_left} onChange={e => updateUnit(idx, 'units_left', e.target.value)} placeholder="—" title="Leave blank if not tracking availability; 0 = sold out" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 1 }}>
                        {unitConfigs.length > 1 && (
                          <button onClick={() => removeUnit(idx)} style={{ background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 6, width: 32, height: 36, color: '#F87171', cursor: 'pointer', fontSize: 14 }}>✕</button>
                        )}
                      </div>
                    </div>
                    {u.price_min && (
                      <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>
                        → {u.type || 'Unit'}: {formatPrice(Number(u.price_min))}{u.price_max && u.price_max !== u.price_min ? `–${formatPrice(Number(u.price_max))}` : ''}
                        {u.sba_min ? ` · ${u.sba_min}${u.sba_max && u.sba_max !== u.sba_min ? `–${u.sba_max}` : ''} sqft SBA` : ''}
                        {Number(u.rate) > 0 ? ` · ₹${Number(u.rate).toLocaleString('en-IN')}/sqft` : ''}
                        {u.units_left.trim() !== '' ? ` · ${Number(u.units_left) === 0 ? 'Sold out' : `${u.units_left} left`}` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* ③ KEY HIGHLIGHTS */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 16 }}>③ Key Highlights</div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>④ Nearby Landmarks</div>
                  <button onClick={addLandmark} style={{ background: 'var(--border-strong)', border: '1px solid rgba(79,70,229,0.4)', borderRadius: 6, padding: '5px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>+ Add Landmark</button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 14 }}>
                  Add as many as you like — grouped by type on the project page. Distance drives an auto-estimated drive time (e.g. "8 km" → ~16 min).
                </div>
                {landmarks.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-fainter)', padding: '4px 0 8px' }}>No landmarks yet — click <b>+ Add Landmark</b>.</div>
                )}
                {landmarks.map((lm, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 0.6fr' : '1fr 0.55fr 0.75fr 36px', gap: 10, marginBottom: 10, alignItems: 'end' }}>
                    <div><label style={lbl}>Landmark {idx + 1}</label><input style={inp} value={lm.name} onChange={e => updateLandmark(idx, 'name', e.target.value)} placeholder="e.g. Kempegowda Airport" /></div>
                    <div><label style={lbl}>Distance</label><input style={inp} value={lm.distance} onChange={e => updateLandmark(idx, 'distance', e.target.value)} placeholder="8 km" /></div>
                    {!isMobile && (
                      <div><label style={lbl}>Type</label>
                        <select style={inp} value={lm.type} onChange={e => updateLandmark(idx, 'type', e.target.value)}>
                          {LM_TYPES.map(t => <option key={t} style={{ background: 'var(--bg-raised)' }}>{t}</option>)}
                        </select>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 1 }}>
                      <button onClick={() => removeLandmark(idx)} style={{ background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 6, width: 32, height: 36, color: '#F87171', cursor: 'pointer', fontSize: 14 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ⑤ IMAGE & MAP */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 16 }}>⑤ Image & Map</div>
                {/* Upload button */}
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Project Image</label>
                  {form.image_url ? (
                    <div>
                      <img src={form.image_url} alt="preview" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, marginBottom: 10, display: 'block' }} />
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <label style={{ cursor: 'pointer', background: 'var(--border)', border: '1px solid rgba(79,70,229,0.4)', borderRadius: 7, padding: '7px 14px', color: 'var(--text-muted)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          📷 Change Image
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploadingImage} />
                        </label>
                        <button onClick={() => setF('image_url', '')} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 7, padding: '7px 14px', color: '#F87171', cursor: 'pointer', fontSize: 13 }}>✕ Remove</button>
                        {uploadingImage && <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>⏳ Uploading...</span>}
                      </div>
                    </div>
                  ) : (
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, borderRadius: 10, border: '2px dashed rgba(79,70,229,0.35)', cursor: uploadingImage ? 'default' : 'pointer', color: 'var(--text-faint)', gap: 8, marginBottom: 8, background: 'rgba(79,70,229,0.04)' }}>
                      {uploadingImage
                        ? <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Uploading...</span>
                        : <><span style={{ fontSize: 36 }}>📷</span><span style={{ fontSize: 13 }}>Click to upload project image</span><span style={{ fontSize: 11 }}>JPG · PNG · WEBP — max 5MB</span></>
                      }
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploadingImage} />
                    </label>
                  )}
                  <label style={{ fontSize: 11, color: 'var(--text-fainter)', display: 'block', marginBottom: 4 }}>Or paste image URL directly</label>
                  <input style={{ ...inp, fontSize: 12 }} value={form.image_url} onChange={e => setF('image_url', e.target.value)} placeholder="https://images.unsplash.com/..." />
                </div>
                <div>
                  <label style={lbl}>Google Maps location link</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...inp, flex: 1 }} value={form.google_maps_url} onChange={e => { setF('google_maps_url', e.target.value); setMapPin('') }} placeholder="Paste any Google Maps link — place or share link" />
                    <button onClick={fetchExactLocation} disabled={mapResolving || !form.google_maps_url.trim()}
                      style={{ background: form.google_maps_url.trim() ? 'linear-gradient(135deg,#4F46E5,#9333EA)' : 'var(--border)', border: 'none', borderRadius: 8, padding: '0 16px', color: form.google_maps_url.trim() ? '#fff' : 'var(--text-faint)', fontWeight: 600, cursor: mapResolving || !form.google_maps_url.trim() ? 'default' : 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {mapResolving ? '⏳ Fetching…' : '📍 Fetch exact location'}
                    </button>
                  </div>
                  {mapPin
                    ? <div style={{ fontSize: 11, color: mapPin.startsWith('📍') ? '#10B981' : '#F59E0B', marginTop: 6 }}>{mapPin}</div>
                    : <div style={{ fontSize: 11, color: 'var(--text-fainter)', marginTop: 5 }}>Paste the project's Google Maps link, then Fetch to capture its exact coordinates — used for accurate on-call distances. Short share links (maps.app.goo.gl) work too.</div>}
                </div>
              </div>

              {/* ⑤b ASSETS & BROCHURES */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>📎 Assets & Brochures</div>
                {!editId ? (
                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Save the project first, then reopen it to attach brochures, plans, gallery and video links.</div>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-fainter)', marginBottom: 12 }}>
                      Upload a PDF/image or paste a link (e.g. a YouTube walkthrough). These appear on the project page and in the WhatsApp "details" message. Nothing is required.
                    </div>

                    {/* Existing assets */}
                    {assets.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        {assets.map(a => (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6 }}>
                            <span style={{ flexShrink: 0 }}>{assetKindMeta(a.kind).emoji}</span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{a.label}</div>
                              <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.url}</a>
                            </div>
                            <button onClick={() => removeAsset(a.id)} style={{ flexShrink: 0, background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 6, padding: '5px 10px', color: '#F87171', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new asset */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.9fr 1.1fr', gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={lbl}>Section</label>
                        <select style={inp} value={assetKind} onChange={e => setAssetKind(e.target.value)}>
                          {ASSET_KINDS.map(k => <option key={k.key} value={k.key} style={{ background: 'var(--bg-raised)' }}>{k.emoji} {k.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Label (shown to client)</label>
                        <input style={inp} value={assetLabel} onChange={e => setAssetLabel(e.target.value)} placeholder={assetKindMeta(assetKind).label} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(79,70,229,0.15)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '8px 14px', cursor: uploadingAsset ? 'default' : 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
                        {uploadingAsset ? `⏳ Uploading… ${assetProgress}%` : '⬆ Upload PDF / image / video'}
                        <input type="file" accept=".pdf,image/*,video/*" style={{ display: 'none' }} onChange={handleAssetUpload} disabled={uploadingAsset} />
                      </label>
                      <span style={{ fontSize: 12, color: 'var(--text-fainter)' }}>or</span>
                      <input style={{ ...inp, flex: 1, minWidth: 180 }} value={assetUrl} onChange={e => setAssetUrl(e.target.value)} placeholder="paste a link (YouTube, Drive, …)" />
                    </div>

                    {/* Upload progress */}
                    {uploadingAsset && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ height: 8, borderRadius: 999, background: 'rgba(79,70,229,0.15)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${assetProgress}%`, background: 'linear-gradient(90deg,#4F46E5,#9333EA)', transition: 'width 0.15s' }} />
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
                          {assetProgress}% uploaded{assetProgress < 100 ? ` · ${100 - assetProgress}% left` : ' · finishing…'}
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-fainter)', marginBottom: 8 }}>Up to 250MB. Videos are large — a YouTube/Drive link is usually better than an upload.</div>
                    <button onClick={addAsset} disabled={!assetUrl.trim() || uploadingAsset}
                      style={{ background: 'linear-gradient(135deg,#4F46E5,#9333EA)', border: 'none', borderRadius: 8, padding: '8px 18px', color: '#FFFFFF', fontWeight: 600, cursor: assetUrl.trim() && !uploadingAsset ? 'pointer' : 'default', fontSize: 13, opacity: assetUrl.trim() && !uploadingAsset ? 1 : 0.5 }}>
                      + Add asset
                    </button>
                  </>
                )}
              </div>

              {/* ⑥ PITCH SCRIPT */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>⑥ General Pitch Script</span>
                  <button onClick={generatePitchScript} disabled={generatingScript || !form.name}
                    style={{ background: 'linear-gradient(135deg,#4F46E5,#9333EA)', border: 'none', borderRadius: 7, padding: '6px 14px', color: '#FFFFFF', fontSize: 12, fontWeight: 600, cursor: generatingScript || !form.name ? 'default' : 'pointer', opacity: !form.name ? 0.4 : 1 }}>
                    {generatingScript ? '⏳ Generating…' : '✨ Generate with AI'}
                  </button>
                </div>
                <textarea
                  style={{ ...inp, height: 110, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7 }}
                  value={form.pitch_script} onChange={e => setF('pitch_script', e.target.value)}
                  placeholder="Write manually or click ✨ Generate with AI above…" />
                <div style={{ fontSize: 11, color: 'var(--text-fainter)', marginTop: 4 }}>
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
                <button onClick={save} disabled={saving}
                  style={{ background: 'linear-gradient(135deg,#4F46E5,#9333EA)', border: 'none', borderRadius: 8, padding: '12px 28px', color: '#FFFFFF', fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontSize: 15, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : editId ? '✅ Update' : '🚀 Publish'}
                </button>
                <button onClick={() => { resetForm(); setSection('projects') }}
                  style={{ background: 'transparent', border: '1px solid rgba(165,180,252,0.3)', borderRadius: 8, padding: '12px 20px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ═══ LOCATIONS ════════════════════════════════════════════════════ */}
          {section === 'locations' && (
            <div>
              <h2 style={{ fontSize: isMobile ? 17 : 20, marginBottom: 6 }}>📍 Locations ({locations.length})</h2>
              <p style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 20 }}>Locations here appear in the salesperson filter. Only unused locations can be deleted.</p>
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14 }}>Add New Location</div>
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
                    style={{ background: 'linear-gradient(135deg,#4F46E5,#9333EA)', border: 'none', borderRadius: 8, padding: '10px 20px', color: '#FFFFFF', fontWeight: 600, cursor: canAddLoc ? 'pointer' : 'default', fontSize: 14, opacity: canAddLoc ? 1 : 0.4, whiteSpace: 'nowrap' }}>
                    + Add Location
                  </button>
                </div>
                {/* Zone assignment. Optional — an unzoned area still shows under
                    "All Bangalore" for salespeople, it just sits under no zone. */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Bangalore zone(s) — pick one, or two for a border area</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ZONES.map((z) => {
                      const on = newLocZones.includes(z)
                      return (
                        <button key={z} type="button"
                          onClick={() => setNewLocZones((p) => (on ? p.filter((x) => x !== z) : [...p, z]))}
                          style={{ padding: '4px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid', borderColor: on ? '#6366F1' : 'var(--border-strong)', background: on ? 'rgba(99,102,241,0.3)' : 'transparent', color: on ? 'var(--text-muted)' : 'var(--text-faint)' }}>
                          {z}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-fainter)', marginTop: 10 }}>💡 Use full names — "Sarjapur Road" not "Sarj Rd".</div>
              </div>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: 'var(--border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Location</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Zones <span style={{ fontWeight: 400, color: 'var(--text-fainter)' }}>(click to toggle)</span></th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Projects</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map(loc => {
                      const count = locationCounts[loc.name] || 0
                      return (
                        <tr key={loc.id} style={{ borderTop: '1px solid rgba(79,70,229,0.12)' }}>
                          <td style={{ padding: '13px 16px', fontWeight: 500 }}>{loc.name}</td>
                          <td style={{ padding: '13px 16px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {ZONES.map((z) => {
                                const on = loc.zones.includes(z)
                                return (
                                  <button key={z} type="button"
                                    onClick={() => setLocationZones(loc.id, on ? loc.zones.filter((x) => x !== z) : [...loc.zones, z])}
                                    title={on ? `Remove ${z}` : `Add ${z}`}
                                    style={{ padding: '2px 9px', borderRadius: 12, fontSize: 11, cursor: 'pointer', border: '1px solid', borderColor: on ? '#6366F1' : 'var(--border-strong)', background: on ? 'rgba(99,102,241,0.3)' : 'transparent', color: on ? 'var(--text-muted)' : 'var(--text-fainter)' }}>
                                    {z}
                                  </button>
                                )
                              })}
                            </div>
                          </td>
                          <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                            {count > 0
                              ? <span style={{ background: 'rgba(99,102,241,0.2)', color: 'var(--text-muted)', padding: '2px 10px', borderRadius: 12, fontSize: 12 }}>{count} project{count > 1 ? 's' : ''}</span>
                              : <span style={{ color: 'var(--text-fainter)', fontSize: 12 }}>—</span>}
                          </td>
                          <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                            {count > 0
                              ? <span style={{ fontSize: 12, color: 'var(--text-fainter)' }}>🔒 In use</span>
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
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 16 }}>Add New Salesperson</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div><label style={lbl}>Name</label><input style={inp} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Rahul S." /></div>
                  <div><label style={lbl}>Mobile</label><input style={inp} value={newMobile} onChange={e => setNewMobile(e.target.value)} placeholder="9902700565" /></div>
                  <div><label style={lbl}>Email *</label><input style={inp} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="rahul@example.com" /></div>
                  <div><label style={lbl}>Password</label><input style={inp} type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Set password" /></div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-fainter)', marginBottom: 10 }}>* Email is required — it's how Forgot Password reset links get sent.</div>
                <button onClick={addTeamMember} style={{ background: 'linear-gradient(135deg,#4F46E5,#9333EA)', border: 'none', borderRadius: 7, padding: '10px 22px', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>+ Add Salesperson</button>
              </div>
              <div>
                {team.map(m => (
                  <div key={m.id} style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 10 }}>
                    {editingTeamId === m.id ? (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                          <div><label style={lbl}>Name</label><input style={inp} value={editTeam.name} onChange={e => setEditTeam(t => ({ ...t, name: e.target.value }))} /></div>
                          <div><label style={lbl}>Mobile</label><input style={inp} value={editTeam.mobile_number} onChange={e => setEditTeam(t => ({ ...t, mobile_number: e.target.value }))} /></div>
                          <div><label style={lbl}>Email</label><input style={inp} type="email" value={editTeam.email} onChange={e => setEditTeam(t => ({ ...t, email: e.target.value }))} /></div>
                          <div><label style={lbl}>New Password</label><input style={inp} type="password" value={editTeam.password} onChange={e => setEditTeam(t => ({ ...t, password: e.target.value }))} placeholder="Leave blank to keep current" /></div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => saveEditTeam(m.id)} style={{ background: 'linear-gradient(135deg,#4F46E5,#9333EA)', border: 'none', borderRadius: 6, padding: '7px 16px', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Save</button>
                          <button onClick={cancelEditTeam} style={{ background: 'transparent', border: '1px solid rgba(165,180,252,0.3)', borderRadius: 6, padding: '7px 16px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{m.mobile_number}</div>
                          {m.email
                            ? <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{m.email}</div>
                            : <div style={{ fontSize: 12, color: '#F59E0B', marginTop: 2 }}>⚠ No email — Forgot Password won't work until this is added</div>}
                          <span style={{ background: m.role === 'admin' ? 'rgba(147,51,234,0.25)' : 'var(--border)', color: m.role === 'admin' ? 'var(--accent-bright)' : 'var(--text-muted)', fontSize: 11, padding: '2px 9px', borderRadius: 10, marginTop: 4, display: 'inline-block' }}>{m.role}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => startEditTeam(m)} style={{ background: 'var(--border-strong)', border: 'none', borderRadius: 5, padding: '6px 14px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>Edit</button>
                          {m.role !== 'admin' && (
                            <button onClick={() => removeTeamMember(m.id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 5, padding: '6px 14px', color: '#F87171', cursor: 'pointer', fontSize: 13 }}>Remove</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

    </AppShell>
  )
}
