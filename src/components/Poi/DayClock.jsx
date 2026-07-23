import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MEDIA_ICONS } from '../ui/Icons.jsx'
import { imageSrc } from '../../data/media.js'
import MediaLightbox, { canOpenLightbox } from '../Media/MediaLightbox.jsx'
import { toggleMediaHeart } from '../../data/store.js'
import { useSession } from '../../data/session.js'
import { relativeTimeline, formatWhenDisplay, itemSortMs } from '../../data/when.js'

// Relative open-arc clock for expulsion moments: earliest → latest across
// whatever date/time span residents document (not locked to a single 24h day).

const SIZE = 340
const CX = SIZE / 2
const CY = SIZE / 2
const R = 132
/** Degrees swept by the timeline (leave a gap so start ≠ end). */
const SWEEP = 300
const START_DEG = -90 - SWEEP / 2 // centered gap at the bottom

function pointOnArc(frac, r, cx, cy) {
  const angle = START_DEG + frac * SWEEP
  const rad = (angle * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad), angle }
}

function describeArcFrac(cx, cy, r, f1, f2) {
  if (f2 < f1) return ''
  const a1 = START_DEG + f1 * SWEEP
  const a2 = START_DEG + f2 * SWEEP
  const rad1 = (a1 * Math.PI) / 180
  const rad2 = (a2 * Math.PI) / 180
  const x1 = cx + r * Math.cos(rad1)
  const y1 = cy + r * Math.sin(rad1)
  const x2 = cx + r * Math.cos(rad2)
  const y2 = cy + r * Math.sin(rad2)
  const large = a2 - a1 > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

function heartKey(session) {
  if (session?.uid) return session.uid
  if (session?.email) return String(session.email).toLowerCase()
  if (session?.role && session.role !== 'guest' && session.name) return `name:${session.name}`
  return null
}

export default function DayClock({ items, settlementId, poiId }) {
  const session = useSession()
  const key = heartKey(session)
  const { sorted } = useMemo(() => relativeTimeline(items), [items])

  const [selId, setSelId] = useState(sorted[0]?.id)
  const [lbId, setLbId] = useState(null)

  useEffect(() => {
    if (!sorted.find((s) => s.id === selId) && sorted[0]) setSelId(sorted[0].id)
  }, [sorted, selId])

  const selected = sorted.find((s) => s.id === selId) || sorted[0]
  const lbItem = items.find((m) => m.id === lbId)

  if (sorted.length === 0) {
    return (
      <div className="clock-empty muted">
        אין עדיין רגעים עם תאריך/שעה. הוסיפו פריט עם תאריך ושעה (לועזי או עברי) כדי שיופיע על המעגל היחסי — מהרגע המוקדם ביותר עד המאוחר ביותר.
      </div>
    )
  }

  const noWhen = items.filter((it) => itemSortMs(it) == null)
  const startLabel = formatWhenDisplay(sorted[0])
  const endLabel = formatWhenDisplay(sorted[sorted.length - 1])

  return (
    <div className="dayclock">
      <p className="muted dayclock-hint">
        מעגל יחסי: מהרגע המוקדם עד המאוחר ביותר שתועדו סביב הגירוש
        {sorted.length > 1 && startLabel && endLabel ? ` · ${startLabel} ← ${endLabel}` : ''}
      </p>
      <div className="dayclock-ring" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="dayclock-svg">
          {/* tick marks along the open arc */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const p1 = pointOnArc(f, R + 8, CX, CY)
            const p2 = pointOnArc(f, R + (f === 0 || f === 1 ? 18 : 13), CX, CY)
            return (
              <line
                key={f}
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={f === 0 || f === 1 ? 'var(--amber-500)' : 'var(--sand-300)'}
                strokeWidth={f === 0 || f === 1 ? 2 : 1.2}
              />
            )
          })}
          <path
            d={describeArcFrac(CX, CY, R, 0, 1)}
            fill="none"
            stroke="var(--sand-300)"
            strokeWidth="1.5"
            strokeDasharray="2 6"
          />
          {selected && (
            <path
              d={describeArcFrac(CX, CY, R, 0, selected.frac)}
              fill="none"
              stroke="var(--orange-500)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}
          {sorted.map((it) => {
            const p = pointOnArc(it.frac, R, CX, CY)
            const active = it.id === selected?.id
            return (
              <g key={it.id} onClick={() => setSelId(it.id)} style={{ cursor: 'pointer' }}>
                <circle cx={p.x} cy={p.y} r={active ? 9 : 6} fill={active ? 'var(--orange-600)' : 'var(--amber-500)'} stroke="#fff" strokeWidth="2" />
              </g>
            )
          })}
        </svg>

        {[
          { f: 0, t: startLabel },
          { f: 1, t: endLabel },
        ].map((q, i) => {
          const p = pointOnArc(q.f, R + 36, CX, CY)
          return (
            <span key={i} className="clock-quarter clock-endpoint" style={{ left: p.x, top: p.y }} title={q.t}>
              {q.t}
            </span>
          )
        })}

        <motion.div className="clock-center" key={selected?.id} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }}>
          <div className="clock-time">{formatWhenDisplay(selected)}</div>
          {selected?.title && <div className="clock-title">{selected.title}</div>}
          <div className="clock-body">{selected?.body}</div>
          {selected?.type === 'photo' && (selected?.url || selected?.driveId) && (
            <button type="button" className="media-thumb" onClick={() => setLbId(selected.id)} title="הגדלה">
              <img className="clock-img" src={imageSrc(selected)} alt={selected.title || ''} />
            </button>
          )}
        </motion.div>
      </div>

      <div className="clock-list row wrap gap-6">
        {sorted.map((it) => {
          const Icon = MEDIA_ICONS[it.type] || MEDIA_ICONS.text
          return (
            <button key={it.id} className={`pill sm ${it.id === selected?.id ? 'is-active' : 'ghost'}`} onClick={() => setSelId(it.id)}>
              <Icon width={13} height={13} />
              {formatWhenDisplay(it)}
            </button>
          )
        })}
      </div>

      {noWhen.length > 0 && (
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>
          {noWhen.length} פריטים ללא תאריך/שעה אינם מוצגים על המעגל.
        </p>
      )}

      <MediaLightbox
        items={items.filter(canOpenLightbox)}
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
