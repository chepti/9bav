import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../ui/Modal.jsx'
import { useRoles, addRole, removeRole } from '../../data/roles.js'
import { useStore, getSettlements, setMediaStatus, deleteMedia, deleteSettlement } from '../../data/store.js'
import { useSession, isLiveAuth } from '../../data/session.js'
import { MEDIA_ICONS, IconCheck, IconTrash, IconUser, IconPin } from '../ui/Icons.jsx'

const REGION_LABEL = { gush_katif: 'גוש קטיף', northern_samaria: 'צפון השומרון' }

export default function AdminPanel({ open, onClose }) {
  const [tab, setTab] = useState('queue')
  return (
    <Modal open={open} onClose={onClose} title="ניהול ומודרציה" wide>
      <div className="row wrap gap-6" style={{ marginBottom: 16 }}>
        <button className={`pill ${tab === 'queue' ? 'is-active' : 'ghost'}`} onClick={() => setTab('queue')}>
          <IconCheck width={14} height={14} /> ממתין לאישור
        </button>
        <button className={`pill ${tab === 'settlements' ? 'is-active' : 'ghost'}`} onClick={() => setTab('settlements')}>
          <IconPin width={14} height={14} /> יישובים
        </button>
        <button className={`pill ${tab === 'mods' ? 'is-active' : 'ghost'}`} onClick={() => setTab('mods')}>
          <IconUser width={14} height={14} /> מודרטורים
        </button>
      </div>
      {tab === 'queue' && <ModerationQueue onClose={onClose} />}
      {tab === 'settlements' && <SettlementsAdmin onClose={onClose} />}
      {tab === 'mods' && <Moderators />}
    </Modal>
  )
}

// ---------- Settlements: clean up duplicates / delete ----------
function SettlementsAdmin({ onClose }) {
  useStore()
  const navigate = useNavigate()
  const settlements = getSettlements()

  const sorted = useMemo(
    () => [...settlements].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he')),
    [settlements],
  )

  // Flag names that appear more than once so duplicates are easy to spot.
  const dupNames = useMemo(() => {
    const count = {}
    settlements.forEach((s) => { count[s.name] = (count[s.name] || 0) + 1 })
    return new Set(Object.keys(count).filter((n) => count[n] > 1))
  }, [settlements])

  return (
    <div className="stack gap-8">
      <p className="muted" style={{ fontSize: '0.86rem' }}>
        {sorted.length} יישובים. שם שמופיע יותר מפעם אחת מסומן ככפילות.
      </p>
      {sorted.map((s) => (
        <div key={s.id} className="queue-item">
          <span className="media-type-badge"><IconPin width={14} height={14} /></span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row gap-6 wrap">
              <strong>{s.name}</strong>
              {dupNames.has(s.name) && <span className="pill sm pending-pill">כפילות</span>}
            </div>
            <span className="muted" style={{ fontSize: '0.78rem' }}>
              {REGION_LABEL[s.region] || s.region} · {(s.pois || []).length} נקודות עניין
            </span>
          </div>
          <div className="row gap-6">
            <button className="pill sm ghost" onClick={() => { onClose(); navigate(`/settlement/${s.id}`) }}>פתח</button>
            <button className="pill sm ghost danger" onClick={() => { if (confirm(`למחוק את "${s.name}" וכל התכנים שבו?`)) deleteSettlement(s.id) }}>
              <IconTrash width={13} height={13} /> מחיקה
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- Moderation queue: pending media across all settlements ----------
function ModerationQueue({ onClose }) {
  useStore()
  const navigate = useNavigate()
  const settlements = getSettlements()

  const pending = useMemo(() => {
    const out = []
    for (const s of settlements) {
      for (const p of s.pois || []) {
        const collect = (arr, phase) =>
          (arr || []).forEach((m) => {
            if (m.status === 'pending') out.push({ m, phase, s, p })
          })
        collect(p.before, 'לפני')
        collect(p.during, 'ביום הגירוש')
        ;(p.after || []).forEach((d) => collect(d.media, `אחרי · ${d.dateLabel}`))
      }
    }
    return out.sort((a, b) => (b.m.createdAt || 0) - (a.m.createdAt || 0))
  }, [settlements])

  if (pending.length === 0) {
    return <p className="muted" style={{ textAlign: 'center', padding: 24 }}>אין פריטים הממתינים לאישור. הכל נקי. 🌱</p>
  }

  return (
    <div className="stack gap-8">
      <p className="muted" style={{ fontSize: '0.86rem' }}>{pending.length} פריטים ממתינים לאישור:</p>
      {pending.map(({ m, phase, s, p }) => {
        const Icon = MEDIA_ICONS[m.type] || MEDIA_ICONS.text
        return (
          <div key={m.id} className="queue-item">
            <span className="media-type-badge"><Icon width={14} height={14} /></span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row gap-6 wrap">
                <strong>{m.title || m.body?.slice(0, 40) || 'ללא כותרת'}</strong>
                {m.timeLabel && <span className="pill sm ghost">{m.approximate ? '~' : ''}{m.timeLabel}</span>}
              </div>
              <span className="muted" style={{ fontSize: '0.78rem' }}>
                {s.name} · {p.title} · {phase} · {m.authorName}
              </span>
            </div>
            <div className="row gap-6">
              <button className="pill sm ghost" onClick={() => { onClose(); navigate(`/poi/${s.id}/${p.id}`) }}>פתח</button>
              <button className="pill sm is-active" onClick={() => setMediaStatus(s.id, p.id, m.id, 'approved')}><IconCheck width={13} height={13} /></button>
              <button className="pill sm ghost danger" onClick={() => { if (confirm('למחוק את הפריט?')) deleteMedia(s.id, p.id, m.id) }}><IconTrash width={13} height={13} /></button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Moderators: assign roles by email ----------
function Moderators() {
  useStore()
  const session = useSession()
  const roles = useRoles()
  const settlements = getSettlements()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('moderator')
  const [settlementId, setSettlementId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function add() {
    const clean = email.trim().toLowerCase()
    if (!clean || !clean.includes('@')) {
      setErr('כתובת מייל לא תקינה')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const st = settlements.find((s) => s.id === settlementId)
      await addRole({
        email: clean,
        role,
        settlementId: settlementId || null,
        settlementName: st?.name || null,
        addedBy: session.email || session.name || null,
      })
      setEmail('')
      setSettlementId('')
    } catch (e) {
      setErr('ההוספה נכשלה. נסו שוב.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack gap-16">
      {!isLiveAuth() && (
        <p className="muted" style={{ fontSize: '0.84rem' }}>
          במצב הדגמה מקומי השיוך נשמר בדפדפן זה בלבד. במערכת החיה הוא חל על כל המשתמשים.
        </p>
      )}
      <div className="admin-add card" style={{ padding: 14 }}>
        <div className="stack gap-8">
          <div>
            <label className="lbl">כתובת מייל (Google)</label>
            <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" dir="ltr" />
          </div>
          <div className="row gap-8 wrap">
            <div style={{ flex: '1 1 140px' }}>
              <label className="lbl">תפקיד</label>
              <select className="field" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="moderator">מודרטור</option>
                <option value="resident">תושב/ת</option>
              </select>
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label className="lbl">יישוב (רשות)</label>
              <select className="field" value={settlementId} onChange={(e) => setSettlementId(e.target.value)}>
                <option value="">— כללי —</option>
                {settlements.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          {err && <p style={{ color: '#d9534f', fontSize: '0.85rem' }}>{err}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" disabled={busy} onClick={add}>הוספה</button>
          </div>
        </div>
      </div>

      <div className="stack gap-6">
        <h4 style={{ margin: '4px 0' }}>מוסמכים ({roles.length})</h4>
        {roles.length === 0 && <p className="muted" style={{ fontSize: '0.86rem' }}>עדיין לא הוגדרו מודרטורים.</p>}
        {roles.map((r) => (
          <div key={r.email} className="queue-item">
            <span className="media-type-badge">{r.role === 'moderator' ? <IconUser width={14} height={14} /> : <IconPin width={14} height={14} />}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <strong dir="ltr" style={{ display: 'block', textAlign: 'right' }}>{r.email}</strong>
              <span className="muted" style={{ fontSize: '0.78rem' }}>
                {r.role === 'moderator' ? 'מודרטור' : 'תושב/ת'}{r.settlementName ? ` · ${r.settlementName}` : ' · כללי'}
              </span>
            </div>
            <button className="pill sm ghost danger" onClick={() => { if (confirm(`להסיר את ${r.email}?`)) removeRole(r.email) }}>
              <IconTrash width={13} height={13} /> הסרה
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
