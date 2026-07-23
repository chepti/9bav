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
 * @property {string} [url]         // photo/video/document source (data-URL, Drive link, or YouTube URL)
 * @property {string} [timeLabel]   // "09:15" for the day-of-expulsion clock
 * @property {boolean} [approximate]// true => shown as ~09:15
 * @property {string} authorName
 * @property {string} [authorKey]   // uid:/email:/name: for ownership checks
 * @property {number} createdAt
 * @property {string[]} [likedBy]   // user keys (uid / email / local name) who hearted this item
 * @property {'pending'|'approved'} [status] // legacy; new items are published as approved
 */

/**
 * @typedef {Object} DatedEntry   // "after the expulsion" milestones
 * @property {string} id
 * @property {string} dateLabel   // free text: "18.10.23", "תחילת ספטמבר 2005"
 * @property {string} title
 * @property {string} description
 * @property {string} [authorName]
 * @property {string} [authorKey]
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
 * @property {number} x           // horizontal position as % (0..100) of the photo
 * @property {number} y           // vertical position as % (0..100) of the photo
 * @property {string} authorName
 * @property {MediaItem[]} before // "before the expulsion"
 * @property {MediaItem[]} during // day of expulsion (each item has timeLabel)
 * @property {DatedEntry[]} after // after the expulsion
 */

/**
 * @typedef {Object} ImageLayer // a dated aerial photo of the settlement, all
 *                                sharing the same framing so points line up
 * @property {string} year       // "2005", "2025", …
 * @property {string} [url]      // image source (data-URL or https link)
 * @property {string} [driveId]  // Google Drive file id (live mode uploads)
 */

/**
 * @typedef {Object} Area // a colored polygon marking where a function was located
 * @property {string} id
 * @property {'agriculture'|'education'|'community'|'commerce'|'general'} category
 * @property {{x:number,y:number}[]} points // vertices as % of the photo (Firestore forbids nested arrays)
 * @property {string} [label]           // optional free-text label
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
 * @property {ImageLayer[]} [imageLayers] // aerial photos by year (the settlement "map")
 * @property {GalleryItem[]} [gallery]    // settlement-level media strip (e.g. Wikipedia photos)
 * @property {Area[]} [areas]     // optional area polygons on the photo
 * @property {InfoSection[]} info
 * @property {string[]} moderators
 * @property {Poi[]} pois
 */

/**
 * @typedef {Object} GalleryItem
 * @property {string} id
 * @property {string} url
 * @property {string} [thumb]
 * @property {string} [caption]
 * @property {string} [credit]
 * @property {string} [sourceUrl]
 */

export {}
