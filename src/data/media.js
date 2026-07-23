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

export function imageSrc(item) {
  if (item.driveId) return `https://lh3.googleusercontent.com/d/${item.driveId}`
  return item.url || ''
}

export function videoEmbed(item) {
  const yt = youtubeIdFromUrl(item?.url)
  if (yt) return `https://www.youtube.com/embed/${yt}`
  if (item.driveId) return `https://drive.google.com/file/d/${item.driveId}/preview`
  return null // data-URL videos use a plain <video src>
}

export function fileLink(item) {
  if (youtubeIdFromUrl(item?.url)) return item.url
  return item.url || (item.driveId ? `https://drive.google.com/file/d/${item.driveId}/view` : '')
}
