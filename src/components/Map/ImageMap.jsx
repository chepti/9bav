import { useRef } from 'react'
import { AREA_COLOR } from '../../data/categories.js'

// The settlement-level "map" is a historical aerial photo, not a live web map.
// Points of interest and area polygons are positioned as percentages (0..100)
// of the image, so they stay put when toggling between year layers (e.g. 2005
// ⇄ 2025) that share the same framing. Clicking the image (in add/draw mode)
// reports the clicked point as a percentage.

export default function ImageMap({
  layers = [],            // [{ year, src }]
  activeYear = null,
  onYearChange,
  pois = [],              // [{ id, x, y, title }]
  areas = [],             // [{ id, category, points: [[x,y]], label }]
  draftArea = null,       // { category, points: [[x,y]] } while drawing
  pinMode = false,
  drawMode = false,
  onImageClick,           // (x, y) => void — fired in pin/draw mode
  onPoiClick,
  className = '',
}) {
  const canvasRef = useRef(null)
  const active = layers.find((l) => l.year === activeYear) || layers[0]
  const adding = pinMode || drawMode

  function handleClick(e) {
    if (!adding || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    onImageClick?.(x, y)
  }

  const pts = (arr) => arr.map((p) => `${p[0]},${p[1]}`).join(' ')

  return (
    <div className={`image-map ${className}`}>
      {layers.length > 1 && (
        <div className="year-toggle row gap-6">
          {layers.map((l) => (
            <button
              key={l.year}
              className={`pill sm ${l.year === (active?.year) ? 'is-active' : 'ghost'}`}
              onClick={() => onYearChange?.(l.year)}
            >
              {l.year}
            </button>
          ))}
        </div>
      )}

      <div
        ref={canvasRef}
        className={`image-map-canvas ${adding ? 'is-adding' : ''}`}
        onClick={handleClick}
      >
        {active?.src && <img src={active.src} alt={`תצלום ${active.year}`} draggable={false} />}

        <svg className="image-map-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          {areas.map((a) =>
            a.points?.length >= 3 ? (
              <polygon
                key={a.id}
                points={pts(a.points)}
                fill={AREA_COLOR[a.category] || AREA_COLOR.general}
                fillOpacity="0.3"
                stroke={AREA_COLOR[a.category] || AREA_COLOR.general}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
          {draftArea?.points?.length >= 2 && (
            <polygon
              points={pts(draftArea.points)}
              fill={AREA_COLOR[draftArea.category] || AREA_COLOR.general}
              fillOpacity="0.18"
              stroke={AREA_COLOR[draftArea.category] || AREA_COLOR.general}
              strokeWidth="1.5"
              strokeDasharray="4,3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {draftArea?.points?.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r="1" fill="#fff" stroke={AREA_COLOR[draftArea.category] || AREA_COLOR.general} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        {pois
          .filter((p) => p.x != null && p.y != null)
          .map((p) => (
            <button
              key={p.id}
              className="image-pin"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onClick={(e) => { e.stopPropagation(); onPoiClick?.(p) }}
              title={p.title}
            >
              <span className="image-pin-dot" />
              <span className="image-pin-label">{p.title}</span>
            </button>
          ))}
      </div>
    </div>
  )
}
