import { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { signIn } from '../../data/session.js'

const ROLES = [
  { key: 'resident', label: 'תושב/ת שגורש/ה', desc: 'הוספת נקודות עניין, סיפורים ומדיה על הבית שלכם.' },
  { key: 'moderator', label: 'מודרטור יישוב', desc: 'נעיצת יישובים, עריכת מידע כללי ואישור תכנים.' },
]

export default function SignInModal({ open, onClose }) {
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
          זהו אב־טיפוס. בגרסה החיה המודרטורים יאושרו מראש ותהיה כניסה מאובטחת.
          כאן אפשר לבחור תפקיד כדי לנסות את הממשק.
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
