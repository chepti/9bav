import { MEDIA_ICONS, IconTrash } from '../ui/Icons.jsx'
import { imageSrc, videoEmbed, fileLink } from '../../data/media.js'
import { motion } from 'framer-motion'

// Renders one media item. Moderators get a delete control; content is public
// as soon as it is added (no approval queue).
export default function MediaCard({ item, canModerate, onDelete, index = 0 }) {
  const Icon = MEDIA_ICONS[item.type] || MEDIA_ICONS.text

  return (
    <motion.div
      className="media-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.3 }}
    >
      <div className="media-card-head row gap-8">
        <span className="media-type-badge"><Icon width={14} height={14} /></span>
        {item.title && <strong>{item.title}</strong>}
        {item.timeLabel && <span className="pill sm ghost">{item.approximate ? '~' : ''}{item.timeLabel}</span>}
        <span className="grow" />
        {item.authorName && <span className="muted" style={{ fontSize: '0.78rem' }}>{item.authorName}</span>}
      </div>

      {item.type === 'photo' && (item.url || item.driveId) && (
        <img className="media-img" src={imageSrc(item)} alt={item.title || ''} loading="lazy" />
      )}
      {item.type === 'video' && (item.url || item.driveId) && (
        videoEmbed(item)
          ? (
            <iframe
              className="media-embed"
              src={videoEmbed(item)}
              title={item.title || 'video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )
          : <video className="media-img" src={item.url} controls />
      )}
      {item.type === 'document' && (item.url || item.driveId) && (
        <a className="pill ghost" href={fileLink(item)} target="_blank" rel="noopener noreferrer">פתיחת מסמך</a>
      )}
      {item.body && <p className="media-body">{item.body}</p>}

      {canModerate && (
        <div className="row gap-6" style={{ marginTop: 8 }}>
          <button className="pill sm ghost danger" onClick={onDelete}><IconTrash width={13} height={13} /> מחיקה</button>
        </div>
      )}
    </motion.div>
  )
}
