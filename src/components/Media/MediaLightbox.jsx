import { useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { IconClose, IconChevron, IconChevronLeft, IconHeart, IconHeartFilled } from '../ui/Icons.jsx'
import { imageSrc, videoEmbed, fileLink } from '../../data/media.js'

export function canOpenLightbox(item) {
  if (!item) return false
  if (item.type === 'photo' && (item.url || item.driveId)) return true
  if (item.type === 'video' && (item.url || item.driveId)) return true
  if (item.type === 'text' && item.body) return true
  if (item.type === 'document' && (item.url || item.driveId)) return true
  return false
}

export default function MediaLightbox({
  items = [],
  currentId = null,
  onClose,
  onNavigate,
  hearted = false,
  heartCount = 0,
  onHeart,
}) {
  const list = items.filter(canOpenLightbox)
  const idx = list.findIndex((m) => m.id === currentId)
  const item = idx >= 0 ? list[idx] : null
  const open = !!item

  const go = useCallback(
    (dir) => {
      if (!list.length || idx < 0) return
      const next = list[(idx + dir + list.length) % list.length]
      onNavigate?.(next.id)
    },
    [list, idx, onNavigate],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'ArrowRight') go(-1) // RTL: right = previous in visual order
      if (e.key === 'ArrowLeft') go(1)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose, go])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="lightbox-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <button type="button" className="lightbox-close" onClick={onClose} aria-label="סגירה" onMouseDown={(e) => e.stopPropagation()}>
            <IconClose width={22} height={22} />
          </button>

          {list.length > 1 && (
            <>
              <button type="button" className="lightbox-nav lightbox-nav-prev" aria-label="הקודם" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); go(-1) }}>
                <IconChevronLeft width={22} height={22} />
              </button>
              <button type="button" className="lightbox-nav lightbox-nav-next" aria-label="הבא" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); go(1) }}>
                <IconChevron width={22} height={22} />
              </button>
            </>
          )}

          <motion.div
            className="lightbox-stage"
            key={item.id}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {item.type === 'photo' && (
              <img className="lightbox-media" src={imageSrc(item)} alt={item.title || ''} />
            )}
            {item.type === 'video' && (
              videoEmbed(item)
                ? (
                  <iframe
                    className="lightbox-embed"
                    src={videoEmbed(item)}
                    title={item.title || 'video'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                )
                : <video className="lightbox-media" src={item.url} controls autoPlay />
            )}
            {item.type === 'text' && (
              <div className="lightbox-text">
                {item.title && <h3>{item.title}</h3>}
                <p>{item.body}</p>
              </div>
            )}
            {item.type === 'document' && (
              <div className="lightbox-text">
                {item.title && <h3>{item.title}</h3>}
                <a className="pill is-active" href={fileLink(item)} target="_blank" rel="noopener noreferrer">פתיחת מסמך</a>
              </div>
            )}

            <div className="lightbox-caption row gap-8 wrap">
              <div className="grow" style={{ minWidth: 0 }}>
                {(item.title || item.timeLabel) && (
                  <strong>
                    {item.timeLabel ? `${item.approximate ? '~' : ''}${item.timeLabel}` : ''}
                    {item.timeLabel && item.title ? ' · ' : ''}
                    {item.title || ''}
                  </strong>
                )}
                {item.authorName && <div className="muted" style={{ fontSize: '0.82rem' }}>{item.authorName}</div>}
                {item.type !== 'text' && item.body && <p className="lightbox-body">{item.body}</p>}
              </div>
              {onHeart && (
                <button
                  type="button"
                  className={`heart-btn ${hearted ? 'is-on' : ''}`}
                  onClick={onHeart}
                  title={hearted ? 'הסרת לב' : 'סימון לב'}
                >
                  {hearted ? <IconHeartFilled width={18} height={18} /> : <IconHeart width={18} height={18} />}
                  <span>{heartCount || ''}</span>
                </button>
              )}
              {list.length > 1 && (
                <span className="muted" style={{ fontSize: '0.78rem', alignSelf: 'center' }}>{idx + 1} / {list.length}</span>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
