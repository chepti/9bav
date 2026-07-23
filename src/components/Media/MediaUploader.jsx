import { useState } from 'react'
import { addMedia } from '../../data/store.js'
import { useSession } from '../../data/session.js'
import { MEDIA_ICONS } from '../ui/Icons.jsx'

const TYPES = [
  { key: 'text', label: 'טקסט' },
  { key: 'photo', label: 'תמונה' },
  { key: 'video', label: 'וידאו' },
  { key: 'document', label: 'מסמך' },
]

// Reads a File into a data-URL. For the local prototype this keeps everything
// self-contained; a real backend would upload the File and store a URL.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function MediaUploader({ settlementId, poiId, phase, onDone }) {
  const session = useSession()
  const [type, setType] = useState('text')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [timeLabel, setTimeLabel] = useState('')
  const [approximate, setApproximate] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      setUrl(dataUrl)
      setFileName(file.name)
      if (!title) setTitle(file.name)
    } finally {
      setBusy(false)
    }
  }

  function submit() {
    const item = {
      type,
      title: title.trim(),
      body: body.trim(),
      url: url || undefined,
      authorName: session.name || 'אנונימי',
    }
    if (phase === 'during') {
      item.timeLabel = timeLabel.trim() || undefined
      item.approximate = approximate
    }
    addMedia(settlementId, poiId, phase, item)
    onDone?.()
  }

  const needsFile = type === 'photo' || type === 'video' || type === 'document'
  const accept = type === 'photo' ? 'image/*' : type === 'video' ? 'video/*' : undefined
  const valid = (type === 'text' ? body.trim().length > 0 : !!url) && (phase !== 'during' || timeLabel.trim().length > 0)

  return (
    <div className="stack gap-16">
      <div className="row wrap gap-6">
        {TYPES.map((t) => {
          const Icon = MEDIA_ICONS[t.key]
          return (
            <button key={t.key} className={`pill ${type === t.key ? 'is-active' : 'ghost'}`} onClick={() => setType(t.key)}>
              <Icon width={14} height={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {phase === 'during' && (
        <div className="row gap-12 wrap">
          <div style={{ flex: '1 1 140px' }}>
            <label className="lbl">שעה (למשל 09:15)</label>
            <input className="field" value={timeLabel} onChange={(e) => setTimeLabel(e.target.value)} placeholder="HH:MM" inputMode="numeric" />
          </div>
          <label className="row gap-6" style={{ marginTop: 22, cursor: 'pointer' }}>
            <input type="checkbox" checked={approximate} onChange={(e) => setApproximate(e.target.checked)} />
            <span>שעה משוערת (~)</span>
          </label>
        </div>
      )}

      <div>
        <label className="lbl">כותרת (רשות)</label>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="כותרת קצרה" />
      </div>

      {type === 'text' ? (
        <div>
          <label className="lbl">הטקסט</label>
          <textarea className="field" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="ספרו את הסיפור..." />
        </div>
      ) : (
        <div>
          <label className="lbl">{needsFile ? 'קובץ' : 'קישור'}</label>
          <input type="file" accept={accept} onChange={onFile} />
          {fileName && <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>נבחר: {fileName}</p>}
          <label className="lbl" style={{ marginTop: 10 }}>תיאור / כיתוב (רשות)</label>
          <textarea className="field" rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="כיתוב לתמונה / תיאור" />
        </div>
      )}

      <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-soft" onClick={onDone}>ביטול</button>
        <button className="btn btn-primary" disabled={!valid || busy} onClick={submit}>
          {busy ? 'טוען…' : 'הוספה'}
        </button>
      </div>
      <p className="muted" style={{ fontSize: '0.78rem' }}>
        הפריט יסומן כ"ממתין לאישור" עד שמודרטור היישוב יאשר אותו.
      </p>
    </div>
  )
}
