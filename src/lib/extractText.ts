import * as pdfjsLib from 'pdfjs-dist'
import PdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// ─── Local text extraction ──────────────────────────────────────────────────
// Pulls text out of an uploaded file in the browser, so only the text goes to
// Gemini — never the (large) file itself. That keeps the AI call small and on
// the free tier.
//
//   PDF          → pdf.js reads the text layer
//   PPTX / DOCX  → unzip (they're zip archives of XML) and read the text nodes
//   TXT / CSV    → read as-is
//   images       → OCR via tesseract.js (lazy-loaded; heavier, slower)
//
// Old binary .ppt/.doc and scanned/image-only PDFs have no readable text layer;
// those are reported so the admin knows to use an image/OCR instead.

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorkerUrl

export interface ExtractResult {
  text: string
  /** True when the file type is understood but no text came out (e.g. scanned PDF). */
  empty: boolean
}

type OnStatus = (msg: string) => void

async function extractPdfText(file: File): Promise<string> {
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '))
  }
  return pages.join('\n')
}

// PPTX/DOCX are zip archives of XML. Pull the text runs out of the slide/body
// XML. `<a:t>` is a PowerPoint text run, `<w:t>` a Word one.
async function extractOfficeText(file: File, kind: 'pptx' | 'docx'): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const tag = kind === 'pptx' ? 'a:t' : 'w:t'
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'g')

  const names = Object.keys(zip.files)
    .filter((n) => (kind === 'pptx' ? /^ppt\/slides\/slide\d+\.xml$/.test(n) : n === 'word/document.xml'))
    // slide2 before slide10
    .sort((a, b) => (parseInt(a.replace(/\D/g, '') || '0') - parseInt(b.replace(/\D/g, '') || '0')))

  const chunks: string[] = []
  for (const name of names) {
    const xml = await zip.files[name].async('string')
    let m: RegExpExecArray | null
    const parts: string[] = []
    while ((m = re.exec(xml)) !== null) parts.push(m[1])
    if (parts.length) chunks.push(parts.join(' '))
  }
  return chunks.join('\n')
}

async function extractImageText(file: File, onStatus?: OnStatus): Promise<string> {
  onStatus?.('Loading text recogniser…')
  const Tesseract = await import('tesseract.js')
  const { data } = await Tesseract.recognize(file, 'eng', {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === 'recognizing text') onStatus?.(`Reading image… ${Math.round((m.progress ?? 0) * 100)}%`)
    },
  })
  return data.text
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

const nameHas = (f: File, ext: string) => new RegExp(`\\.${ext}$`, 'i').test(f.name)

export async function extractFileText(file: File, onStatus?: OnStatus): Promise<ExtractResult> {
  const type = file.type
  let text = ''

  if (type === 'application/pdf' || nameHas(file, 'pdf')) {
    text = await extractPdfText(file)
  } else if (type.includes('presentationml') || nameHas(file, 'pptx')) {
    text = await extractOfficeText(file, 'pptx')
  } else if (type.includes('wordprocessingml') || nameHas(file, 'docx')) {
    text = await extractOfficeText(file, 'docx')
  } else if (type.startsWith('text/') || nameHas(file, 'txt') || nameHas(file, 'csv')) {
    text = await file.text()
  } else if (type.startsWith('image/')) {
    text = await extractImageText(file, onStatus)
  } else if (nameHas(file, 'ppt') || nameHas(file, 'doc')) {
    throw new Error('Old .ppt/.doc format — please save as .pptx/.docx or PDF.')
  } else {
    throw new Error('Unsupported file. Use PDF, PPTX, DOCX, an image, or text.')
  }

  text = decodeEntities(text).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return { text, empty: text.length < 20 }
}
