import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPin, IconEdit } from '../ui/Icons.jsx'
import { addSettlement, moveSettlement } from '../../data/store.js'
import { useSession, canModerate } from '../../data/session.js'
import Modal from '../ui/Modal.jsx'
import LeafletMap from './LeafletMap.jsx'

// Regional overview on a real Leaflet map. Moderators can enter "pin mode" to
// place a new settlement, or "move mode" to reposition existing ones (an
// explicit toggle, so nothing moves by accident).
export default function RegionMap({ region, settlements }) {
  const navigate = useNavigate()
  const session = useSession()
  const mod = canModerate(session.role)
  const [pinMode, setPinMode] = useState(false)
  const [moveMode, setMoveMode] = useState(false)
  const [draft, setDraft] = useState(null) // {lat,lng}
  const [name, setName] = useState('')

  const markers = settlements.map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    label: s.name,
    count: s.pois.length || 0,
    kind: 'settlement',
  }))

  function confirmPin() {
    if (!name.trim() || !draft) return
    const id = addSettlement({ name: name.trim(), region, lat: draft.lat, lng: draft.lng })
    setDraft(null)
    setName('')
    setPinMode(false)
    navigate(`/settlement/${id}`)
  }

  return (
    <div className="region-wrap">
      {mod && (
        <div className="map-toolbar">
          <button className={`pill ${pinMode ? 'is-active' : 'ghost'}`} onClick={() => { setPinMode((v) => !v); setMoveMode(false) }}>
            <IconPin width={14} height={14} /> {pinMode ? 'לחצו על המפה למיקום…' : 'נעיצת יישוב'}
          </button>
          <button className={`pill ${moveMode ? 'is-active' : 'ghost'}`} onClick={() => { setMoveMode((v) => !v); setPinMode(false) }}>
            <IconEdit width={14} height={14} /> {moveMode ? 'גררו נעיצה ושחררו לשמירה' : 'הזזת יישובים'}
          </button>
        </div>
      )}

      <LeafletMap
        className="region-map"
        markers={markers}
        fitKey={region}
        pinMode={pinMode}
        draggableMarkers={moveMode}
        onMarkerClick={(m) => navigate(`/settlement/${m.id}`)}
        onMapClick={(latlng) => setDraft({ lat: latlng.lat, lng: latlng.lng })}
        onMarkerMove={(m, latlng) => moveSettlement(m.id, latlng.lat, latlng.lng)}
      />

      <Modal open={!!draft} onClose={() => setDraft(null)} title="יישוב חדש">
        <div className="stack gap-12">
          <label className="lbl">שם היישוב</label>
          <input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="שם היישוב" onKeyDown={(e) => e.key === 'Enter' && confirmPin()} />
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            מיקום: {draft ? `${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}` : ''}
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={confirmPin} disabled={!name.trim()}>נעיצה</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
