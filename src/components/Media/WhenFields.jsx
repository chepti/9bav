import { useState, useEffect } from 'react'
import { gregorianToHebrew, hebrewToGregorian, DEFAULT_EXPULSION_DATE } from '../../data/when.js'

/**
 * Date + time inputs for "during" moments.
 * Gregorian ↔ Hebrew sync via @hebcal/core.
 */
export default function WhenFields({
  dateGregorian,
  dateHebrew,
  timeLabel,
  approximate,
  onChange,
}) {
  const [hebErr, setHebErr] = useState('')

  // Keep Hebrew in sync when Gregorian changes from outside
  useEffect(() => {
    if (!dateGregorian) return
    const heb = gregorianToHebrew(dateGregorian)
    if (heb && heb !== dateHebrew) onChange({ dateHebrew: heb })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to gregorian
  }, [dateGregorian])

  function setGregorian(iso) {
    const heb = iso ? gregorianToHebrew(iso) : ''
    setHebErr('')
    onChange({ dateGregorian: iso, dateHebrew: heb })
  }

  function onHebrewBlur() {
    const raw = (dateHebrew || '').trim()
    if (!raw) {
      setHebErr('')
      return
    }
    const g = hebrewToGregorian(raw)
    if (!g) {
      setHebErr('לא זוהה תאריך עברי. נסו למשל: י׳ באב תשס״ה')
      return
    }
    setHebErr('')
    const heb = gregorianToHebrew(g)
    onChange({ dateGregorian: g, dateHebrew: heb || raw })
  }

  return (
    <div className="stack gap-12 when-fields">
      <div className="row gap-12 wrap">
        <div style={{ flex: '1 1 160px' }}>
          <label className="lbl">תאריך לועזי</label>
          <input
            className="field"
            type="date"
            value={dateGregorian || ''}
            onChange={(e) => setGregorian(e.target.value)}
          />
          <p className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
            ברירת מחדל ללא תאריך: {DEFAULT_EXPULSION_DATE.split('-').reverse().join('.')} (תחילת הפינוי)
          </p>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label className="lbl">תאריך עברי</label>
          <input
            className="field"
            value={dateHebrew || ''}
            onChange={(e) => { setHebErr(''); onChange({ dateHebrew: e.target.value }) }}
            onBlur={onHebrewBlur}
            placeholder="י׳ באב תשס״ה"
          />
          {hebErr
            ? <p style={{ color: '#d9534f', fontSize: '0.78rem', marginTop: 4 }}>{hebErr}</p>
            : <p className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>מסונכרן אוטומטית עם הלועזי (Hebcal)</p>}
        </div>
      </div>
      <div className="row gap-12 wrap">
        <div style={{ flex: '1 1 120px' }}>
          <label className="lbl">שעה</label>
          <input
            className="field"
            value={timeLabel || ''}
            onChange={(e) => onChange({ timeLabel: e.target.value })}
            placeholder="HH:MM"
            inputMode="numeric"
            dir="ltr"
          />
        </div>
        <label className="row gap-6" style={{ marginTop: 22, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!approximate}
            onChange={(e) => onChange({ approximate: e.target.checked })}
          />
          <span>זמן משוער (~)</span>
        </label>
      </div>
    </div>
  )
}
