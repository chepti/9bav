import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getSettlement, setInfoSection, updateSettlementMeta, addPoi } from '../../data/store.js'
import { useStore } from '../../data/store.js'
import { useSession, canEdit, canModerate } from '../../data/session.js'
import { SECTION_ICONS, IconPin, IconEdit } from '../ui/Icons.jsx'
import Modal from '../ui/Modal.jsx'
import Breadcrumbs from '../ui/Breadcrumbs.jsx'
import LeafletMap from '../Map/LeafletMap.jsx'

const SECTIONS = [
  { key: 'general', label: 'כללי' },
  { key: 'agriculture', label: 'חקלאות' },
  { key: 'education', label: 'חינוך' },
  { key: 'community', label: 'קהילה' },
  { key: 'commerce', label: 'מסחר' },
]

const REGION_LABEL = { gush_katif: 'גוש קטיף', northern_samaria: 'צפון השומרון' }

export default function SettlementView() {
  useStore() // subscribe to updates
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useSession()
  const s = getSettlement(id)

  const [tab, setTab] = useState('general')
  const [editMeta, setEditMeta] = useState(false)
  const [pinMode, setPinMode] = useState(false)
  const [poiDraft, setPoiDraft] = useState(null)
  const [poiTitle, setPoiTitle] = useState('')

  if (!s) return <div className="page-pad">היישוב לא נמצא. <button className="pill ghost" onClick={() => navigate('/')}>חזרה למפה</button></div>

  const mod = canModerate(session.role)
  const editor = canEdit(session.role)
  const section = s.info.find((i) => i.key === tab)

  function confirmPoi() {
    if (!poiTitle.trim() || !poiDraft) return
    const poiId = addPoi(s.id, { title: poiTitle.trim(), lat: poiDraft.lat, lng: poiDraft.lng, authorName: session.name })
    setPoiDraft(null)
    setPoiTitle('')
    setPinMode(false)
    navigate(`/poi/${s.id}/${poiId}`)
  }

  return (
    <motion.div className="settlement-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="settlement-hero">
        <Breadcrumbs items={[{ label: REGION_LABEL[s.region], to: '/' }, { label: s.name }]} />
        <div className="settlement-title-row">
          <div>
            <span className="pill sm">{REGION_LABEL[s.region]}</span>
            <h1>{s.name}</h1>
            {s.tagline && <p className="hero-tagline">{s.tagline}</p>}
          </div>
          {mod && <button className="pill ghost" onClick={() => setEditMeta(true)}><IconEdit width={14} height={14} /> עריכת פרטים</button>}
        </div>
        <div className="meta-chips row wrap gap-8">
          {s.population != null && <span className="meta-chip">{s.population.toLocaleString('he-IL')} תושבים</span>}
          {s.founded && <span className="meta-chip">הוקם {s.founded}</span>}
          {s.evacuatedTo && <span className="meta-chip">פונו אל: {s.evacuatedTo}</span>}
        </div>
      </div>

      <div className="settlement-grid">
        <div className="info-col card">
          <div className="row wrap gap-6" style={{ padding: '4px 4px 12px' }}>
            {SECTIONS.map((sec) => {
              const Icon = SECTION_ICONS[sec.key]
              return (
                <button key={sec.key} className={`pill ${tab === sec.key ? 'is-active' : 'ghost'}`} onClick={() => setTab(sec.key)}>
                  <Icon width={14} height={14} /> {sec.label}
                </button>
              )
            })}
          </div>
          <SectionBody key={tab} settlementId={s.id} sectionKey={tab} body={section?.body || ''} canEdit={mod} />
        </div>

        <div className="closeup-col">
          <div className="closeup-head row">
            <h3>נקודות עניין</h3>
            <span className="grow" />
            {editor && (
              <button className={`pill ${pinMode ? 'is-active' : 'ghost'}`} onClick={() => setPinMode((v) => !v)}>
                <IconPin width={14} height={14} /> {pinMode ? 'בחרו מיקום…' : 'הוספת נקודה'}
              </button>
            )}
          </div>
          <LeafletMap
            className="closeup-map"
            closeup
            center={{ lat: s.lat, lng: s.lng, zoom: 16 }}
            markers={s.pois.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, label: p.title, kind: 'poi' }))}
            pinMode={pinMode}
            onMarkerClick={(m) => navigate(`/poi/${s.id}/${m.id}`)}
            onMapClick={(latlng) => setPoiDraft({ lat: latlng.lat, lng: latlng.lng })}
          />
          {s.pois.length === 0 && !pinMode && (
            <p className="closeup-empty-note muted">אין עדיין נקודות עניין. {editor ? 'לחצו "הוספת נקודה" ואז על המפה כדי לסמן בית או אתר.' : 'התחברו כדי להוסיף.'}</p>
          )}

          {s.pois.length > 0 && (
            <div className="poi-list stack gap-8">
              <AnimatePresence>
                {s.pois.map((p) => (
                  <motion.button key={p.id} className="poi-list-item" onClick={() => navigate(`/poi/${s.id}/${p.id}`)}
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
                    <IconPin width={15} height={15} />
                    <strong>{p.title}</strong>
                    <span className="muted">{p.authorName}</span>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <Modal open={!!poiDraft} onClose={() => setPoiDraft(null)} title="נקודת עניין חדשה">
        <div className="stack gap-12">
          <label className="lbl">כותרת (למשל: הבית שלנו, בית הכנסת, החממות)</label>
          <input className="field" autoFocus value={poiTitle} onChange={(e) => setPoiTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmPoi()} placeholder="כותרת הנקודה" />
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            מיקום: {poiDraft ? `${poiDraft.lat.toFixed(4)}, ${poiDraft.lng.toFixed(4)}` : ''}
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" disabled={!poiTitle.trim()} onClick={confirmPoi}>יצירה</button>
          </div>
        </div>
      </Modal>

      <EditMetaModal open={editMeta} onClose={() => setEditMeta(false)} settlement={s} />
    </motion.div>
  )
}

function SectionBody({ settlementId, sectionKey, body, canEdit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(body)

  function save() {
    setInfoSection(settlementId, sectionKey, draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="stack gap-8 section-body">
        <textarea className="field" rows={7} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
        <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-soft" onClick={() => { setDraft(body); setEditing(false) }}>ביטול</button>
          <button className="btn btn-primary" onClick={save}>שמירה</button>
        </div>
      </div>
    )
  }

  return (
    <div className="section-body">
      {body ? <p>{body}</p> : <p className="muted">אין עדיין מידע בקטגוריה זו.</p>}
      {canEdit && <button className="pill ghost sm" onClick={() => setEditing(true)}><IconEdit width={13} height={13} /> עריכה</button>}
    </div>
  )
}

function EditMetaModal({ open, onClose, settlement }) {
  const [form, setForm] = useState({})
  const s = settlement
  const val = (k) => (form[k] !== undefined ? form[k] : s[k] ?? '')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function save() {
    updateSettlementMeta(s.id, {
      tagline: val('tagline'),
      evacuatedTo: val('evacuatedTo'),
      population: val('population') === '' ? undefined : Number(val('population')),
      founded: val('founded') === '' ? undefined : Number(val('founded')),
    })
    setForm({})
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`עריכת פרטי ${s.name}`}>
      <div className="stack gap-12">
        <div><label className="lbl">תיאור קצר</label><input className="field" value={val('tagline')} onChange={set('tagline')} /></div>
        <div className="row gap-12 wrap">
          <div style={{ flex: 1 }}><label className="lbl">מספר תושבים</label><input className="field" type="number" value={val('population')} onChange={set('population')} /></div>
          <div style={{ flex: 1 }}><label className="lbl">שנת הקמה</label><input className="field" type="number" value={val('founded')} onChange={set('founded')} /></div>
        </div>
        <div><label className="lbl">לאן פונו</label><input className="field" value={val('evacuatedTo')} onChange={set('evacuatedTo')} /></div>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-primary" onClick={save}>שמירה</button></div>
      </div>
    </Modal>
  )
}
