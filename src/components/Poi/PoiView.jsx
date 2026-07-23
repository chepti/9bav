import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getSettlement, useStore, deleteMedia, addAfterEntry } from '../../data/store.js'
import { useSession, canEdit, canModerate } from '../../data/session.js'
import { IconPlus } from '../ui/Icons.jsx'
import Modal from '../ui/Modal.jsx'
import Breadcrumbs from '../ui/Breadcrumbs.jsx'
import MediaCard from '../Media/MediaCard.jsx'
import MediaUploader from '../Media/MediaUploader.jsx'
import DayClock from './DayClock.jsx'

const PHASES = [
  { key: 'before', label: 'לפני הגירוש', hint: 'איך נראו החיים כאן' },
  { key: 'during', label: 'מסביב לשעון', hint: 'רגעי יום הגירוש, לפי שעה' },
  { key: 'after', label: 'אחרי הגירוש', hint: 'הדרך עד לבית קבע' },
]

export default function PoiView() {
  useStore()
  const { settlementId, poiId } = useParams()
  const navigate = useNavigate()
  const session = useSession()
  const s = getSettlement(settlementId)
  const poi = s?.pois.find((p) => p.id === poiId)

  const [phase, setPhase] = useState('before')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [afterOpen, setAfterOpen] = useState(false)

  if (!s || !poi) return <div className="page-pad">הנקודה לא נמצאה. <button className="pill ghost" onClick={() => navigate('/')}>למפה</button></div>

  const editor = canEdit(session.role)
  const mod = canModerate(session.role)

  return (
    <motion.div className="poi-view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="poi-hero">
        <Breadcrumbs items={[{ label: s.name, to: `/settlement/${s.id}` }, { label: poi.title }]} />
        <h1>{poi.title}</h1>
        <p className="muted">הוסיפו {poi.authorName}</p>
      </div>

      <div className="phase-tabs row wrap gap-8">
        {PHASES.map((ph) => (
          <button key={ph.key} className={`phase-tab ${phase === ph.key ? 'is-active' : ''}`} onClick={() => setPhase(ph.key)}>
            <strong>{ph.label}</strong>
            <span>{ph.hint}</span>
          </button>
        ))}
      </div>

      <div className="phase-panel-wrap">
        <motion.div key={phase} className="phase-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
          {phase === 'before' && (
            <PhaseBlock title="לפני הגירוש" editor={editor} onAdd={() => setUploadOpen(true)}>
              <MediaGrid items={poi.before || []} mod={mod} onDelete={(m) => deleteMedia(s.id, poi.id, m)} settlementId={s.id} poiId={poi.id} empty="עדיין אין תיעוד של התקופה שלפני הגירוש." />
            </PhaseBlock>
          )}

          {phase === 'during' && (
            <PhaseBlock title="מסביב לשעון — יום הגירוש" editor={editor} onAdd={() => setUploadOpen(true)} addLabel="הוספת רגע">
              <DayClock items={poi.during || []} settlementId={s.id} poiId={poi.id} />
              <div className="divider" />
              <MediaGrid items={poi.during || []} mod={mod} onDelete={(m) => deleteMedia(s.id, poi.id, m)} settlementId={s.id} poiId={poi.id} empty="הוסיפו רגעים עם תווית שעה כדי לבנות את ציר היום." />
            </PhaseBlock>
          )}

          {phase === 'after' && (
            <PhaseBlock title="אחרי הגירוש" editor={editor} onAdd={() => setAfterOpen(true)} addLabel="הוספת תחנה">
              <AfterTimeline entries={poi.after || []} mod={mod} settlementId={s.id} poiId={poi.id} />
            </PhaseBlock>
          )}
        </motion.div>
      </div>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title={phase === 'during' ? 'הוספת רגע מיום הגירוש' : 'הוספת מדיה'} wide>
        <MediaUploader settlementId={s.id} poiId={poi.id} phase={phase} onDone={() => setUploadOpen(false)} />
      </Modal>

      <AfterEntryModal open={afterOpen} onClose={() => setAfterOpen(false)} settlementId={s.id} poiId={poi.id} />
    </motion.div>
  )
}

function PhaseBlock({ title, children, editor, onAdd, addLabel = 'הוספת מדיה' }) {
  return (
    <div className="stack gap-16">
      <div className="row">
        <h2>{title}</h2>
        <span className="grow" />
        {editor && <button className="btn btn-primary" onClick={onAdd}><IconPlus width={16} height={16} /> {addLabel}</button>}
      </div>
      {children}
    </div>
  )
}

function MediaGrid({ items, mod, onDelete, empty, settlementId, poiId }) {
  if (items.length === 0) return <p className="muted">{empty}</p>
  return (
    <div className="media-grid">
      {items.map((m, i) => (
        <MediaCard
          key={m.id}
          item={m}
          index={i}
          canModerate={mod}
          onDelete={() => onDelete(m.id)}
          settlementId={settlementId}
          poiId={poiId}
          gallery={items}
        />
      ))}
    </div>
  )
}

function AfterTimeline({ entries, mod, settlementId, poiId }) {
  if (entries.length === 0) return <p className="muted">עדיין לא תועדה הדרך שאחרי הגירוש. הוסיפו תחנה — תאריך, כותרת ותיאור.</p>
  return (
    <div className="after-timeline">
      {entries.map((d, i) => (
        <motion.div key={d.id} className="after-entry" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
          <div className="after-dot" />
          <div className="after-content card">
            <span className="pill sm is-active">{d.dateLabel}</span>
            {d.title && <h4>{d.title}</h4>}
            {d.description && <p>{d.description}</p>}
            {(d.media || []).length > 0 && (
              <div className="media-grid" style={{ marginTop: 10 }}>
                {d.media.map((m, j) => (
                  <MediaCard
                    key={m.id}
                    item={m}
                    index={j}
                    canModerate={mod}
                    onDelete={() => deleteMedia(settlementId, poiId, m.id)}
                    settlementId={settlementId}
                    poiId={poiId}
                    gallery={d.media}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function AfterEntryModal({ open, onClose, settlementId, poiId }) {
  const [dateLabel, setDate] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDesc] = useState('')

  function save() {
    if (!dateLabel.trim()) return
    addAfterEntry(settlementId, poiId, { dateLabel: dateLabel.trim(), title: title.trim(), description: description.trim() })
    setDate(''); setTitle(''); setDesc('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="תחנה חדשה בדרך" wide>
      <div className="stack gap-12">
        <div><label className="lbl">תאריך / תקופה (טקסט חופשי)</label><input className="field" value={dateLabel} onChange={(e) => setDate(e.target.value)} placeholder="למשל: ספטמבר 2005 / 2009" /></div>
        <div><label className="lbl">כותרת</label><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: מעבר לבית קבע" /></div>
        <div><label className="lbl">תיאור</label><textarea className="field" rows={4} value={description} onChange={(e) => setDesc(e.target.value)} /></div>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-primary" disabled={!dateLabel.trim()} onClick={save}>הוספה</button></div>
      </div>
    </Modal>
  )
}
