import { Link } from 'react-router-dom'
import { IconHome } from './Icons.jsx'

// items: [{ label, to }]. The last item is the current page (no link).
export default function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="פירורי לחם">
      <Link to="/" className="crumb crumb-home" aria-label="לדף הבית">
        <IconHome width={14} height={14} />
      </Link>
      {items.map((it, i) => {
        const last = i === items.length - 1
        return (
          <span key={i} className="row gap-4">
            <span className="crumb-sep">›</span>
            {last || !it.to ? (
              <span className="crumb crumb-current">{it.label}</span>
            ) : (
              <Link to={it.to} className="crumb">{it.label}</Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
