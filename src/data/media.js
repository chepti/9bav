// Helpers to turn a stored media item into displayable URLs.
// In live mode files live on Google Drive (item.driveId); in the offline
// prototype item.url is a data-URL. These helpers hide that difference.
// YouTube links are stored as the original URL in item.url and embedded via iframe.

/** Extract an 11-char YouTube video id from a watch/share/embed/shorts URL. */
export function youtubeIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null
  const raw = url.trim()
  if (/^[\w-]{11}$/.test(raw)) return raw
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]?.split('?')[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = parsed.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
      const m = parsed.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/)
      if (m) return m[1]
    }
  } catch {
    /* not a URL */
  }
  return null
}

/** Extract a Google Drive file id from common share / view / uc links. */
export function driveIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null
  const raw = url.trim()
  // Bare id (Drive ids are typically 25–44 chars, URL-safe)
  if (/^[\w-]{20,}$/.test(raw) && !raw.includes('/') && !raw.includes('.')) return raw
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'drive.google.com' || host === 'docs.google.com') {
      const m = parsed.pathname.match(/\/(?:file\/d|uc|open|d)\/([\w-]{20,})/)
      if (m) return m[1]
      const id = parsed.searchParams.get('id')
      if (id && /^[\w-]{20,}$/.test(id)) return id
    }
    if (host === 'lh3.googleusercontent.com') {
      const m = parsed.pathname.match(/\/d\/([\w-]{20,})/)
      if (m) return m[1]
    }
  } catch {
    /* not a URL */
  }
  return null
}

export function imageSrc(item) {
  const id = item?.driveId || driveIdFromUrl(item?.url)
  if (id) return `https://lh3.googleusercontent.com/d/${id}`
  return item?.url || ''
}

export function videoEmbed(item) {
  const yt = youtubeIdFromUrl(item?.url)
  if (yt) return `https://www.youtube.com/embed/${yt}`
  const id = item?.driveId || driveIdFromUrl(item?.url)
  if (id) return `https://drive.google.com/file/d/${id}/preview`
  return null // data-URL videos use a plain <video src>
}

export function fileLink(item) {
  if (youtubeIdFromUrl(item?.url)) return item.url
  const id = item?.driveId || driveIdFromUrl(item?.url)
  if (id) return `https://drive.google.com/file/d/${id}/view`
  return item?.url || ''
}
