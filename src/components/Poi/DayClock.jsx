import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MEDIA_ICONS, IconChevron, IconChevronLeft, IconTrash, IconHeart, IconHeartFilled, IconEdit, IconPlus } from '../ui/Icons.jsx'
import { imageSrc, videoEmbed } from '../../data/media.js'
import MediaLightbox, { canOpenLightbox } from '../Media/MediaLightbox.jsx'
import { toggleMediaHeart, deleteMedia } from '../../data/store.js'
import { useSession, canModerate, canEditOwned, canEdit } from '../../data/session.js'
import { groupMomentsEven, itemSortMs } from '../../data/when.js'

// Kan 7.10–style dial: moments spaced evenly by count (not real duration),
// media shown beside the dial; each moment can hold several media items.

const SIZE = 380
const CX = SIZE / 2
const CY = SIZE / 2
const R = 148

function pointOnCircle(frac, r, cx, cy) {
  // frac 0 → top; increases clockwise
  const angle = -90 + frac * 360
  const rad = (angle * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad), angle }
}

function ringPath(cx, cy, r) {
  return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r}`
}

function heartKey(session) {
  if (session?.uid) return session.uid
  if (session?.email) return String(session.email).toLowerCase()
  if (session?.role && session.role !== 'guest' && session.name) return `name:${session.name}`
  return null
}

function summaryText(moment) {
  const first = moment?.items?.[0]
  if (!first) return ''
  return first.title || first.body || ''
}

export default function DayClock({ items, settlementId, poiId, onEditItem, onAddToMoment }) {
  const session = useSession()
  const key = heartKey(session)
  const mod = canModerate(session.role)
  const editor = canEdit(session.role)
  const moments = useMemo(() => groupMomentsEven(items), [items])

  const [mi, setMi] = useState(0) // moment index
  const [si, setSi] = useState(0) // media index within moment
  const [lbId, setLbId] = useState(null)

  useEffect(() => {
    if (mi >= moments.length) setMi(Math.max(0, moments.length - 1))
  }, [moments.length, mi])

  useEffect(() => {
    setSi(0)
  }, [mi])

  const moment = moments[mi] || null
  const media = moment?.items?.[si] || moment?.items?.[0] || null
  const lbItem = items.find((m) => m.id === lbId)

  if (moments.length === 0) {
    return (
      <div className="clock-empty muted">
        אין עדיין רגעים עם תאריך/שעה. הוסיפו פריט עם תאריך ושעה כדי לבנות את המעגל — הרגעים מסודרים במרווחים שווים לפי מספר האירועים.
      </div>
    )
  }

  const noWhen = items.filter((it) => itemSortMs(it) == null)

  function goMoment(delta) {
    setMi((i) => (i + delta + moments.length) % moments.length)
  }

  function selectMoment(i) {
    setMi(i)
  }

  function requestAddToMoment() {
    if (!moment || !onAddToMoment) return
    const sample = moment.items[0] || {}
    onAddToMoment({
      dateGregorian: sample.dateGregorian || '',
      dateHebrew: sample.dateHebrew || '',
      timeLabel: sample.timeLabel || '',
      approximate: !!sample.approximate,
      label: moment.label,
    })
  }

  function heart() {
    if (!key) {
      window.dispatchEvent(new CustomEvent('gk:need-signin'))
      return
    }
    if (!settlementId || !poiId || !media) return
    toggleMediaHeart(settlementId, poiId, media.id, key)
  }

  const likedBy = media?.likedBy || []
  const hearted = !!(key && likedBy.includes(key))
  const canOwn = media && canEditOwned(session, media)
  const embed = media ? videoEmbed(media) : null

  return (
    <div className="dayclock">
      <p className="muted dayclock-hint">
        הרגעים מסודרים במרווחים שווים סביב המעגל (לפי מספר האירועים). לחצו על נקודה — והתוכן יופיע בצד. לרגע עם כמה פריטים בחרו אייקון במרכז.
      </p>

      <div className="dayclock-stage">
        {/* Dial — in RTL appears on the right (start) */}
        <div className="dayclock-dial-col">
          <button type="button" className="clock-nav clock-nav-prev" onClick={() => goMoment(-1)} title="רגע קודם" aria-label="רגע קודם">
            <IconChevron width={22} height={22} />
          </button>

          <div className="dayclock-ring" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} className="dayclock-svg" aria-hidden>
              <circle cx={CX} cy={CY} r={R + 10} fill="none" stroke="var(--sand-200)" strokeWidth="18" />
              <path d={ringPath(CX, CY, R)} fill="none" stroke="var(--orange-500)" strokeWidth="3.5" strokeLinecap="round" />
              {moments.map((m) => {
                const p = pointOnCircle(m.frac, R, CX, CY)
                const active = m.index === mi
                return (
                  <g key={m.key} onClick={() => selectMoment(m.index)} style={{ cursor: 'pointer' }}>
                    <circle
                      cx={p.x} cy={p.y}
                      r={active ? 11 : 7}
                      fill={active ? 'var(--orange-600)' : 'var(--amber-500)'}
                      stroke="#fff"
                      strokeWidth={active ? 3 : 2}
                    />
                    {active && (
                      <circle cx={p.x} cy={p.y} r={16} fill="none" stroke="var(--orange-500)" strokeWidth="1.5" opacity="0.55" />
                    )}
                  </g>
                )
              })}
            </svg>

            {moments.map((m) => {
              const p = pointOnCircle(m.frac, R + 34, CX, CY)
              const active = m.index === mi
              return (
                <button
                  key={`lbl-${m.key}`}
                  type="button"
                  className={`clock-tick-label ${active ? 'is-active' : ''}`}
                  style={{ left: p.x, top: p.y }}
                  onClick={() => selectMoment(m.index)}
                >
                  {m.label}
                </button>
              )
            })}

            <div className="clock-center">
              <div className="clock-time">{moment.label}</div>
              <div className="clock-title">{summaryText(moment)}</div>
              <div className="clock-media-dots row gap-6" style={{ justifyContent: 'center', marginTop: 10 }}>
                {moment.items.map((it, idx) => {
                  const Icon = MEDIA_ICONS[it.type] || MEDIA_ICONS.text
                  return (
                    <button
                      key={it.id}
                      type="button"
                      className={`clock-media-dot ${idx === si ? 'is-active' : ''}`}
                      title={it.title || it.type}
                      onClick={() => setSi(idx)}
                    >
                      <Icon width={16} height={16} />
                    </button>
                  )
                })}
                {editor && onAddToMoment && (
                  <button
                    type="button"
                    className="clock-media-dot clock-media-add"
                    title="הוספת מדיה לרגע זה"
                    onClick={requestAddToMoment}
                  >
                    <IconPlus width={16} height={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <button type="button" className="clock-nav clock-nav-next" onClick={() => goMoment(1)} title="רגע הבא" aria-label="רגע הבא">
            <IconChevronLeft width={22} height={22} />
          </button>
        </div>

        {/* Side media panel */}
        <div className="dayclock-side">
          <AnimatePresence mode="wait">
            {media && (
              <motion.div
                key={media.id}
                className="dayclock-side-card card"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.22 }}
              >
                <div className="row gap-8" style={{ alignItems: 'center', marginBottom: 8 }}>
                  <span className="pill sm is-active">{moment.label}</span>
                  {media.authorName && <span className="muted" style={{ fontSize: '0.78rem' }}>{media.authorName}</span>}
                  <span className="grow" />
                  {canOwn && onEditItem && (
                    <button type="button" className="icon-btn" title="עריכה" onClick={() => onEditItem(media)}>
                      <IconEdit width={14} height={14} />
                    </button>
                  )}
                  {mod && (
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="מחיקה"
                      onClick={() => {
                        if (confirm('למחוק את הפריט?')) deleteMedia(settlementId, poiId, media.id)
                      }}
                    >
                      <IconTrash width={14} height={14} />
                    </button>
                  )}
                </div>

                {media.title && <h3 className="dayclock-side-title">{media.title}</h3>}

                {media.type === 'photo' && (media.url || media.driveId) && (
                  <button type="button" className="media-thumb" onClick={() => canOpenLightbox(media) && setLbId(media.id)}>
                    <img className="dayclock-side-img" src={imageSrc(media)} alt={media.title || ''} />
                  </button>
                )}

                {media.type === 'video' && (media.url || media.driveId) && (
                  embed
                    ? (
                      <iframe
                        className="dayclock-side-embed"
                        src={embed}
                        title={media.title || 'video'}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    )
                    : <video className="dayclock-side-img" src={media.url} controls />
                )}

                {media.type === 'document' && (media.url || media.driveId) && (
                  <button type="button" className="pill ghost" onClick={() => setLbId(media.id)}>פתיחת מסמך</button>
                )}

                {media.body && <p className="dayclock-side-body">{media.body}</p>}

                <div className="row gap-8" style={{ marginTop: 12, alignItems: 'center' }}>
                  <button type="button" className={`heart-btn ${hearted ? 'is-on' : ''}`} onClick={heart}>
                    {hearted ? <IconHeartFilled width={15} height={15} /> : <IconHeart width={15} height={15} />}
                    <span>{likedBy.length || ''}</span>
                  </button>
                  {moment.items.length > 1 && (
                    <span className="muted" style={{ fontSize: '0.78rem' }}>
                      פריט {si + 1} מתוך {moment.items.length} ברגע זה
                    </span>
                  )}
                  <span className="grow" />
                  {editor && onAddToMoment && (
                    <button type="button" className="pill sm ghost" onClick={requestAddToMoment}>
                      <IconPlus width={13} height={13} /> מדיה לרגע
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {noWhen.length > 0 && (
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>
          {noWhen.length} פריטים ללא תאריך/שעה אינם מוצגים על המעגל.
        </p>
      )}

      <MediaLightbox
        items={(moment?.items || []).filter(canOpenLightbox)}
        currentId={lbId}
        onClose={() => setLbId(null)}
        onNavigate={setLbId}
        hearted={!!(key && lbItem && (lbItem.likedBy || []).includes(key))}
        heartCount={lbItem?.likedBy?.length || 0}
        onHeart={() => {
          if (!key) {
            window.dispatchEvent(new CustomEvent('gk:need-signin'))
            return
          }
          if (settlementId && poiId && lbId) toggleMediaHeart(settlementId, poiId, lbId, key)
        }}
      />
    </div>
  )
}
