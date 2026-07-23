import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getSettlement, setInfoSection, updateSettlementMeta, addPoi, movePoi, deletePoi, deleteSettlement, addArea, deleteArea } from '../../data/store.js'
import { useStore } from '../../data/store.js'
import { useSession, canEdit, canModerate } from '../../data/session.js'
import { SECTION_ICONS, IconPin, IconEdit, IconTrash } from '../ui/Icons.jsx'
import { AREA_CATEGORIES, AREA_COLOR, AREA_LABEL } from '../../data/categories.js'
import { imageSrc } from '../../data/media.js'
import { uploadToDrive, isDriveConfigured } from '../../data/drive.js'
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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function SettlementView() {
  useStore() // subscribe to updates
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useSession()
  const s = getSettlement(id)

  const [tab, setTab] = useState('general')
  const [editMeta, setEditMeta] = useState(false)
  const [pinMode, setPinMode] = useState(false)
  const [moveMode, setMoveMode] = useState(false)
  const [poiDraft, setPoiDraft] = useState(null)
  const [poiTitle, setPoiTitle] = useState('')
  // area drawing: drawCat = the category being drawn (null when idle)
  const [drawCat, setDrawCat] = useState(null)
  const [draftPoints, setDraftPoints] = useState([])

  if (!s) return <div className="page-pad">היישוב לא נמצא. <button className="pill ghost" onClick={() => navigate('/')}>חזרה למפה</button></div>

  const mod = canModerate(session.role)
  const editor = canEdit(session.role)
  const section = s.info.find((i) => i.key === tab)
  const hist = s.historical
  const histSrc = hist && (hist.url || hist.driveId) ? imageSrc(hist) : null
  const areas = s.areas || []

  function confirmPoi() {
    if (!poiTitle.trim() || !poiDraft) return
    const poiId = addPoi(s.id, { title: poiTitle.trim(), lat: poiDraft.lat, lng: poiDraft.lng, authorName: session.name })
    setPoiDraft(null)
    setPoiTitle('')
    setPinMode(false)
    navigate(`/poi/${s.id}/${poiId}`)
  }

  function startDraw(cat) {
    setDrawCat(cat)
    setDraftPoints([])
    setPinMode(false)
    setMoveMode(false)
  }
  function cancelDraw() {
    setDrawCat(null)
    setDraftPoints([])
  }
  function finishArea() {
    if (draftPoints.length >= 3) addArea(s.id, { category: drawCat, points: draftPoints })
    cancelDraw()
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

      {histSrc && (
        <figure className="hist-photo card">
          <img src={histSrc} alt={`${s.name} — כך היה`} loading="lazy" />
          <figcaption className="muted">
            {hist.caption || `${s.name} — כך נראה היישוב (${hist.year || '2005'})`}
          </figcaption>
        </figure>
      )}

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
          <div className="closeup-head row wrap gap-6">
            <h3>נקודות עניין</h3>
            <span className="grow" />
            {editor && (
              <button className={`pill ${pinMode ? 'is-active' : 'ghost'}`} onClick={() => { setPinMode((v) => !v); setMoveMode(false); cancelDraw() }}>
                <IconPin width={14} height={14} /> {pinMode ? 'בחרו מיקום…' : 'הוספת נקודה'}
              </button>
            )}
            {mod && s.pois.length > 0 && (
              <button className={`pill ${moveMode ? 'is-active' : 'ghost'}`} onClick={() => { setMoveMode((v) => !v); setPinMode(false); cancelDraw() }}>
                <IconEdit width={14} height={14} /> {moveMode ? 'גררו נקודה ושחררו' : 'הזזה'}
              </button>
            )}
          </div>

          {editor && (
            <div className="area-tools row wrap gap-6">
              {drawCat ? (
                <>
                  <span className="pill sm is-active"><span className="area-swatch" style={{ background: AREA_COLOR[drawCat] }} /> מסמן: {AREA_LABEL[drawCat]}</span>
                  <button className="pill ghost sm" onClick={() => setDraftPoints((p) => p.slice(0, -1))} disabled={!draftPoints.length}>ביטול נקודה</button>
                  <button className="pill sm is-active" onClick={finishArea} disabled={draftPoints.length < 3}>סיום ושמירה</button>
                  <button className="pill ghost sm" onClick={cancelDraw}>ביטול</button>
                </>
              ) : (
                <>
                  <span className="muted" style={{ fontSize: '0.82rem' }}>סימון אזור:</span>
                  {AREA_CATEGORIES.map((c) => (
                    <button key={c.key} className="pill ghost sm" onClick={() => startDraw(c.key)}>
                      <span className="area-swatch" style={{ background: c.color }} /> {c.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
          {drawCat && (
            <p className="muted" style={{ fontSize: '0.8rem', margin: '2px 0 6px' }}>לחצו על המפה כדי להוסיף פינות לאזור (לפחות 3), ואז "סיום ושמירה".</p>
          )}

          <LeafletMap
            className="closeup-map"
            closeup
            fitKey={s.id}
            center={{ lat: s.lat, lng: s.lng, zoom: 16 }}
            markers={s.pois.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, label: p.title, kind: 'poi' }))}
            pinMode={pinMode}
            draggableMarkers={moveMode}
            areas={areas}
            draftArea={drawCat ? { category: drawCat, points: draftPoints } : null}
            drawMode={!!drawCat}
            onDrawClick={(latlng) => setDraftPoints((p) => [...p, [latlng.lat, latlng.lng]])}
            onMarkerClick={(m) => navigate(`/poi/${s.id}/${m.id}`)}
            onMapClick={(latlng) => setPoiDraft({ lat: latlng.lat, lng: latlng.lng })}
            onMarkerMove={(m, latlng) => movePoi(s.id, m.id, latlng.lat, latlng.lng)}
          />

          {areas.length > 0 && (
            <div className="area-legend row wrap gap-8">
              {areas.map((a) => (
                <span key={a.id} className="area-chip">
                  <span className="area-swatch" style={{ background: AREA_COLOR[a.category] || AREA_COLOR.general }} />
                  {a.label || AREA_LABEL[a.category] || a.category}
                  {mod && <button className="area-del" title="מחיקת אזור" onClick={() => deleteArea(s.id, a.id)}>×</button>}
                </span>
              ))}
            </div>
          )}

          {s.pois.length === 0 && !pinMode && (
            <p className="closeup-empty-note muted">אין עדיין נקודות עניין. {editor ? 'לחצו "הוספת נקודה" ואז על המפה כדי לסמן בית או אתר.' : 'התחברו כדי להוסיף.'}</p>
          )}

          {s.pois.length > 0 && (
            <div className="poi-list stack gap-8">
              <AnimatePresence>
                {s.pois.map((p) => (
                  <motion.div key={p.id} className="poi-list-item" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                    <button className="poi-list-open" onClick={() => navigate(`/poi/${s.id}/${p.id}`)}>
                      <IconPin width={15} height={15} />
                      <strong>{p.title}</strong>
                      <span className="muted">{p.authorName}</span>
                    </button>
                    {mod && (
                      <button className="icon-btn danger" title="מחיקת נקודה" onClick={() => { if (confirm(`למחוק את "${p.title}" וכל התכנים שבה?`)) deletePoi(s.id, p.id) }}>
                        <IconTrash width={15} height={15} />
                      </button>
                    )}
                  </motion.div>
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
  const navigate = useNavigate()
  const [form, setForm] = useState({})
  const [imgBusy, setImgBusy] = useState(false)
  const [imgErr, setImgErr] = useState('')
  const s = settlement
  const val = (k) => (form[k] !== undefined ? form[k] : s[k] ?? '')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // historical image fields (nested under s.historical)
  const h = s.historical || {}
  const hInit = { url: h.url ?? '', driveId: h.driveId ?? '', caption: h.caption ?? '', year: h.year ?? '' }
  const hval = (k) => (form['h_' + k] !== undefined ? form['h_' + k] : hInit[k])
  const hset = (k) => (e) => setForm((f) => ({ ...f, ['h_' + k]: e.target.value }))
  const previewSrc = hval('driveId') ? imageSrc({ driveId: hval('driveId') }) : hval('url')

  async function onHistFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setImgBusy(true)
    setImgErr('')
    try {
      if (isDriveConfigured) {
        const up = await uploadToDrive(f)
        setForm((fm) => ({ ...fm, h_driveId: up.id, h_url: up.url }))
      } else {
        const dataUrl = await fileToDataUrl(f)
        setForm((fm) => ({ ...fm, h_driveId: '', h_url: dataUrl }))
      }
    } catch {
      setImgErr('ההעלאה נכשלה. נסו קובץ קטן יותר, או הדביקו קישור.')
    } finally {
      setImgBusy(false)
    }
  }

  function save() {
    const url = String(hval('url')).trim()
    const driveId = String(hval('driveId')).trim()
    const historical = (url || driveId)
      ? {
          url: url || undefined,
          driveId: driveId || undefined,
          caption: String(hval('caption')).trim() || undefined,
          year: String(hval('year')).trim() || '2005',
        }
      : null
    updateSettlementMeta(s.id, {
      tagline: val('tagline'),
      evacuatedTo: val('evacuatedTo'),
      population: val('population') === '' ? undefined : Number(val('population')),
      founded: val('founded') === '' ? undefined : Number(val('founded')),
      historical,
    })
    setForm({})
    onClose()
  }

  function removeHist() {
    setForm((f) => ({ ...f, h_url: '', h_driveId: '' }))
  }

  function remove() {
    if (!confirm(`למחוק את היישוב "${s.name}" על כל נקודות העניין והתכנים שבו? פעולה בלתי הפיכה.`)) return
    deleteSettlement(s.id)
    onClose()
    navigate('/')
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

        <details className="hist-fields" open>
          <summary>תמונת "כך היה היישוב" (לפני / אחרי)</summary>
          <div className="stack gap-10" style={{ marginTop: 10 }}>
            <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
              העלו תמונה מהמחשב (למשל תצלום השוואה לפני/אחרי), או הדביקו קישור. התמונה תוצג בראש דף היישוב.
            </p>
            <div>
              <label className="lbl">העלאת תמונה</label>
              <input type="file" accept="image/*" onChange={onHistFile} disabled={imgBusy} />
              {imgBusy && <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>מעלה…</p>}
            </div>
            <div><label className="lbl">או קישור לתמונה (URL)</label><input className="field" dir="ltr" value={hval('url')} onChange={hset('url')} placeholder="https://…" /></div>
            {previewSrc && (
              <div className="stack gap-6">
                <img src={previewSrc} alt="תצוגה מקדימה" style={{ maxWidth: '100%', borderRadius: 10 }} />
                <button className="pill ghost sm" onClick={removeHist} type="button" style={{ alignSelf: 'flex-start' }}>הסרת התמונה</button>
              </div>
            )}
            <div className="row gap-10 wrap">
              <div style={{ flex: 2, minWidth: 160 }}><label className="lbl">כיתוב (רשות)</label><input className="field" value={hval('caption')} onChange={hset('caption')} placeholder="למשל: נצרים, לפני ואחרי" /></div>
              <div style={{ flex: 1, minWidth: 90 }}><label className="lbl">שנה</label><input className="field" dir="ltr" value={hval('year')} onChange={hset('year')} placeholder="2005" /></div>
            </div>
            {imgErr && <p style={{ color: '#d9534f', fontSize: '0.85rem', margin: 0 }}>{imgErr}</p>}
          </div>
        </details>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-soft danger-btn" onClick={remove}><IconTrash width={15} height={15} /> מחיקת יישוב</button>
          <button className="btn btn-primary" onClick={save} disabled={imgBusy}>שמירה</button>
        </div>
      </div>
    </Modal>
  )
}
