import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore, getSettlements } from '../data/store.js'
import { REGIONS } from '../data/seed.js'
import RegionMap from './Map/RegionMap.jsx'

export default function Home() {
  useStore()
  const [region, setRegion] = useState('gush_katif')
  const all = getSettlements()
  const settlements = all.filter((s) => s.region === region)
  const r = REGIONS[region]

  const totalPois = settlements.reduce((n, s) => n + s.pois.length, 0)
  const totalPop = settlements.reduce((n, s) => n + (s.population || 0), 0)

  return (
    <div className="home">
      <section className="home-intro">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="pill">פרויקט תיעוד קהילתי</span>
          <h1 className="home-title">לתעד. לזכור. לשקם.</h1>
          <p className="home-lede">
            סיפורו של יום עקירה. פירוק של קהילות שצמחו על החול.
            כאן, כל מי שגורש מגוש קטיף ומצפון השומרון יכול לנעוץ את הבית שלו על המפה
            ולספר את הסיפור: איך זה נראה לפני, מה קרה ביום הגירוש, והדרך אל הבנייה והשיקום.
          </p>
        </motion.div>
      </section>

      <div className="region-toggle row gap-8">
        {Object.values(REGIONS).map((reg) => (
          <button key={reg.id} className={`pill ${region === reg.id ? 'is-active' : 'ghost'}`} onClick={() => setRegion(reg.id)}>
            {reg.name}
          </button>
        ))}
      </div>

      <motion.div className="region-blurb card" key={region} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="row wrap gap-8" style={{ marginBottom: 8 }}>
          <h2>{r.name}</h2>
          <span className="pill sm ghost">{r.subtitle}</span>
          <span className="grow" />
          <span className="meta-chip">{settlements.length} יישובים</span>
          {totalPop > 0 && <span className="meta-chip">{totalPop.toLocaleString('he-IL')} תושבים</span>}
          <span className="meta-chip">{totalPois} נקודות עניין</span>
        </div>
        <p className="muted">{r.blurb}</p>
      </motion.div>

      <RegionMap region={region} settlements={settlements} />

      <p className="map-hint muted">לחצו על נקודת יישוב כדי להיכנס אליו. מודרטורים יכולים לנעוץ יישוב חדש; תושבים מוסיפים נקודות עניין וסיפורים.</p>

      <p className="home-credit muted">תודה לבן ציון מקלס על צילומי הלוויין והעדכון לשנת 2025</p>
    </div>
  )
}
