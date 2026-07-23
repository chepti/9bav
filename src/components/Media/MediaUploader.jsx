import { useState } from 'react'
import { addMedia } from '../../data/store.js'
import { useSession, authorKey } from '../../data/session.js'
import { uploadToDrive, isDriveConfigured } from '../../data/drive.js'
import { youtubeIdFromUrl } from '../../data/media.js'
import { MEDIA_ICONS } from '../ui/Icons.jsx'

const TYPES = [
  { key: 'text', label: 'טקסט' },
  { key: 'photo', label: 'תמונה' },
  { key: 'video', label: 'וידאו' },
  { key: 'document', label: 'מסמך' },
]

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
  const [file, setFile] = useState(null)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [timeLabel, setTimeLabel] = useState('')
  const [approximate, setApproximate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const ytId = youtubeIdFromUrl(youtubeUrl)

  function selectType(key) {
    setType(key)
    setFile(null)
    setYoutubeUrl('')
    setErr('')
  }

  function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setYoutubeUrl('')
    if (!title) setTitle(f.name)
  }

  async function submit() {
    setBusy(true)
    setErr('')
    try {
      const item = {
        type,
        title: title.trim(),
        body: body.trim(),
        authorName: session.name || 'אנונימי',
        authorKey: authorKey(session) || undefined,
      }
      if (phase === 'during') {
        item.timeLabel = timeLabel.trim() || undefined
        item.approximate = approximate
      }
      if (type === 'video' && ytId && !file) {
        item.url = `https://www.youtube.com/watch?v=${ytId}`
      } else if (type !== 'text' && file) {
        if (isDriveConfigured) {
          const up = await uploadToDrive(file)
          item.url = up.url
          item.driveId = up.id
        } else {
          // offline prototype: inline as data-URL
          item.url = await fileToDataUrl(file)
        }
      }
      addMedia(settlementId, poiId, phase, item)
      onDone?.()
    } catch (e) {
      console.error(e)
      setErr('ההעלאה נכשלה. נסו שוב, או קובץ קטן יותר.')
    } finally {
      setBusy(false)
    }
  }

  const needsFile = type === 'photo' || type === 'document'
  const accept = type === 'photo' ? 'image/*' : type === 'video' ? 'video/*' : undefined
  const hasVideoSource = type === 'video' && (!!file || !!ytId)
  const valid =
    (type === 'text'
      ? body.trim().length > 0
      : type === 'video'
        ? hasVideoSource
        : !!file) &&
    (phase !== 'during' || timeLabel.trim().length > 0)

  return (
    <div className="stack gap-16">
      <div className="row wrap gap-6">
        {TYPES.map((t) => {
          const Icon = MEDIA_ICONS[t.key]
          return (
            <button key={t.key} className={`pill ${type === t.key ? 'is-active' : 'ghost'}`} onClick={() => selectType(t.key)}>
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
      ) : type === 'video' ? (
        <div className="stack gap-12">
          <div>
            <label className="lbl">קישור ליוטיוב</label>
            <input
              className="field"
              value={youtubeUrl}
              onChange={(e) => { setYoutubeUrl(e.target.value); setFile(null) }}
              placeholder="https://www.youtube.com/watch?v=… או https://youtu.be/…"
              dir="ltr"
              inputMode="url"
              autoComplete="off"
            />
            {youtubeUrl.trim() && !ytId && (
              <p style={{ color: '#d9534f', fontSize: '0.8rem', marginTop: 6 }}>לא זוהה קישור יוטיוב תקין</p>
            )}
            {ytId && (
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>הקישור תקין — יוצג כהטמעה בדף</p>
            )}
          </div>
          <div>
            <label className="lbl">או העלאת קובץ וידאו</label>
            <input type="file" accept={accept} onChange={onFile} />
            {file && <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>נבחר: {file.name} ({Math.round(file.size / 1024)} KB)</p>}
          </div>
          <div>
            <label className="lbl">תיאור / כיתוב (רשות)</label>
            <textarea className="field" rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="כיתוב לסרטון / תיאור" />
          </div>
        </div>
      ) : (
        <div>
          <label className="lbl">{needsFile ? 'קובץ' : 'קישור'}</label>
          <input type="file" accept={accept} onChange={onFile} />
          {file && <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>נבחר: {file.name} ({Math.round(file.size / 1024)} KB)</p>}
          <label className="lbl" style={{ marginTop: 10 }}>תיאור / כיתוב (רשות)</label>
          <textarea className="field" rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="כיתוב לתמונה / תיאור" />
        </div>
      )}

      {err && <p style={{ color: '#d9534f', fontSize: '0.85rem' }}>{err}</p>}

      <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-soft" onClick={onDone} disabled={busy}>ביטול</button>
        <button className="btn btn-primary" disabled={!valid || busy} onClick={submit}>
          {busy ? 'מעלה…' : 'הוספה'}
        </button>
      </div>
      <p className="muted" style={{ fontSize: '0.78rem' }}>
        הפריט יפורסם מיד. מודרטור יכול למחוק אותו אם צריך.
      </p>
    </div>
  )
}
