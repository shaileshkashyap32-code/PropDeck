import * as pdfjsLib from 'pdfjs-dist'
import PdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// ─── Local text extraction ──────────────────────────────────────────────────
// Pulls the text out of an uploaded PDF in the browser, so only that text goes
// to Gemini — never the (large) file itself. That keeps the AI call small and
// on the free tier. Digital builder brochures carry a real text layer, which is
// what this reads; a purely scanned/image PDF has no text and would need OCR
// (see the note in the admin panel).

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorkerUrl

export async function extractPdfText(file: File): Promise<string> {
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '))
  }
  return pages.join('\n').replace(/[ \t]+\n/g, '\n').trim()
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}
