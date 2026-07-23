import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MEDIA_ICONS, IconTrash, IconHeart, IconHeartFilled, IconEdit } from '../ui/Icons.jsx'
import { imageSrc, videoEmbed, youtubeIdFromUrl } from '../../data/media.js'
import MediaLightbox, { canOpenLightbox } from './MediaLightbox.jsx'
import { toggleMediaHeart, updateMedia } from '../../data/store.js'
import { useSession } from '../../data/session.js'
import { buildWhenFields, formatWhenDisplay } from '../../data/when.js'
import Modal from '../ui/Modal.jsx'
import WhenFields from './WhenFields.jsx'

function heartKey(session) {
  if (session?.uid) return session.uid
  if (session?.email) return String(session.email).toLowerCase()
  if (session?.role && session.role !== 'guest' && session.name) return `name:${session.name}`
  return null
}

export default function MediaCard({
  item,
  canModerate,
  canOwnEdit = false,
  onDelete,
  index = 0,
  settlementId,
  poiId,
  gallery = null,
}) {
  const session = useSession()
  const Icon = MEDIA_ICONS[item.type] || MEDIA_ICONS.text
  const [lbId, setLbId] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const key = heartKey(session)
  const likedBy = item.likedBy || []
  const hearted = !!(key && likedBy.includes(key))
  const heartCount = likedBy.length
  const openable = canOpenLightbox(item)
  const galleryItems = gallery || [item]
  const showEdit = canOwnEdit || canModerate

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
          {(item.timeLabel || item.dateGregorian || item.dateHebrew) && (
            <span className="pill sm ghost">{formatWhenDisplay(item)}</span>
          )}
          <span className="grow" />
          {showEdit && (
            <button type="button" className="icon-btn" title="עריכה" onClick={() => setEditOpen(true)}>
              <IconEdit width={13} height={13} />
            </button>
          )}
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

      <MediaEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        item={item}
        settlementId={settlementId}
        poiId={poiId}
      />
    </>
  )
}

function MediaEditModal({ open, onClose, item, settlementId, poiId }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [dateGregorian, setDateGregorian] = useState('')
  const [dateHebrew, setDateHebrew] = useState('')
  const [timeLabel, setTimeLabel] = useState('')
  const [approximate, setApproximate] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')

  const showWhen = !!(item && (item.timeLabel != null || item.dateGregorian || item.dateHebrew || item.approximate || item.whenMs))

  useEffect(() => {
    if (!open || !item) return
    setTitle(item.title || '')
    setBody(item.body || '')
    setDateGregorian(item.dateGregorian || '')
    setDateHebrew(item.dateHebrew || '')
    setTimeLabel(item.timeLabel || '')
    setApproximate(!!item.approximate)
    setYoutubeUrl(youtubeIdFromUrl(item.url) ? item.url : '')
  }, [open, item])

  function save() {
    if (!settlementId || !poiId || !item) return
    const patch = {
      title: title.trim(),
      body: body.trim(),
    }
    if (showWhen) {
      Object.assign(patch, buildWhenFields({ dateGregorian, dateHebrew, timeLabel, approximate }))
    }
    if (item.type === 'video' && youtubeUrl.trim()) {
      const yt = youtubeIdFromUrl(youtubeUrl)
      if (yt) patch.url = `https://www.youtube.com/watch?v=${yt}`
    }
    updateMedia(settlementId, poiId, item.id, patch)
    onClose()
  }

  if (!item) return null

  return (
    <Modal open={open} onClose={onClose} title="עריכת פריט" wide>
      <div className="stack gap-12">
        <div>
          <label className="lbl">כותרת</label>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {showWhen && (
          <WhenFields
            dateGregorian={dateGregorian}
            dateHebrew={dateHebrew}
            timeLabel={timeLabel}
            approximate={approximate}
            onChange={(patch) => {
              if ('dateGregorian' in patch) setDateGregorian(patch.dateGregorian || '')
              if ('dateHebrew' in patch) setDateHebrew(patch.dateHebrew || '')
              if ('timeLabel' in patch) setTimeLabel(patch.timeLabel || '')
              if ('approximate' in patch) setApproximate(!!patch.approximate)
            }}
          />
        )}
        {item.type === 'video' && (
          <div>
            <label className="lbl">קישור יוטיוב (אם רלוונטי)</label>
            <input className="field" dir="ltr" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          </div>
        )}
        <div>
          <label className="lbl">{item.type === 'text' ? 'הטקסט' : 'תיאור / כיתוב'}</label>
          <textarea className="field" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-soft" onClick={onClose}>ביטול</button>
          <button className="btn btn-primary" onClick={save}>שמירה</button>
        </div>
      </div>
    </Modal>
  )
}
