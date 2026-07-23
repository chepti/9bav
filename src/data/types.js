// Domain model for the Gush Katif / Northern Samaria documentation project.
// Kept as JSDoc typedefs so the shape is documented without a TS build step.
// The same shapes are what a future PHP+MySQL API will return.

/**
 * @typedef {'gush_katif'|'northern_samaria'} RegionId
 */

/**
 * @typedef {'text'|'photo'|'video'|'document'} MediaType
 */

/**
 * @typedef {Object} MediaItem
 * @property {string} id
 * @property {MediaType} type
 * @property {string} [title]
 * @property {string} [body]        // text content or caption
 * @property {string} [url]         // photo/video/document source (data-URL or link)
 * @property {string} [timeLabel]   // "09:15" for the day-of-expulsion clock
 * @property {boolean} [approximate]// true => shown as ~09:15
 * @property {string} authorName
 * @property {number} createdAt
 * @property {'pending'|'approved'} status
 */

/**
 * @typedef {Object} DatedEntry   // "after the expulsion" milestones
 * @property {string} id
 * @property {string} dateLabel   // free text: "18.10.23", "תחילת ספטמבר 2005"
 * @property {string} title
 * @property {string} description
 * @property {MediaItem[]} media
 */

/**
 * @typedef {Object} InfoSection  // settlement general info categories
 * @property {'agriculture'|'education'|'community'|'commerce'|'general'} key
 * @property {string} body
 * @property {MediaItem[]} media
 */

/**
 * @typedef {Object} Poi          // point of interest (a home, a landmark)
 * @property {string} id
 * @property {string} settlementId
 * @property {string} title
 * @property {number} lat         // geographic position of the point of interest
 * @property {number} lng
 * @property {string} authorName
 * @property {MediaItem[]} before // "before the expulsion"
 * @property {MediaItem[]} during // day of expulsion (each item has timeLabel)
 * @property {DatedEntry[]} after // after the expulsion
 */

/**
 * @typedef {Object} HistoricalOverlay // a georeferenced 2005-era aerial photo
 * @property {string} url               // image source (data-URL, Drive/https link)
 * @property {[[number,number],[number,number]]} bounds // [[southLat,westLng],[northLat,eastLng]]
 * @property {number} [opacity]         // 0..1, default 1
 * @property {string} [year]            // label, default "2005"
 */

/**
 * @typedef {Object} Settlement
 * @property {string} id
 * @property {string} name
 * @property {RegionId} region
 * @property {number} lat         // geographic position on the regional map
 * @property {number} lng
 * @property {number} [population]
 * @property {number} [founded]
 * @property {string} [evacuatedTo]
 * @property {string} [tagline]
 * @property {HistoricalOverlay} [historical] // optional 2005 aerial overlay
 * @property {InfoSection[]} info
 * @property {string[]} moderators
 * @property {Poi[]} pois
 */

export {}
