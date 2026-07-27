// ─── Upload with progress ───────────────────────────────────────────────────
// The supabase-js storage client can't report upload progress (it's fetch-based),
// so for the asset uploads — which can be large PDFs/videos — we POST straight to
// the Storage REST endpoint with XHR, whose upload.onprogress drives the bar.
// Same bucket and anon key the client uses, so the bucket's insert policy applies
// exactly as before.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface UploadResult {
  publicUrl: string
}

export function uploadFileWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const encoded = path.split('/').map(encodeURIComponent).join('/')
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${encoded}`)
    xhr.setRequestHeader('apikey', SUPABASE_KEY)
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_KEY}`)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('cache-control', '3600')
    xhr.setRequestHeader('x-upsert', 'false')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encoded}` })
      } else {
        let msg = `Upload failed (${xhr.status})`
        try { msg = JSON.parse(xhr.responseText)?.message || msg } catch { /* keep default */ }
        reject(new Error(msg))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(file)
  })
}
