// Helpers to turn a stored media item into displayable URLs.
// In live mode files live on Google Drive (item.driveId); in the offline
// prototype item.url is a data-URL. These helpers hide that difference.

export function imageSrc(item) {
  if (item.driveId) return `https://lh3.googleusercontent.com/d/${item.driveId}`
  return item.url || ''
}

export function videoEmbed(item) {
  if (item.driveId) return `https://drive.google.com/file/d/${item.driveId}/preview`
  return null // data-URL videos use a plain <video src>
}

export function fileLink(item) {
  return item.url || (item.driveId ? `https://drive.google.com/file/d/${item.driveId}/view` : '')
}
