import { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { signIn, signInGoogle, isLiveAuth } from '../../data/session.js'

const ROLES = [
  { key: 'resident', label: 'תושב/ת שגורש/ה', desc: 'הוספת נקודות עניין, סיפורים ומדיה על הבית שלכם.' },
  { key: 'moderator', label: 'מודרטור יישוב', desc: 'נעיצת יישובים, עריכת מידע כללי ואישור תכנים.' },
]

export default function SignInModal({ open, onClose }) {
  if (isLiveAuth()) return <GoogleSignIn open={open} onClose={onClose} />
  return <LocalSignIn open={open} onClose={onClose} />
}

function GoogleSignIn({ open, onClose }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function go() {
    setBusy(true)
    setErr('')
    try {
      await signInGoogle()
      onClose()
    } catch (e) {
      setErr('הכניסה נכשלה. נסו שוב.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="כניסה">
      <div className="stack gap-16">
        <p className="muted" style={{ fontSize: '0.92rem' }}>
          התחברו כדי לנעוץ את הבית שלכם ולהוסיף סיפורים, תמונות ומסמכים.
          התכנים שתוסיפו יופיעו לצד שמכם וימתינו לאישור מודרטור.
        </p>
        <button className="btn btn-primary" disabled={busy} onClick={go} style={{ justifyContent: 'center' }}>
          {busy ? 'מתחבר…' : 'התחברות עם Google'}
        </button>
        {err && <p style={{ color: '#d9534f', fontSize: '0.85rem' }}>{err}</p>}
      </div>
    </Modal>
  )
}

function LocalSignIn({ open, onClose }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('resident')

  function go() {
    signIn(name.trim() || 'אורח/ת', role)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="כניסה לעריכה">
      <div className="stack gap-16">
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          מצב הדגמה מקומי. בחרו תפקיד כדי לנסות את הממשק (הנתונים נשמרים בדפדפן זה בלבד).
        </p>
        <div>
          <label className="lbl">השם שיוצג לצד התכנים</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: משפחת כהן, נווה דקלים" />
        </div>
        <div className="stack gap-8">
          {ROLES.map((r) => (
            <button
              key={r.key}
              className={`role-option ${role === r.key ? 'is-active' : ''}`}
              onClick={() => setRole(r.key)}
            >
              <strong>{r.label}</strong>
              <span className="muted">{r.desc}</span>
            </button>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={go}>כניסה</button>
        </div>
      </div>
    </Modal>
  )
}
