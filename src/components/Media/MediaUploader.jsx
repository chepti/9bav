import { useState, useEffect } from 'react'
import { addMedia } from '../../data/store.js'
import { useSession, authorKey } from '../../data/session.js'
import { uploadToDrive, isDriveConfigured } from '../../data/drive.js'
import { youtubeIdFromUrl } from '../../data/media.js'
import { buildWhenFields, DEFAULT_EXPULSION_DATE, gregorianToHebrew, formatWhenDisplay } from '../../data/when.js'
import { MEDIA_ICONS } from '../ui/Icons.jsx'
import WhenFields from './WhenFields.jsx'

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

/**
 * @param {object} [initialWhen] — prefill date/time (e.g. add media to an existing moment)
 * @param {boolean} [lockWhen] — keep the moment's when fixed (don't show editors)
 */
export default function MediaUploader({ settlementId, poiId, phase, onDone, initialWhen = null, lockWhen = false }) {
  const session = useSession()
  const [type, setType] = useState('text')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState(null)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [dateGregorian, setDateGregorian] = useState(DEFAULT_EXPULSION_DATE)
  const [dateHebrew, setDateHebrew] = useState(() => gregorianToHebrew(DEFAULT_EXPULSION_DATE))
  const [timeLabel, setTimeLabel] = useState('')
  const [approximate, setApproximate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!initialWhen) return
    setDateGregorian(initialWhen.dateGregorian || '')
    setDateHebrew(
      initialWhen.dateHebrew
      || (initialWhen.dateGregorian ? gregorianToHebrew(initialWhen.dateGregorian) : ''),
    )
    setTimeLabel(initialWhen.timeLabel || '')
    setApproximate(!!initialWhen.approximate)
  }, [initialWhen])

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
        Object.assign(item, buildWhenFields({ dateGregorian, dateHebrew, timeLabel, approximate }))
      }
      if (type === 'video' && ytId && !file) {
        item.url = `https://www.youtube.com/watch?v=${ytId}`
      } else if (type !== 'text' && file) {
        if (isDriveConfigured) {
          const up = await uploadToDrive(file)
          item.url = up.url
          item.driveId = up.id
        } else {
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
  const hasWhen = !!(timeLabel.trim() || dateGregorian || dateHebrew.trim())
  const valid =
    (type === 'text'
      ? body.trim().length > 0
      : type === 'video'
        ? hasVideoSource
        : !!file) &&
    (phase !== 'during' || hasWhen)

  const lockedLabel = formatWhenDisplay({
    dateGregorian,
    dateHebrew,
    timeLabel,
    approximate,
  })

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

      {phase === 'during' && lockWhen && (
        <div className="when-locked">
          <span className="pill sm is-active">{lockedLabel || 'רגע נבחר'}</span>
        </div>
      )}

      {phase === 'during' && !lockWhen && (
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
    </div>
  )
}
