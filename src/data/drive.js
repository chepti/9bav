// Media upload to the owner's Google Drive via a Google Apps Script Web App.
// This keeps heavy media off Hostinger and off Firebase (Firestore only stores
// the returned link). The Apps Script code + deploy steps are in
// docs/apps-script-drive.gs and SETUP.md.
//
// The endpoint URL comes from VITE_DRIVE_ENDPOINT. We POST with a "simple"
// content-type (text/plain) so the browser skips the CORS preflight; the Apps
// Script response is served with Access-Control-Allow-Origin and is readable.

const ENDPOINT = import.meta.env.VITE_DRIVE_ENDPOINT || ''

export const isDriveConfigured = Boolean(ENDPOINT)

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = String(reader.result)
      const comma = res.indexOf(',')
      resolve(comma >= 0 ? res.slice(comma + 1) : res)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Uploads a File to Drive and returns { url, id, name, mimeType, size }.
 * Throws if the endpoint is not configured or the upload fails.
 */
export async function uploadToDrive(file) {
  if (!ENDPOINT) throw new Error('Drive endpoint not configured')
  const dataBase64 = await fileToBase64(file)
  const payload = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    dataBase64,
  }
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    // text/plain => no CORS preflight; Apps Script parses the body itself
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  })
  if (!resp.ok) throw new Error(`Drive upload failed: ${resp.status}`)
  const data = await resp.json()
  if (data.error) throw new Error(data.error)
  return {
    url: data.url,
    id: data.id,
    name: data.name || file.name,
    mimeType: file.type,
    size: file.size,
  }
}

export const HEAVY_BYTES = 1024 * 1024 // 1 MB threshold mentioned by the owner
