import { useState } from 'react'
import { motion } from 'framer-motion'
import { MEDIA_ICONS, IconTrash, IconHeart, IconHeartFilled } from '../ui/Icons.jsx'
import { imageSrc, videoEmbed, fileLink } from '../../data/media.js'
import MediaLightbox, { canOpenLightbox } from './MediaLightbox.jsx'
import { toggleMediaHeart } from '../../data/store.js'
import { useSession } from '../../data/session.js'

function heartKey(session) {
  if (session?.uid) return session.uid
  if (session?.email) return String(session.email).toLowerCase()
  if (session?.role && session.role !== 'guest' && session.name) return `name:${session.name}`
  return null
}

export default function MediaCard({
  item,
  canModerate,
  onDelete,
  index = 0,
  settlementId,
  poiId,
  gallery = null, // sibling items for lightbox navigation
}) {
  const session = useSession()
  const Icon = MEDIA_ICONS[item.type] || MEDIA_ICONS.text
  const [lbId, setLbId] = useState(null)
  const key = heartKey(session)
  const likedBy = item.likedBy || []
  const hearted = !!(key && likedBy.includes(key))
  const heartCount = likedBy.length
  const openable = canOpenLightbox(item)
  const galleryItems = gallery || [item]

  function heart() {
    if (!key) {
      window.dispatchEvent(new CustomEvent('gk:need-signin'))
      return
    }
    if (!settlementId || !poiId) return
    toggleMediaHeart(settlementId, poiId, item.id, key)
  }

  function openLb() {
    if (openable) setLbId(item.id)
  }

  return (
    <>
      <motion.div
        className={`media-card ${openable ? 'is-openable' : ''}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.3 }}
      >
        <div className="media-card-head row gap-8">
          <span className="media-type-badge"><Icon width={14} height={14} /></span>
          {item.title && <strong>{item.title}</strong>}
          {item.timeLabel && <span className="pill sm ghost">{item.approximate ? '~' : ''}{item.timeLabel}</span>}
          <span className="grow" />
          {item.authorName && <span className="muted" style={{ fontSize: '0.78rem' }}>{item.authorName}</span>}
        </div>

        {item.type === 'photo' && (item.url || item.driveId) && (
          <button type="button" className="media-thumb" onClick={openLb} title="הגדלה">
            <img className="media-img" src={imageSrc(item)} alt={item.title || ''} loading="lazy" />
          </button>
        )}
        {item.type === 'video' && (item.url || item.driveId) && (
          <button type="button" className="media-thumb" onClick={openLb} title="הגדלה">
            {videoEmbed(item)
              ? (
                <iframe
                  className="media-embed"
                  src={videoEmbed(item)}
                  title={item.title || 'video'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  // clicks go to the button wrapper for lightbox; iframe still plays if focused
                  style={{ pointerEvents: 'none' }}
                />
              )
              : <video className="media-img" src={item.url} preload="metadata" style={{ pointerEvents: 'none' }} />}
          </button>
        )}
        {item.type === 'document' && (item.url || item.driveId) && (
          <button type="button" className="pill ghost" onClick={openLb}>פתיחת מסמך</button>
        )}
        {item.type === 'text' && item.body && (
          <button type="button" className="media-text-preview" onClick={openLb}>
            <p className="media-body">{item.body}</p>
          </button>
        )}
        {item.type !== 'text' && item.body && <p className="media-body">{item.body}</p>}

        <div className="media-card-actions row gap-6">
          <button
            type="button"
            className={`heart-btn ${hearted ? 'is-on' : ''}`}
            onClick={heart}
            title={key ? (hearted ? 'הסרת לב' : 'סימון לב') : 'התחברו כדי לסמן לב'}
          >
            {hearted ? <IconHeartFilled width={15} height={15} /> : <IconHeart width={15} height={15} />}
            <span>{heartCount || (key ? '' : 'לב')}</span>
          </button>
          <span className="grow" />
          {canModerate && (
            <button type="button" className="pill sm ghost danger" onClick={onDelete}><IconTrash width={13} height={13} /> מחיקה</button>
          )}
        </div>
      </motion.div>

      <MediaLightbox
        items={galleryItems}
        currentId={lbId}
        onClose={() => setLbId(null)}
        onNavigate={setLbId}
        hearted={(() => {
          const cur = galleryItems.find((m) => m.id === lbId) || item
          return !!(key && (cur.likedBy || []).includes(key))
        })()}
        heartCount={(galleryItems.find((m) => m.id === lbId) || item).likedBy?.length || 0}
        onHeart={() => {
          const cur = galleryItems.find((m) => m.id === lbId) || item
          if (!key) {
            window.dispatchEvent(new CustomEvent('gk:need-signin'))
            return
          }
          if (settlementId && poiId) toggleMediaHeart(settlementId, poiId, cur.id, key)
        }}
      />
    </>
  )
}
