import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Reusable Leaflet map. Used both for the regional overview and the settlement
// close-up. Markers are custom divIcons (dot + always-visible label that grows
// on hover). Callbacks/flags are held in refs so toggling pin-mode or changing
// handlers never forces a full marker re-draw or map re-init.

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

function markerHtml(m) {
  const kind = m.kind || 'settlement'
  const count = m.count ? `<em class="gk-count">${m.count}</em>` : ''
  // pin SVG rotates via CSS; label sits below and is always visible
  return `
    <div class="gk-marker gk-${kind}">
      <span class="gk-pin">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>
        </svg>
      </span>
      <span class="gk-label">${escapeHtml(m.label)}${count}</span>
    </div>`
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export default function LeafletMap({ markers = [], onMarkerClick, onMapClick, onMarkerMove, draggableMarkers = false, pinMode = false, closeup = false, center = null, className = '' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const groupRef = useRef(null)
  const cbRef = useRef({})
  cbRef.current = { onMarkerClick, onMapClick, onMarkerMove, draggableMarkers, pinMode }

  // init map once
  useEffect(() => {
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
      minZoom: 6,
    })
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains: 'abcd', maxZoom: 19 }).addTo(map)
    map.setView([31.4, 34.35], 11) // provisional; fitBounds runs once markers arrive
    groupRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    map.on('click', (e) => {
      if (cbRef.current.pinMode) cbRef.current.onMapClick?.(e.latlng)
    })

    // keep size correct when the container settles / resizes
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(containerRef.current)
    const t = setTimeout(() => map.invalidateSize(), 200)

    return () => {
      clearTimeout(t)
      ro.disconnect()
      map.remove()
      mapRef.current = null
      groupRef.current = null
    }
  }, [])

  // reflect pin-mode as a class on the container (cursor + affordance)
  useEffect(() => {
    containerRef.current?.classList.toggle('is-pinning', pinMode)
  }, [pinMode])

  // draw markers + fit bounds whenever the marker set changes
  useEffect(() => {
    const map = mapRef.current
    const group = groupRef.current
    if (!map || !group) return
    group.clearLayers()

    const latlngs = []
    markers.forEach((m) => {
      if (m.lat == null || m.lng == null) return
      const icon = L.divIcon({
        className: 'gk-div-icon',
        html: markerHtml(m),
        iconSize: [140, 54],
        iconAnchor: [70, 34], // geo point at the dot's tip (center-ish)
      })
      const marker = L.marker([m.lat, m.lng], { icon, riseOnHover: true, draggable: cbRef.current.draggableMarkers }).addTo(group)
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        if (!cbRef.current.pinMode) cbRef.current.onMarkerClick?.(m)
      })
      marker.on('dragend', () => {
        const ll = marker.getLatLng()
        cbRef.current.onMarkerMove?.(m, { lat: ll.lat, lng: ll.lng })
      })
      latlngs.push([m.lat, m.lng])
    })

    if (closeup && center) {
      // keep a stable view of the village regardless of how many POIs exist
      map.setView([center.lat, center.lng], center.zoom || 16, { animate: false })
    } else if (latlngs.length === 1) {
      map.setView(latlngs[0], closeup ? 16 : 13, { animate: false })
    } else if (latlngs.length > 1) {
      map.fitBounds(latlngs, { padding: [55, 55], maxZoom: closeup ? 16 : 13 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, closeup, center?.lat, center?.lng])

  return <div ref={containerRef} className={`leaflet-host ${className}`} />
}
