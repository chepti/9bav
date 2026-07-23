import { useState } from 'react'
import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import { useSession, signOut } from './data/session.js'
import { resetToSeed, isLive } from './data/store.js'
import { IconUser, IconSeed } from './components/ui/Icons.jsx'
import SignInModal from './components/Auth/SignInModal.jsx'
import Home from './components/Home.jsx'
import SettlementView from './components/Settlement/SettlementView.jsx'
import PoiView from './components/Poi/PoiView.jsx'

const ROLE_LABEL = { moderator: 'מודרטור', resident: 'תושב/ת', guest: 'אורח/ת' }

function Header({ onSignIn }) {
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
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Header onSignIn={() => setSignInOpen(true)} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settlement/:id" element={<SettlementView />} />
          <Route path="/poi/:settlementId/:poiId" element={<PoiView />} />
        </Routes>
      </main>
      <Footer />
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </HashRouter>
  )
}
