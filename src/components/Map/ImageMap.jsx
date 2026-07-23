import { useEffect, useRef, useState } from 'react'
import { AREA_COLOR } from '../../data/categories.js'

// The settlement-level "map" is a historical aerial photo, not a live web map.
// Points of interest and area polygons are positioned as percentages (0..100)
// of the image so they stay put when toggling between year layers that share
// the same framing. The photo pans and zooms like a map (wheel / drag / buttons).
// Pins live in a separate overlay (not inside the scaled world) so they stay
// sharp and clickable on desktop. Clicking (a tap without a drag) in add/draw
// mode reports the point as a percentage.

const MIN = 1
const MAX = 8

export default function ImageMap({
  layers = [],
  activeYear = null,
  onYearChange,
  pois = [],
  areas = [],
  draftArea = null,
  pinMode = false,
  drawMode = false,
  onImageClick,
  onPoiClick,
  className = '',
}) {
  const canvasRef = useRef(null)
  const worldRef = useRef(null)
  const drag = useRef(null)
  const [t, setT] = useState({ s: 1, x: 0, y: 0 })
  const [size, setSize] = useState({ w: 0, h: 0 })
  const active = layers.find((l) => l.year === activeYear) || layers[0]
  const adding = pinMode || drawMode

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setSize({ w: r.width, h: r.height })
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [active?.src])

  function clampT(nt) {
    const c = canvasRef.current?.getBoundingClientRect()
    const s = Math.min(MAX, Math.max(MIN, nt.s))
    if (!c) return { s, x: nt.x, y: nt.y }
    const minX = c.width * (1 - s)
    const minY = c.height * (1 - s)
    return { s, x: Math.min(0, Math.max(minX, nt.x)), y: Math.min(0, Math.max(minY, nt.y)) }
  }

  function zoomAt(cx, cy, factor) {
    setT((prev) => {
      const ns = Math.min(MAX, Math.max(MIN, prev.s * factor))
      const wx = (cx - prev.x) / prev.s
      const wy = (cy - prev.y) / prev.s
      return clampT({ s: ns, x: cx - wx * ns, y: cy - wy * ns })
    })
  }

  // wheel bound manually so we can preventDefault (React wheel is passive)
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const c = el.getBoundingClientRect()
      zoomAt(e.clientX - c.left, e.clientY - c.top, e.deltaY < 0 ? 1.2 : 1 / 1.2)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function onImgLoad(e) {
    const img = e.target
    if (img.naturalWidth && canvasRef.current) {
      canvasRef.current.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`
      const r = canvasRef.current.getBoundingClientRect()
      setSize({ w: r.width, h: r.height })
    }
  }

  function onImgError() {
    if (canvasRef.current) {
      canvasRef.current.style.aspectRatio = '4 / 3'
      const r = canvasRef.current.getBoundingClientRect()
      setSize({ w: r.width, h: r.height })
    }
  }

  function onPointerDown(e) {
    if (e.button != null && e.button !== 0) return
    // Pins / zoom controls handle their own clicks — do not capture the pointer.
    if (e.target.closest?.('.image-pin, .image-map-zoom')) return
    drag.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }
    canvasRef.current?.setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) d.moved = true
    if (d.moved) {
      setT((prev) => clampT({ s: prev.s, x: prev.x + dx, y: prev.y + dy }))
      d.x = e.clientX
      d.y = e.clientY
    }
  }
  function endDrag(e, place) {
    const d = drag.current
    if (!d || (e.pointerId != null && d.id !== e.pointerId)) return
    drag.current = null
    try { canvasRef.current?.releasePointerCapture?.(e.pointerId) } catch (_) { /* already released */ }
    if (!place || d.moved || !adding || !worldRef.current) return
    const w = worldRef.current.getBoundingClientRect()
    if (!w.width || !w.height) return
    const x = Math.max(0, Math.min(100, ((e.clientX - w.left) / w.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - w.top) / w.height) * 100))
    onImageClick?.(x, y)
  }

  function btnZoom(factor) {
    const c = canvasRef.current?.getBoundingClientRect()
    if (c) zoomAt(c.width / 2, c.height / 2, factor)
  }

  const px = (p) => (Array.isArray(p) ? p[0] : p.x)
  const py = (p) => (Array.isArray(p) ? p[1] : p.y)
  const pts = (arr) => arr.map((p) => `${px(p)},${py(p)}`).join(' ')

  return (
    <div className={`image-map ${className}`}>
      {layers.length > 1 && (
        <div className="year-toggle row gap-6">
          {layers.map((l) => (
            <button key={l.year} className={`pill sm ${l.year === (active?.year) ? 'is-active' : 'ghost'}`} onClick={() => onYearChange?.(l.year)}>
              {l.year}
            </button>
          ))}
        </div>
      )}

      <div
        ref={canvasRef}
        className={`image-map-canvas ${adding ? 'is-adding' : ''} ${t.s > 1 ? 'is-zoomed' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, true)}
        onPointerCancel={(e) => endDrag(e, false)}
      >
        <div className="image-map-world" ref={worldRef} style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }}>
          {active?.src && <img src={active.src} alt={`תצלום ${active.year}`} draggable={false} onLoad={onImgLoad} onError={onImgError} />}

          <svg className="image-map-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            {areas.map((a) =>
              a.points?.length >= 3 ? (
                <polygon key={a.id} points={pts(a.points)} fill={AREA_COLOR[a.category] || AREA_COLOR.general} fillOpacity="0.3" stroke={AREA_COLOR[a.category] || AREA_COLOR.general} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              ) : null,
            )}
            {draftArea?.points?.length >= 2 && (
              <polygon points={pts(draftArea.points)} fill={AREA_COLOR[draftArea.category] || AREA_COLOR.general} fillOpacity="0.18" stroke={AREA_COLOR[draftArea.category] || AREA_COLOR.general} strokeWidth="1.5" strokeDasharray="4,3" vectorEffect="non-scaling-stroke" />
            )}
            {draftArea?.points?.map((p, i) => (
              <circle key={i} cx={px(p)} cy={py(p)} r="1" fill="#fff" stroke={AREA_COLOR[draftArea.category] || AREA_COLOR.general} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
        </div>

        {/* Pins outside the scaled world → sharp + receive clicks on desktop */}
        <div className="image-map-pins" aria-hidden={adding || undefined}>
          {pois
            .filter((p) => p.x != null && p.y != null)
            .map((p) => {
              const left = t.x + (p.x / 100) * size.w * t.s
              const top = t.y + (p.y / 100) * size.h * t.s
              return (
                <button
                  key={p.id}
                  type="button"
                  className="image-pin"
                  style={{
                    left,
                    top,
                    pointerEvents: adding ? 'none' : 'auto',
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onPoiClick?.(p)
                  }}
                  title={p.title}
                >
                  <span className="image-pin-dot" />
                  <span className="image-pin-label">{p.title}</span>
                </button>
              )
            })}
        </div>

        <div
          className="image-map-zoom"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={() => btnZoom(1.4)} title="התקרבות">+</button>
          <button type="button" onClick={() => btnZoom(1 / 1.4)} title="התרחקות">−</button>
          <button type="button" onClick={() => setT({ s: 1, x: 0, y: 0 })} title="איפוס תצוגה">⤢</button>
        </div>
      </div>
    </div>
  )
}
