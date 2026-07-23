import { useState } from 'react'
import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import { useSession, signOut } from './data/session.js'
import { resetToSeed, isLive } from './data/store.js'
import { useVisitorCount } from './data/visits.js'
import { IconUser, IconSeed, IconTrash, IconMail } from './components/ui/Icons.jsx'

const WHATSAPP_URL = 'https://wa.me/972544477081' // 054-4477081
import SignInModal from './components/Auth/SignInModal.jsx'
import AdminPanel from './components/Admin/AdminPanel.jsx'
import Home from './components/Home.jsx'
import SettlementView from './components/Settlement/SettlementView.jsx'
import PoiView from './components/Poi/PoiView.jsx'

const ROLE_LABEL = { moderator: 'מודרטור', resident: 'תושב/ת', guest: 'אורח/ת' }

function Header({ onSignIn, onAdmin }) {
  const session = useSession()
  return (
    <header className="app-header">
      <Link to="/" className="brand">
        <span className="brand-mark">ק</span>
        <span className="brand-text">
          <strong>גוש קטיף</strong>
          <em>תיעוד הגירוש</em>
        </span>
      </Link>
      <span className="grow" />
      {session.role === 'guest' ? (
        <button className="pill" onClick={onSignIn}><IconUser width={15} height={15} /> כניסה לעריכה</button>
      ) : (
        <div className="row gap-8">
          {session.role === 'moderator' && (
            <button className="pill" onClick={onAdmin}><IconTrash width={14} height={14} /> ניהול</button>
          )}
          <span className="pill ghost sm">{ROLE_LABEL[session.role]} · {session.name}</span>
          <button className="pill ghost sm" onClick={signOut}>יציאה</button>
        </div>
      )}
    </header>
  )
}

function Footer() {
  const session = useSession()
  const live = isLive()
  const visits = useVisitorCount()
  // In live mode only a moderator can seed, and it writes to the shared DB.
  const showSeed = live ? session.role === 'moderator' : true
  const label = live ? 'טעינת יישובים ראשוניים' : 'איפוס הדגמה'
  const confirmText = live
    ? 'לכתוב את רשימת היישובים הראשונית למסד הנתונים המשותף? (פעולה חד־פעמית לאתחול)'
    : 'לאפס את כל התוכן לנתוני ההדגמה?'
  return (
    <footer className="app-footer">
      <span className="muted">
        פרויקט תיעוד קהילתי · {live ? 'מערכת חיה' : 'מצב הדגמה מקומי'}
      </span>
      <span className="grow" />
      {visits != null && (
        <span className="muted visit-count" title="כניסות לאתר">
          <span aria-hidden="true">👁️</span> {visits.toLocaleString('he-IL')} כניסות
        </span>
      )}
      <a className="pill ghost sm" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" title="פנייה בוואטסאפ">
        <IconMail width={13} height={13} /> פנייה
      </a>
      {showSeed && (
        <button className="pill ghost sm" onClick={() => { if (confirm(confirmText)) resetToSeed() }}>
          <IconSeed width={13} height={13} /> {label}
        </button>
      )}
    </footer>
  )
}

export default function App() {
  const [signInOpen, setSignInOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Header onSignIn={() => setSignInOpen(true)} onAdmin={() => setAdminOpen(true)} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settlement/:id" element={<SettlementView />} />
          <Route path="/poi/:settlementId/:poiId" element={<PoiView />} />
        </Routes>
      </main>
      <Footer />
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
    </HashRouter>
  )
}
