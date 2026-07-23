import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { MEDIA_ICONS } from '../ui/Icons.jsx'
import { imageSrc } from '../../data/media.js'
import MediaLightbox, { canOpenLightbox } from '../Media/MediaLightbox.jsx'
import { toggleMediaHeart } from '../../data/store.js'
import { useSession } from '../../data/session.js'

// Radial 24-hour clock for the day of expulsion. Each media item is placed
// around the ring by its timeLabel; selecting one shows it in the center.

function toMinutes(label) {
  if (!label) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(label.trim())
  if (!m) return null
  return (parseInt(m[1], 10) % 24) * 60 + parseInt(m[2], 10)
}

function pointOnRing(minutes, r, cx, cy) {
  const frac = minutes / 1440
  const angle = frac * 360 - 90
  const rad = (angle * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad), angle }
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
  const sorted = useMemo(() => {
    return [...items]
      .map((it) => ({ ...it, minutes: toMinutes(it.timeLabel) }))
      .filter((it) => it.minutes != null)
      .sort((a, b) => a.minutes - b.minutes)
  }, [items])

  const [selId, setSelId] = useState(sorted[0]?.id)
  const [lbId, setLbId] = useState(null)
  const selected = sorted.find((s) => s.id === selId) || sorted[0]
  const lbItem = items.find((m) => m.id === lbId)

  const size = 340
  const cx = size / 2
  const cy = size / 2
  const r = 132

  if (sorted.length === 0) {
    return (
      <div className="clock-empty muted">
        אין עדיין רגעים מתויגי־שעה. הוסיפו פריט עם תווית זמן (למשל 09:15) כדי שיופיע כאן על השעון.
      </div>
    )
  }

  const noText = items.filter((it) => toMinutes(it.timeLabel) == null)

  return (
    <div className="dayclock">
      <div className="dayclock-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="dayclock-svg">
          {Array.from({ length: 24 }).map((_, h) => {
            const p1 = pointOnRing(h * 60, r + 8, cx, cy)
            const p2 = pointOnRing(h * 60, r + (h % 6 === 0 ? 18 : 13), cx, cy)
            return (
              <line
                key={h}
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={h % 6 === 0 ? 'var(--amber-500)' : 'var(--sand-300)'}
                strokeWidth={h % 6 === 0 ? 2 : 1.2}
              />
            )
          })}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--sand-300)" strokeWidth="1.5" strokeDasharray="2 6" />
          {selected && (
            <path
              d={describeArc(cx, cy, r, sorted[0].minutes, selected.minutes)}
              fill="none"
              stroke="var(--orange-500)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}
          {sorted.map((it) => {
            const p = pointOnRing(it.minutes, r, cx, cy)
            const active = it.id === selected?.id
            return (
              <g key={it.id} onClick={() => setSelId(it.id)} style={{ cursor: 'pointer' }}>
                <circle cx={p.x} cy={p.y} r={active ? 9 : 6} fill={active ? 'var(--orange-600)' : 'var(--amber-500)'} stroke="#fff" strokeWidth="2" />
              </g>
            )
          })}
        </svg>

        {[
          { m: 0, t: '00:00' },
          { m: 360, t: '06:00' },
          { m: 720, t: '12:00' },
          { m: 1080, t: '18:00' },
        ].map((q) => {
          const p = pointOnRing(q.m, r + 30, cx, cy)
          return (
            <span key={q.t} className="clock-quarter" style={{ left: p.x, top: p.y }}>{q.t}</span>
          )
        })}

        <motion.div className="clock-center" key={selected?.id} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }}>
          <div className="clock-time">
            {selected?.approximate ? '~' : ''}
            {selected?.timeLabel}
          </div>
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
              {it.approximate ? '~' : ''}{it.timeLabel}
            </button>
          )
        })}
      </div>

      {noText.length > 0 && (
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>
          {noText.length} פריטים ללא תווית שעה אינם מוצגים על השעון.
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

function describeArc(cx, cy, r, m1, m2) {
  const a1 = (m1 / 1440) * 360 - 90
  const a2 = (m2 / 1440) * 360 - 90
  const rad1 = (a1 * Math.PI) / 180
  const rad2 = (a2 * Math.PI) / 180
  const x1 = cx + r * Math.cos(rad1)
  const y1 = cy + r * Math.sin(rad1)
  const x2 = cx + r * Math.cos(rad2)
  const y2 = cy + r * Math.sin(rad2)
  const large = a2 - a1 > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}
