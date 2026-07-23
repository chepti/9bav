import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getSettlement, setInfoSectionFull, updateSettlementMeta, addPoi, deletePoi, deleteSettlement, addArea, deleteArea } from '../../data/store.js'
import { useStore } from '../../data/store.js'
import { useSession, canEdit, canModerate } from '../../data/session.js'
import { SECTION_ICONS, IconPin, IconEdit, IconTrash, IconPlus, IconClock } from '../ui/Icons.jsx'
import { AREA_CATEGORIES, AREA_COLOR, AREA_LABEL } from '../../data/categories.js'
import { imageSrc } from '../../data/media.js'
import { sortEntriesByYear } from '../../data/timeline.js'
import { uploadToDrive, isDriveConfigured } from '../../data/drive.js'
import Modal from '../ui/Modal.jsx'
import Breadcrumbs from '../ui/Breadcrumbs.jsx'
import ImageMap from '../Map/ImageMap.jsx'
import MediaLightbox from '../Media/MediaLightbox.jsx'

const SECTIONS = [
  { key: 'general', label: 'כללי' },
  { key: 'agriculture', label: 'חקלאות' },
  { key: 'education', label: 'חינוך' },
  { key: 'community', label: 'קהילה' },
  { key: 'commerce', label: 'מסחר' },
]

const REGION_LABEL = { gush_katif: 'גוש קטיף', northern_samaria: 'צפון השומרון' }

function countPoiItems(p) {
  let n = (p.before || []).length + (p.during || []).length
  for (const e of p.after || []) {
    const mediaN = (e.media || []).length
    n += mediaN > 0 ? mediaN : (e.title || e.description ? 1 : 0)
  }
  return n
}

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
  const [poiDraft, setPoiDraft] = useState(null) // { x, y } percentage on the photo
  const [poiTitle, setPoiTitle] = useState('')
  // area drawing: drawCat = the category being drawn (null when idle)
  const [drawCat, setDrawCat] = useState(null)
  const [draftPoints, setDraftPoints] = useState([])
  const [activeYear, setActiveYear] = useState(null)

  if (!s) return <div className="page-pad">היישוב לא נמצא. <button className="pill ghost" onClick={() => navigate('/')}>חזרה למפה</button></div>

  const mod = canModerate(session.role)
  const editor = canEdit(session.role)
  const section = s.info.find((i) => i.key === tab)
  const areas = s.areas || []

  // The settlement "map" is its historical aerial photo(s). Prefer imageLayers;
  // fall back to a legacy single `historical` image so nothing breaks.
  const layers = (s.imageLayers && s.imageLayers.length)
    ? s.imageLayers.filter((l) => l.url || l.driveId).map((l) => ({ year: l.year || '', src: imageSrc(l) }))
    : (s.historical && (s.historical.url || s.historical.driveId))
      ? [{ year: s.historical.year || '2005', src: imageSrc(s.historical) }]
      : []
  const hasPhoto = layers.length > 0
  const effectiveYear = activeYear || layers[0]?.year || null

  function confirmPoi() {
    if (!poiTitle.trim() || !poiDraft) return
    const poiId = addPoi(s.id, { title: poiTitle.trim(), x: poiDraft.x, y: poiDraft.y, authorName: session.name })
    setPoiDraft(null)
    setPoiTitle('')
    setPinMode(false)
    navigate(`/poi/${s.id}/${poiId}`)
  }

  function startDraw(cat) {
    setDrawCat(cat)
    setDraftPoints([])
    setPinMode(false)
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
          <SectionBody key={tab} settlementId={s.id} sectionKey={tab} section={section} canEdit={mod} />
        </div>

        <div className="closeup-col">
          <div className="closeup-head row wrap gap-6">
            <h3>{hasPhoto ? 'התצלום ההיסטורי' : 'נקודות עניין'}</h3>
            <span className="grow" />
            {editor && hasPhoto && (
              <button className={`pill ${pinMode ? 'is-active' : 'ghost'}`} onClick={() => { setPinMode((v) => !v); cancelDraw() }}>
                <IconPin width={14} height={14} /> {pinMode ? 'לחצו על התצלום…' : 'הוספת נקודה'}
              </button>
            )}
          </div>

          {editor && hasPhoto && (
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
            <p className="muted" style={{ fontSize: '0.8rem', margin: '2px 0 6px' }}>לחצו על התצלום כדי להוסיף פינות לאזור (לפחות 3), ואז "סיום ושמירה".</p>
          )}

          {hasPhoto ? (
            <ImageMap
              className="closeup-image"
              layers={layers}
              activeYear={effectiveYear}
              onYearChange={setActiveYear}
              pois={s.pois}
              areas={areas}
              draftArea={drawCat ? { category: drawCat, points: draftPoints } : null}
              pinMode={pinMode}
              drawMode={!!drawCat}
              onImageClick={(x, y) => {
                if (drawCat) setDraftPoints((p) => [...p, [x, y]])
                else if (pinMode) setPoiDraft({ x, y })
              }}
              onPoiClick={(p) => navigate(`/poi/${s.id}/${p.id}`)}
            />
          ) : (
            <div className="no-photo card">
              <p className="muted">עדיין לא הועלה תצלום ליישוב זה.</p>
              {mod
                ? <p className="muted" style={{ fontSize: '0.85rem' }}>לחצו "עריכת פרטים" למעלה כדי להעלות תצלום 2005 ו-2025.</p>
                : <p className="muted" style={{ fontSize: '0.85rem' }}>הנקודות והסיפורים מופיעים ברשימה למטה.</p>}
            </div>
          )}

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

          {s.pois.length === 0 && !pinMode && hasPhoto && (
            <p className="closeup-empty-note muted">אין עדיין נקודות עניין. {editor ? 'לחצו "הוספת נקודה" ואז על התצלום כדי לסמן בית או אתר.' : 'התחברו כדי להוסיף.'}</p>
          )}

          {s.pois.length > 0 && (
            <div className="poi-list stack gap-8">
              <AnimatePresence>
                {s.pois.map((p) => {
                  const n = countPoiItems(p)
                  return (
                    <motion.div key={p.id} className="poi-list-item" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                      <button className="poi-list-open" onClick={() => navigate(`/poi/${s.id}/${p.id}`)} title={p.title}>
                        <IconPin width={15} height={15} />
                        <strong>{p.title}</strong>
                        <span className={`poi-count ${n === 0 ? 'is-empty' : ''}`} title={`${n} פריטי מדיה`}>{n}</span>
                      </button>
                      {mod && (
                        <button className="icon-btn danger" title="מחיקת נקודה" onClick={() => { if (confirm(`למחוק את "${p.title}" וכל התכנים שבה?`)) deletePoi(s.id, p.id) }}>
                          <IconTrash width={15} height={15} />
                        </button>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <SettlementGallery gallery={s.gallery || []} settlementName={s.name} />

      <Modal open={!!poiDraft} onClose={() => setPoiDraft(null)} title="נקודת עניין חדשה">
        <div className="stack gap-12">
          <label className="lbl">כותרת (למשל: הבית שלנו, בית הכנסת, החממות)</label>
          <input className="field" autoFocus value={poiTitle} onChange={(e) => setPoiTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmPoi()} placeholder="כותרת הנקודה" />
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            מיקום על התצלום: {poiDraft ? `${poiDraft.x.toFixed(1)}%, ${poiDraft.y.toFixed(1)}%` : ''}
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

function SettlementGallery({ gallery, settlementName }) {
  const [lbId, setLbId] = useState(null)
  if (!gallery?.length) return null

  const items = gallery.map((g) => ({
    id: g.id,
    type: 'photo',
    title: g.caption || settlementName,
    url: g.url,
    body: g.credit ? `קרדיט: ${g.credit}` : '',
    authorName: g.credit || 'ויקיפדיה',
  }))

  return (
    <section className="settlement-media card">
      <div className="settlement-media-head">
        <h2>מדיה מהיישוב</h2>
        <span className="muted">תמונות מתוך ויקיפדיה וויקישיתוף</span>
      </div>
      <div className="wiki-gallery">
        {gallery.map((g) => (
          <button key={g.id} type="button" className="wiki-tile" onClick={() => setLbId(g.id)} title={g.caption || 'הגדלה'}>
            <img src={g.thumb || g.url} alt={g.caption || settlementName} loading="lazy" />
            {(g.caption || g.credit) && (
              <figcaption>
                {g.caption || ''}
                {g.caption && g.credit ? ' · ' : ''}
                {g.credit || ''}
              </figcaption>
            )}
          </button>
        ))}
      </div>
      <p className="muted settlement-gallery-credit">
        מקור התמונות: ויקיפדיה / ויקישיתוף ·{' '}
        <a href="https://he.wikipedia.org/" target="_blank" rel="noopener noreferrer">רישיון חופשי</a>
      </p>
      <MediaLightbox
        items={items}
        currentId={lbId}
        onClose={() => setLbId(null)}
        onNavigate={setLbId}
      />
    </section>
  )
}

function SectionBody({ settlementId, sectionKey, section, canEdit }) {
  const body = section?.body || ''
  const entries = sortEntriesByYear(section?.entries || [])
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <SectionEditor
        settlementId={settlementId}
        sectionKey={sectionKey}
        initialBody={body}
        initialEntries={section?.entries || []}
        onDone={() => setEditing(false)}
      />
    )
  }

  const nothing = !body && entries.length === 0

  return (
    <div className="section-body">
      {body && <p>{body}</p>}
      {nothing && <p className="muted">אין עדיין מידע בקטגוריה זו.</p>}

      {entries.length > 0 && (
        <div className="info-timeline">
          {entries.map((e, i) => (
            <motion.div
              key={e.id}
              className="info-entry"
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: Math.min(i * 0.08, 0.4), duration: 0.35 }}
            >
              <span className="info-dot" />
              {e.timeLabel && <span className="pill sm is-active info-time"><IconClock width={12} height={12} /> {e.timeLabel}</span>}
              {e.body && <p>{e.body}</p>}
            </motion.div>
          ))}
        </div>
      )}

      {canEdit && (
        <button className="pill ghost sm" style={{ marginTop: 10 }} onClick={() => setEditing(true)}>
          <IconEdit width={13} height={13} /> עריכה
        </button>
      )}
    </div>
  )
}

function SectionEditor({ settlementId, sectionKey, initialBody, initialEntries, onDone }) {
  const [body, setBody] = useState(initialBody)
  const [entries, setEntries] = useState(() => sortEntriesByYear(initialEntries.map((e) => ({ ...e }))))

  const addEntry = () => setEntries((es) => [...es, { id: `new-${es.length}-${Math.random().toString(36).slice(2, 7)}`, timeLabel: '', body: '' }])
  const setEntry = (i, k, v) => setEntries((es) => es.map((e, j) => (j === i ? { ...e, [k]: v } : e)))
  const removeEntry = (i) => setEntries((es) => es.filter((_, j) => j !== i))
  const move = (i, dir) => setEntries((es) => {
    const j = i + dir
    if (j < 0 || j >= es.length) return es
    const copy = [...es]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    return copy
  })
  const resortByYear = () => setEntries((es) => sortEntriesByYear(es))

  function onTimeBlur() {
    // After typing a year (e.g. 2007), snap the row into chronological place.
    setEntries((es) => sortEntriesByYear(es))
  }

  function save() {
    setInfoSectionFull(settlementId, sectionKey, { body, entries: sortEntriesByYear(entries) })
    onDone()
  }

  return (
    <div className="stack gap-12 section-body">
      <div>
        <label className="lbl">תיאור כללי (רשות)</label>
        <textarea className="field" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="תיאור קצר של הקטגוריה" />
      </div>

      <div className="stack gap-8">
        <div className="row wrap gap-8" style={{ alignItems: 'center' }}>
          <label className="lbl" style={{ margin: 0 }}>שלבים לאורך זמן</label>
          <span className="grow" />
          <button type="button" className="pill ghost sm" onClick={resortByYear} title="ממיין לפי השנה בתווית הזמן">
            סידור לפי שנים
          </button>
        </div>
        <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>
          כשמזינים שנה (למשל 2007) השלב נכנס אוטומטית למקום הנכון על הציר. אפשר גם להזיז ידנית עם החיצים.
        </p>
        {entries.map((e, i) => (
          <div key={e.id} className="entry-edit card">
            <div className="row gap-6" style={{ marginBottom: 6 }}>
              <input
                className="field"
                style={{ flex: '0 0 42%' }}
                value={e.timeLabel}
                onChange={(ev) => setEntry(i, 'timeLabel', ev.target.value)}
                onBlur={onTimeBlur}
                placeholder="זמן (למשל: 2005, ערב המלחמה, 2025)"
              />
              <span className="grow" />
              <button className="icon-btn" title="למעלה" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className="icon-btn" title="למטה" disabled={i === entries.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button className="icon-btn danger" title="הסרה" onClick={() => removeEntry(i)}><IconTrash width={14} height={14} /></button>
            </div>
            <textarea className="field" rows={2} value={e.body} onChange={(ev) => setEntry(i, 'body', ev.target.value)} placeholder="מה היה בשלב הזה" />
          </div>
        ))}
        <button className="pill ghost sm" onClick={addEntry}><IconPlus width={13} height={13} /> הוספת שלב</button>
      </div>

      <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-soft" onClick={onDone}>ביטול</button>
        <button className="btn btn-primary" onClick={save}>שמירה</button>
      </div>
    </div>
  )
}

function EditMetaModal({ open, onClose, settlement }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({})
  const [busySlot, setBusySlot] = useState(-1)
  const [imgErr, setImgErr] = useState('')
  const s = settlement
  const val = (k) => (form[k] !== undefined ? form[k] : s[k] ?? '')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Two aerial-photo slots (2005 / 2025). Prefer imageLayers; migrate a legacy
  // single `historical` image into the first slot.
  const initLayers = (s.imageLayers && s.imageLayers.length)
    ? s.imageLayers
    : (s.historical && (s.historical.url || s.historical.driveId))
      ? [{ year: s.historical.year || '2005', url: s.historical.url, driveId: s.historical.driveId }]
      : []
  const slotYear = [initLayers[0]?.year || '2005', initLayers[1]?.year || '2025']
  const lval = (i, k) => {
    const fk = `L${i}_${k}`
    if (form[fk] !== undefined) return form[fk]
    if (k === 'year') return slotYear[i]
    return initLayers[i]?.[k] ?? ''
  }
  const lset = (i, k) => (e) => setForm((f) => ({ ...f, [`L${i}_${k}`]: e.target.value }))
  const lpreview = (i) => (lval(i, 'driveId') ? imageSrc({ driveId: lval(i, 'driveId') }) : lval(i, 'url'))

  async function onSlotFile(i, e) {
    const f = e.target.files?.[0]
    if (!f) return
    setBusySlot(i)
    setImgErr('')
    try {
      if (isDriveConfigured) {
        const up = await uploadToDrive(f)
        setForm((fm) => ({ ...fm, [`L${i}_driveId`]: up.id, [`L${i}_url`]: up.url }))
      } else {
        const dataUrl = await fileToDataUrl(f)
        setForm((fm) => ({ ...fm, [`L${i}_driveId`]: '', [`L${i}_url`]: dataUrl }))
      }
    } catch {
      setImgErr('ההעלאה נכשלה. נסו קובץ קטן יותר, או הדביקו קישור.')
    } finally {
      setBusySlot(-1)
    }
  }

  function removeSlot(i) {
    setForm((f) => ({ ...f, [`L${i}_url`]: '', [`L${i}_driveId`]: '' }))
  }

  function save() {
    const layers = [0, 1]
      .map((i) => ({
        year: String(lval(i, 'year')).trim() || (i ? '2025' : '2005'),
        url: String(lval(i, 'url')).trim() || undefined,
        driveId: String(lval(i, 'driveId')).trim() || undefined,
      }))
      .filter((l) => l.url || l.driveId)
    updateSettlementMeta(s.id, {
      tagline: val('tagline'),
      evacuatedTo: val('evacuatedTo'),
      population: val('population') === '' ? undefined : Number(val('population')),
      founded: val('founded') === '' ? undefined : Number(val('founded')),
      imageLayers: layers,
      historical: null,
    })
    setForm({})
    onClose()
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
          <summary>תצלומי אוויר של היישוב (לפי שנה)</summary>
          <div className="stack gap-10" style={{ marginTop: 10 }}>
            <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
              העלו תצלום לכל שנה — <b>באותו חיתוך בדיוק</b> (אותו שטח וזווית) — כדי שנקודות העניין יישארו במקומן במעבר בין השנים. התצלום הפעיל משמש כ"מפה" של היישוב.
            </p>
            {[0, 1].map((i) => (
              <div key={i} className="stack gap-6" style={{ border: '1px dashed rgba(180,130,60,0.3)', borderRadius: 10, padding: 10 }}>
                <div className="row gap-10 wrap" style={{ alignItems: 'flex-end' }}>
                  <div style={{ flex: '0 0 90px' }}><label className="lbl">שנה</label><input className="field" dir="ltr" value={lval(i, 'year')} onChange={lset(i, 'year')} placeholder={i ? '2025' : '2005'} /></div>
                  <div style={{ flex: 1, minWidth: 150 }}><label className="lbl">העלאת תצלום</label><input type="file" accept="image/*" onChange={(e) => onSlotFile(i, e)} disabled={busySlot === i} /></div>
                </div>
                {busySlot === i && <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>מעלה…</p>}
                <div><label className="lbl">או קישור (URL)</label><input className="field" dir="ltr" value={lval(i, 'url')} onChange={lset(i, 'url')} placeholder="https://…" /></div>
                {lpreview(i) && (
                  <div className="stack gap-6">
                    <img src={lpreview(i)} alt={`תצוגה מקדימה ${lval(i, 'year')}`} style={{ maxWidth: '100%', borderRadius: 8 }} />
                    <button className="pill ghost sm" onClick={() => removeSlot(i)} type="button" style={{ alignSelf: 'flex-start' }}>הסרת התצלום</button>
                  </div>
                )}
              </div>
            ))}
            {imgErr && <p style={{ color: '#d9534f', fontSize: '0.85rem', margin: 0 }}>{imgErr}</p>}
          </div>
        </details>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-soft danger-btn" onClick={remove}><IconTrash width={15} height={15} /> מחיקת יישוב</button>
          <button className="btn btn-primary" onClick={save} disabled={busySlot >= 0}>שמירה</button>
        </div>
      </div>
    </Modal>
  )
}
